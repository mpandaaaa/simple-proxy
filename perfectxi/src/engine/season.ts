/**
 * A 38 game Premier League season, ported from the web game's goSimulate,
 * plComputeNext, genScorers and buildFinalTable.
 *
 * The order of random draws is the contract. For one seed and one squad
 * the web game and this module produce the same season, match for match
 * and scorer for scorer. The parity test enforces that against the
 * original web code.
 *
 * Draw order:
 *   1. shuffle the 19 home fixtures, then the 19 away fixtures
 *   2. for each of the 19 rival clubs: one strength wobble, then 38 games
 *      on the simpler Poisson model (two goal draws each)
 *   3. for each of your 38 matches: one opponent wobble, one Dixon-Coles
 *      scoreline, then per goal a scorer, a minute, an assist roll and,
 *      when the roll lands, an assister
 *
 * Note the rival clubs do NOT use Dixon-Coles. Only your matches do. That is
 * how the web game is tuned; folding them into one model would change
 * every final table.
 */
import league from '../data/league.json';
import { DC, dcDraw, dcExpected, NO_TACTICS, type FormationMod, type TacticalDeltas } from './match/dixonColes';
import { poisson, shuffle, type Rng } from './rng';
import { squadStrength } from './strength';
import type { Squad } from './types';

export type LeagueTeam = { name: string; str: number; var: number };
export const SIM_LEAGUE: readonly LeagueTeam[] = league.SIM_LEAGUE;

type FormationDef = { desc: string; att: number; def: number; rows: string[][] };
export const FORMATIONS = league.FM as Record<string, FormationDef>;

export type Outcome = 'win' | 'draw' | 'loss';
export type Fixture = { team: LeagueTeam; home: boolean };
export type Goal = { name: string; min: number };
export type MatchResult = {
  n: number;
  opp: string;
  gf: number;
  ga: number;
  oc: Outcome;
  scorers: Goal[];
  home: boolean;
  xg: { f: number; a: number };
};
export type TableRow = {
  name: string;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
  isYou: boolean;
};
export type PlayerLine = { g: number; a: number; cs: number };

export type SeasonInput = {
  squad: Squad;
  formation: string;
  /** the run's random stream; may already be part way through (after the draft) */
  rnd: Rng;
  /** ascension "hostile league" tier: every rival is a little stronger */
  ascHostile?: boolean;
  /** tactical deltas from an active Dynasty */
  tactics?: TacticalDeltas;
};

export type SeasonState = {
  readonly input: SeasonInput;
  readonly fixtures: Fixture[];
  readonly otherTable: TableRow[];
  readonly myStr: number;
  readonly fmod: FormationMod;
  next: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  pts: number;
  xgF: number;
  xgA: number;
  form: Outcome[];
  cleanSheets: number;
  longestStreak: number;
  curStreak: number;
  biggestWin: { gf: number; ga: number } | null;
  playerStats: Record<string, PlayerLine>;
  matches: MatchResult[];
};

const clamp = (lo: number, hi: number, v: number) => Math.max(lo, Math.min(hi, v));

/** Set the season up: fixtures and the rivals' whole season. */
export function startSeason(input: SeasonInput): SeasonState {
  const { rnd, squad } = input;
  const asc = input.ascHostile ? 0.07 : 0;

  const playerStats: Record<string, PlayerLine> = {};
  for (const s of squad) if (s.player) playerStats[s.player.n] = { g: 0, a: 0, cs: 0 };

  // 1. fixtures: home and away against all 19, alternating once shuffled
  const fx: Fixture[] = [];
  for (const t of SIM_LEAGUE) {
    fx.push({ team: t, home: true });
    fx.push({ team: t, home: false });
  }
  const hFx = shuffle(fx.filter((f) => f.home), rnd);
  const aFx = shuffle(fx.filter((f) => !f.home), rnd);
  const fixtures: Fixture[] = [];
  for (let i = 0; i < 19; i++) {
    fixtures.push(hFx[i]);
    fixtures.push(aFx[i]);
  }

  // 2. the other nineteen clubs' seasons, decided up front
  const otherTable: TableRow[] = SIM_LEAGUE.map((t) => {
    let w = 0, d = 0, l = 0, gf = 0, ga = 0;
    const teamStr = clamp(0.2, 0.98, t.str + asc + (rnd() - 0.5) * t.var * 1.6);
    for (let g = 0; g < 38; g++) {
      // the web game cycles opponents by index, itself included; kept as is
      const oppStr = SIM_LEAGUE[g % SIM_LEAGUE.length].str;
      const home = g < 19;
      const boost = home ? 0.06 : -0.03;
      const adj = Math.min(0.98, teamStr + boost);
      const g1 = poisson(Math.max(0.08, 0.18 + adj * 3.5 - oppStr * 2.0), rnd);
      const g2 = poisson(Math.max(0.08, 0.18 + oppStr * 3.5 - adj * 2.0), rnd);
      gf += g1;
      ga += g2;
      if (g1 > g2) w++;
      else if (g1 === g2) d++;
      else l++;
    }
    return { name: t.name, w, d, l, gf, ga, pts: w * 3 + d, isYou: false };
  });

  return {
    input,
    fixtures,
    otherTable,
    myStr: squadStrength(squad),
    fmod: FORMATIONS[input.formation],
    next: 0,
    wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, pts: 0, xgF: 0, xgA: 0,
    form: [],
    cleanSheets: 0,
    longestStreak: 0,
    curStreak: 0,
    biggestWin: null,
    playerStats,
    matches: [],
  };
}

const SCORE_WEIGHT: Record<string, number> = { GK: 0.005, DEF: 0.05, MID: 0.15, ATT: 0.55 };

