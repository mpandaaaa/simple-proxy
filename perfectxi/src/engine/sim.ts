import type { Slot, Position } from './types';
import type { Rng } from './rng';
import { shuffle } from './rng';
import { FORMATIONS, type Formation } from './formations';

/* ===== DIXON-COLES MATCH ENGINE (Dixon & Coles 1997, JRSS-C 46:265-280) =====
   lambda = exp(c + att_home + def_away + gamma)   gamma = 0.27 (home adv)
   tau correction on low scores with rho = -0.13

   These three constants and the two curves in dcParams are the balance of
   the whole game: about 2.75 goals a game, champions near 90 points. They
   are carried over from the web build exactly. Do not retune them here.
   ========================================================================= */
const DC = { GAMMA: 0.27, RHO: -0.13, BASE: 0.13 } as const;

/**
 * The nineteen clubs your XI plays home and away. Fixed, so the league a
 * season is graded against is the same league for everybody.
 */
export const SIM_LEAGUE: readonly { name: string; str: number; var: number }[] = [
  { name: 'Liverpool', str: 0.88, var: 0.06 },
  { name: 'Man City', str: 0.86, var: 0.06 },
  { name: 'Arsenal', str: 0.83, var: 0.07 },
  { name: 'Chelsea', str: 0.76, var: 0.08 },
  { name: 'Newcastle', str: 0.72, var: 0.08 },
  { name: 'Aston Villa', str: 0.69, var: 0.08 },
  { name: 'Spurs', str: 0.68, var: 0.09 },
  { name: 'Man United', str: 0.67, var: 0.09 },
  { name: 'Brighton', str: 0.61, var: 0.09 },
  { name: 'West Ham', str: 0.53, var: 0.1 },
  { name: 'Fulham', str: 0.52, var: 0.09 },
  { name: 'Brentford', str: 0.51, var: 0.09 },
  { name: 'Nottm Forest', str: 0.5, var: 0.09 },
  { name: 'Crystal Palace', str: 0.48, var: 0.1 },
  { name: 'Bournemouth', str: 0.46, var: 0.1 },
  { name: 'Everton', str: 0.43, var: 0.11 },
  { name: 'Wolves', str: 0.37, var: 0.11 },
  { name: 'Leeds', str: 0.33, var: 0.12 },
  { name: 'Sunderland', str: 0.28, var: 0.12 },
];

/** Squad average rating to a strength on the 0.30 to 0.97 scale. */
export function strFromAvg(avg: number): number {
  return Math.max(0.3, Math.min(0.97, (avg - 65) / 24));
}

function dcTau(x: number, y: number, l: number, m: number, rho: number): number {
  if (x === 0 && y === 0) return 1 - l * m * rho;
  if (x === 0 && y === 1) return 1 + l * rho;
  if (x === 1 && y === 0) return 1 + m * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

function dcPois(k: number, lam: number): number {
  let p = Math.exp(-lam);
  for (let i = 1; i <= k; i++) p *= lam / i;
  return p;
}

/** Strength to attack and defence parameters on the log scale. */
function dcParams(str: number, fmod: Formation | null): { att: number; def: number } {
  const s = Math.max(0.2, Math.min(0.99, str));
  const att = (s - 0.62) * 2.15 + Math.log(fmod && fmod.att ? fmod.att : 1);
  const def = -(s - 0.62) * 2.0 - Math.log(fmod && fmod.def ? fmod.def : 1);
  return { att, def };
}

function dcMatrix(lam: number, mu: number, rho: number): number[][] {
  const MAXG = 9;
  const rows: number[][] = [];
  let tot = 0;
  for (let x = 0; x <= MAXG; x++) {
    rows[x] = [];
    for (let y = 0; y <= MAXG; y++) {
      let p = dcTau(x, y, lam, mu, rho) * dcPois(x, lam) * dcPois(y, mu);
      if (p < 0) p = 0;
      rows[x][y] = p;
      tot += p;
    }
  }
  if (tot > 0) {
    for (let x = 0; x <= MAXG; x++) {
      for (let y = 0; y <= MAXG; y++) rows[x][y] /= tot;
    }
  }
  return rows;
}

function dcDraw(lam: number, mu: number, rho: number, rnd: Rng): { gf: number; ga: number } {
  const m = dcMatrix(lam, mu, rho);
  const r = rnd();
  let cum = 0;
  for (let x = 0; x < m.length; x++) {
    for (let y = 0; y < m[x].length; y++) {
      cum += m[x][y];
      if (r <= cum) return { gf: x, ga: y };
    }
  }
  return { gf: 1, ga: 1 };
}

/** Expected goals for and against. Also feeds the pre-match odds card. */
export function dcExpected(
  myStr: number,
  oppStr: number,
  isHome: boolean,
  fmod: Formation | null,
): { lam: number; mu: number } {
  const me = dcParams(myStr, fmod);
  const op = dcParams(oppStr, null);
  const lam = Math.exp(DC.BASE + me.att + op.def + (isHome ? DC.GAMMA : 0));
  const mu = Math.exp(DC.BASE + op.att + me.def + (isHome ? 0 : DC.GAMMA));
  return {
    lam: Math.max(0.12, Math.min(6, lam)),
    mu: Math.max(0.12, Math.min(6, mu)),
  };
}

/** A Poisson draw. Used for the rest of the league, not for your own XI. */
function poissonR(l: number, rnd: Rng): number {
  if (l <= 0) return 0;
  const L = Math.exp(-Math.min(l, 20));
  let p = 1;
  let k = 0;
  do {
    k++;
    p *= rnd();
  } while (p > L);
  return k - 1;
}

/** 3 becomes "3rd". */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export type Odds = {
  /** chance of winning the league, as a percentage */
  winPct: number;
  top4: number;
  top6: number;
  top10: number;
  rel: number;
  expPts: number;
  projFinish: number;
};

/**
 * What the bookies make of an XI, before a ball is kicked.
 *
 * Carried over from the web build exactly. These curves are tuned against
 * the same strength scale the match engine uses, so the projection and the
 * season it is projecting agree with each other. Do not adjust them here
 * without re-running the golden numbers.
 *
 * Chemistry counts, because it counts in the simulation too.
 */
export function calcOdds(avg: number, chem: number): Odds {
  const str = strFromAvg(avg + chem);
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    winPct: r1(Math.max(0.3, Math.min(80, str * str * 92 - 3))),
    top4: r1(Math.max(2, Math.min(99.5, str * str * 80 + str * 25 - 4))),
    top6: r1(Math.max(6, Math.min(99.8, str * str * 60 + str * 48 - 2))),
    top10: r1(Math.max(20, Math.min(100, str * 55 + str * 48 + 4))),
    rel: r1(Math.max(0, Math.min(60, 55 - str * 78))),
    expPts: Math.round(18 + str * 82),
    projFinish: Math.max(1, Math.min(20, Math.round(20.5 - str * 19.5))),
  };
}

export type Outcome = 'win' | 'draw' | 'loss';

export type Scorer = { name: string; min: number };