function genScorers(state: SeasonState, numGoals: number): Goal[] {
  const { rnd } = state.input;
  const players = state.input.squad.filter((s) => s.player);
  const scorers: Goal[] = [];
  for (let i = 0; i < numGoals; i++) {
    const weights = players.map((s) => {
      const base = SCORE_WEIGHT[s.pos] || 0.1;
      const rtgMult = Math.pow((s.player!.rtg - 60) / 30, 1.5);
      return base * Math.max(0.15, rtgMult);
    });
    let total = 0;
    for (let w = 0; w < weights.length; w++) total += weights[w];
    const r = rnd() * total;
    let cum = 0;
    let scorer = null;
    for (let j = 0; j < players.length; j++) {
      cum += weights[j];
      if (r <= cum) { scorer = players[j].player!; break; }
    }
    if (!scorer) scorer = players[players.length - 1].player!;
    const mn = 1 + Math.floor(rnd() * 90);
    scorers.push({ name: scorer.n, min: mn });
    state.playerStats[scorer.n].g++;
    if (rnd() < 0.62) {
      const apool = players.filter((x) => x.player!.n !== scorer!.n);
      if (apool.length) {
        const aw = apool.map((s) => (SCORE_WEIGHT[s.pos] || 0.1) * Math.max(0.15, Math.pow((s.player!.rtg - 60) / 30, 1.3)));
        let at = 0;
        for (let k = 0; k < aw.length; k++) at += aw[k];
        const ar = rnd() * at;
        let ac = 0;
        for (let m = 0; m < apool.length; m++) {
          ac += aw[m];
          if (ar <= ac) { state.playerStats[apool[m].player!.n].a++; break; }
        }
      }
    }
  }
  scorers.sort((a, b) => a.min - b.min);
  return scorers;
}

/** Play the next of your 38 matches. */
export function playNext(state: SeasonState): MatchResult {
  if (state.next >= 38) throw new Error('season is already over');
  const { rnd, squad } = state.input;
  const asc = state.input.ascHostile ? 0.07 : 0;
  const fix = state.fixtures[state.next];

  const oppStr = clamp(0.2, 0.98, fix.team.str + asc + (rnd() - 0.5) * fix.team.var * 2);
  const e = dcExpected(state.myStr, oppStr, fix.home, state.fmod, state.input.tactics ?? NO_TACTICS);
  const { gf, ga } = dcDraw(e.lam, e.mu, DC.RHO, rnd);

  let oc: Outcome;
  if (gf > ga) { oc = 'win'; state.wins++; state.pts += 3; }
  else if (gf === ga) { oc = 'draw'; state.draws++; state.pts += 1; }
  else { oc = 'loss'; state.losses++; }
  state.gf += gf;
  state.ga += ga;
  state.xgF += e.lam;
  state.xgA += e.mu;
  state.form.push(oc);
  if (state.form.length > 10) state.form.shift();

  const scorers = genScorers(state, gf);

  if (ga === 0) {
    state.cleanSheets++;
    for (const s of squad) if (s.player && (s.pos === 'GK' || s.pos === 'DEF')) state.playerStats[s.player.n].cs++;
  }
  if (oc === 'win') {
    state.curStreak++;
    if (state.curStreak > state.longestStreak) state.longestStreak = state.curStreak;
    const best = state.biggestWin ? state.biggestWin.gf - state.biggestWin.ga : -1;
    if (gf - ga > best) state.biggestWin = { gf, ga };
  } else {
    state.curStreak = 0;
  }

  const mr: MatchResult = {
    n: state.next + 1,
    opp: fix.team.name,
    gf, ga, oc, scorers,
    home: fix.home,
    xg: { f: Math.round(e.lam * 100) / 100, a: Math.round(e.mu * 100) / 100 },
  };
  state.matches.push(mr);
  state.next++;
  return mr;
}

/** All twenty clubs, sorted: points, then goal difference, then goals scored. */
export function finalTable(state: SeasonState): TableRow[] {
  const you: TableRow = {
    name: 'Your XI',
    w: state.wins, d: state.draws, l: state.losses,
    gf: state.gf, ga: state.ga, pts: state.pts,
    isYou: true,
  };
  // You go first before sorting, so a dead heat on every tiebreak goes your way,
  // as it does on the web.
  const all = [you, ...state.otherTable.map((r) => ({ ...r }))];
  all.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const gda = a.gf - a.ga, gdb = b.gf - b.ga;
    if (gdb !== gda) return gdb - gda;
    return b.gf - a.gf;
  });
  return all;
}

export type SeasonResult = {
  matches: MatchResult[];
  table: TableRow[];
  finish: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  pts: number;
  xgF: number;
  xgA: number;
  cleanSheets: number;
  longestStreak: number;
  biggestWin: { gf: number; ga: number } | null;
  playerStats: Record<string, PlayerLine>;
};

/** Play whatever is left and return the finished season. */
export function finishSeason(state: SeasonState): SeasonResult {
  while (state.next < 38) playNext(state);
  const table = finalTable(state);
  const finish = table.findIndex((r) => r.isYou) + 1;
  return {
    matches: state.matches,
    table,
    finish,
    wins: state.wins, draws: state.draws, losses: state.losses,
    gf: state.gf, ga: state.ga, pts: state.pts,
    xgF: state.xgF, xgA: state.xgA,
    cleanSheets: state.cleanSheets,
    longestStreak: state.longestStreak,
    biggestWin: state.biggestWin,
    playerStats: state.playerStats,
  };
}

/** Convenience: a whole season in one call. */
export function simulateSeason(input: SeasonInput): SeasonResult {
  return finishSeason(startSeason(input));
}