export type MatchResult = {
  /** match number, 1 to 38 */
  n: number;
  opp: string;
  home: boolean;
  gf: number;
  ga: number;
  oc: Outcome;
  scorers: Scorer[];
  xgF: number;
  xgA: number;
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

export type PlayerStat = { g: number; a: number; cs: number };

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export type SeasonResult = {
  matches: MatchResult[];
  table: TableRow[];
  position: number;
  grade: Grade;
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
  /** as "4-0", or null if the season contained no win at all */
  biggestWin: string | null;
  playerStats: Record<string, PlayerStat>;
};

const GOAL_WEIGHT: Record<Position, number> = {
  GK: 0.005,
  DEF: 0.05,
  MID: 0.15,
  ATT: 0.55,
};

/** Better players score more, but a defender can still nick one. */
function genScorers(
  numGoals: number,
  players: Slot[],
  stats: Record<string, PlayerStat>,
  rnd: Rng,
): Scorer[] {
  const scorers: Scorer[] = [];
  for (let i = 0; i < numGoals; i++) {
    const weights = players.map((s) => {
      const base = GOAL_WEIGHT[s.pos] ?? 0.1;
      const mult = Math.pow((s.player!.rtg - 60) / 30, 1.5);
      return base * Math.max(0.15, mult);
    });
    let total = 0;
    for (const w of weights) total += w;

    const r = rnd() * total;
    let cum = 0;
    let scorer = players[players.length - 1].player!;
    for (let j = 0; j < players.length; j++) {
      cum += weights[j];
      if (r <= cum) {
        scorer = players[j].player!;
        break;
      }
    }

    scorers.push({ name: scorer.n, min: 1 + Math.floor(rnd() * 90) });
    stats[scorer.n].g++;

    if (rnd() < 0.62) {
      const pool = players.filter((x) => x.player!.n !== scorer.n);
      if (pool.length) {
        const aw = pool.map(
          (s) =>
            (GOAL_WEIGHT[s.pos] ?? 0.1) *
            Math.max(0.15, Math.pow((s.player!.rtg - 60) / 30, 1.3)),
        );
        let at = 0;
        for (const w of aw) at += w;
        const ar = rnd() * at;
        let ac = 0;
        for (let m = 0; m < pool.length; m++) {
          ac += aw[m];
          if (ar <= ac) {
            stats[pool[m].player!.n].a++;
            break;
          }
        }
      }
    }
  }
  scorers.sort((a, b) => a.min - b.min);
  return scorers;
}

export function seasonGrade(pos: number, pts: number, losses: number): Grade {
  if (pos === 1 && (losses === 0 || pts >= 95)) return 'S';
  if (pos === 1) return 'A';
  if (pos <= 4) return 'B';
  if (pos <= 7) return 'C';
  if (pos <= 14) return 'D';
  if (pos <= 17) return 'E';
  return 'F';
}

/**
 * Play a whole season.
 *
 * Every random number comes from `rnd`, including the opposition jitter and
 * the rest of the league's results. The web build drew some of those from
 * Math.random, so a seeded run there was only partly reproducible. A
 * leaderboard entry here is checked by replaying the seed, the config and
 * the eleven picks and confirming the points agree, and that only works if
 * the whole season follows from the seed and nothing else.
 */
export function simulateSeason(
  squad: Slot[],
  formation: string,
  chemBonus: number,
  rnd: Rng,
): SeasonResult {
  const filled = squad.filter((s) => s.player);
  if (filled.length !== squad.length) {
    throw new Error('cannot simulate a season with an incomplete XI');
  }

  const fmod = FORMATIONS[formation] ?? null;
  const avg = filled.reduce((sum, s) => sum + s.player!.rtg, 0) / filled.length;
  const myStr = strFromAvg(avg + chemBonus);

  const stats: Record<string, PlayerStat> = {};
  for (const s of filled) stats[s.player!.n] = { g: 0, a: 0, cs: 0 };

  // Home and away against all nineteen, drawn so a club is not played twice
  // in a row: shuffle each half, then alternate them.
  const homeFx = shuffle(
    SIM_LEAGUE.map((t) => ({ team: t, home: true })),
    rnd,
  );
  const awayFx = shuffle(
    SIM_LEAGUE.map((t) => ({ team: t, home: false })),
    rnd,
  );
  const fixtures: { team: { name: string; str: number; var: number }; home: boolean }[] = [];
  for (let i = 0; i < 19; i++) {
    fixtures.push(homeFx[i]);
    fixtures.push(awayFx[i]);
  }

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let gf = 0;
  let ga = 0;
  let pts = 0;
  let xgF = 0;
  let xgA = 0;
  let cleanSheets = 0;
  let longestStreak = 0;
  let curStreak = 0;
  let biggestWin: string | null = null;
  let biggestDiff = -1;
  const matches: MatchResult[] = [];

  for (let mi = 0; mi < 38; mi++) {
    const fix = fixtures[mi];
    const oppStr = Math.max(
      0.2,
      Math.min(0.98, fix.team.str + (rnd() - 0.5) * fix.team.var * 2),
    );
    const e = dcExpected(myStr, oppStr, fix.home, fmod);
    const sc = dcDraw(e.lam, e.mu, DC.RHO, rnd);

    let oc: Outcome;
    if (sc.gf > sc.ga) {
      oc = 'win';
      wins++;
      pts += 3;
    } else if (sc.gf === sc.ga) {
      oc = 'draw';
      draws++;
      pts += 1;
    } else {
      oc = 'loss';
      losses++;
    }

    gf += sc.gf;
    ga += sc.ga;
    xgF += e.lam;
    xgA += e.mu;

    if (sc.ga === 0) {
      cleanSheets++;
      for (const s of filled) {
        if (s.pos === 'GK' || s.pos === 'DEF') stats[s.player!.n].cs++;
      }
    }

    if (oc === 'win') {
      curStreak++;
      if (curStreak > longestStreak) longestStreak = curStreak;
      const diff = sc.gf - sc.ga;
      if (diff > biggestDiff) {
        biggestDiff = diff;
        biggestWin = sc.gf + '-' + sc.ga;
      }
    } else {
      curStreak = 0;
    }

    matches.push({
      n: mi + 1,
      opp: fix.team.name,
      home: fix.home,
      gf: sc.gf,
      ga: sc.ga,
      oc,
      scorers: genScorers(sc.gf, filled, stats, rnd),
      xgF: Math.round(e.lam * 100) / 100,
      xgA: Math.round(e.mu * 100) / 100,
    });
  }

  // The other nineteen play their own season, so the table your XI lands in
  // is a real one rather than a ladder drawn around your points.
  const others: TableRow[] = SIM_LEAGUE.map((t) => {
    let w = 0;
    let d = 0;
    let l = 0;
    let tgf = 0;
    let tga = 0;
    const teamStr = Math.max(0.2, Math.min(0.98, t.str + (rnd() - 0.5) * t.var * 1.6));
    for (let g = 0; g < 38; g++) {
      const oppStr = SIM_LEAGUE[g % SIM_LEAGUE.length].str;
      const boost = g < 19 ? 0.06 : -0.03;
      const adj = Math.min(0.98, teamStr + boost);
      const g1 = poissonR(Math.max(0.08, 0.18 + adj * 3.5 - oppStr * 2.0), rnd);
      const g2 = poissonR(Math.max(0.08, 0.18 + oppStr * 3.5 - adj * 2.0), rnd);
      tgf += g1;
      tga += g2;
      if (g1 > g2) w++;
      else if (g1 === g2) d++;
      else l++;
    }
    return { name: t.name, w, d, l, gf: tgf, ga: tga, pts: w * 3 + d, isYou: false };
  });

  const table: TableRow[] = others.concat([
    { name: 'Your XI', w: wins, d: draws, l: losses, gf, ga, pts, isYou: true },
  ]);
  table.sort(
    (a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf,
  );

  const position = table.findIndex((r) => r.isYou) + 1;

  return {
    matches,
    table,
    position,
    grade: seasonGrade(position, pts, losses),
    wins,
    draws,
    losses,
    gf,
    ga,
    pts,
    xgF: Math.round(xgF * 10) / 10,
    xgA: Math.round(xgA * 10) / 10,
    cleanSheets,
    longestStreak,
    biggestWin,
    playerStats: stats,
  };
}
