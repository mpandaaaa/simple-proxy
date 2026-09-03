import type { Slot, Position } from './types';
import type { Rng } from './rng';
import { shuffle } from './rng';
import { FORMATIONS, type Formation } from './formations';
import { lastName } from './clubs';

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
/**
 * The twenty of 2026/27.
 *
 * The real division as it stands: Coventry, Ipswich and Hull came up,
 * Wolves, Burnley and West Ham went down, and Arsenal are the defending
 * champions. `str` is a strength on the same 0.30 to 0.97 scale a squad
 * rating maps to, and `var` is how much a club swings from season to
 * season, which is why Brighton are less predictable than Liverpool.
 */
export const PREMIER_LEAGUE: readonly { name: string; str: number; var: number }[] = [
  { name: 'Arsenal', str: 0.87, var: 0.06 },
  { name: 'Liverpool', str: 0.85, var: 0.07 },
  { name: 'Man City', str: 0.84, var: 0.07 },
  { name: 'Chelsea', str: 0.76, var: 0.08 },
  { name: 'Newcastle', str: 0.72, var: 0.08 },
  { name: 'Aston Villa', str: 0.69, var: 0.08 },
  { name: 'Spurs', str: 0.67, var: 0.09 },
  { name: 'Man United', str: 0.66, var: 0.09 },
  { name: 'Nottm Forest', str: 0.6, var: 0.09 },
  { name: 'Brighton', str: 0.59, var: 0.09 },
  { name: 'Bournemouth', str: 0.54, var: 0.1 },
  { name: 'Brentford', str: 0.51, var: 0.09 },
  { name: 'Crystal Palace', str: 0.5, var: 0.1 },
  { name: 'Fulham', str: 0.49, var: 0.09 },
  { name: 'Everton', str: 0.45, var: 0.11 },
  { name: 'Sunderland', str: 0.4, var: 0.11 },
  { name: 'Leeds', str: 0.36, var: 0.12 },
  { name: 'Ipswich', str: 0.32, var: 0.12 },
  { name: 'Coventry', str: 0.3, var: 0.12 },
  { name: 'Hull', str: 0.28, var: 0.12 },
];

/**
 * The nineteen clubs a draft XI plays home and away.
 *
 * The real twenty with the weakest left out, because a draft XI is the
 * twentieth club itself. A career gets its own league instead, which
 * changes every summer.
 */
export const SIM_LEAGUE: readonly { name: string; str: number; var: number }[] =
  PREMIER_LEAGUE.slice(0, 19);

/**
 * The division below.
 *
 * Nobody comes up strong. Every promoted club in the last ten years has
 * been in the bottom half the following May and most of them have gone
 * straight back down, which is why the bottom of the table churns.
 */
export const CHAMPIONSHIP: readonly { name: string; str: number; var: number }[] = [
  { name: 'West Ham', str: 0.33, var: 0.12 },
  { name: 'Wolves', str: 0.31, var: 0.12 },
  { name: 'Burnley', str: 0.3, var: 0.12 },
  { name: 'Leicester', str: 0.31, var: 0.12 },
  { name: 'Southampton', str: 0.29, var: 0.12 },
  { name: 'Middlesbrough', str: 0.28, var: 0.12 },
  { name: 'Norwich', str: 0.27, var: 0.13 },
  { name: 'Sheff Wed', str: 0.25, var: 0.13 },
  { name: 'West Brom', str: 0.27, var: 0.13 },
  { name: 'Watford', str: 0.26, var: 0.13 },
  { name: 'Stoke', str: 0.25, var: 0.13 },
  { name: 'Preston', str: 0.24, var: 0.13 },
  { name: 'Blackburn', str: 0.26, var: 0.13 },
  { name: 'Millwall', str: 0.24, var: 0.13 },
  { name: 'QPR', str: 0.23, var: 0.13 },
  { name: 'Bristol City', str: 0.25, var: 0.13 },
  { name: 'Swansea', str: 0.23, var: 0.13 },
  { name: 'Cardiff', str: 0.22, var: 0.13 },
  { name: 'Derby', str: 0.22, var: 0.13 },
  { name: 'Plymouth', str: 0.2, var: 0.14 },
  { name: 'Portsmouth', str: 0.22, var: 0.13 },
  { name: 'Charlton', str: 0.21, var: 0.13 },
  { name: 'Wrexham', str: 0.23, var: 0.14 },
  { name: 'Birmingham', str: 0.24, var: 0.13 },
];

/**
 * Who comes up when the club you manage is one of the nineteen.
 *
 * Taking Arsenal in a career and then finding Arsenal in your own league
 * table, and playing yourself twice, is not a league. The club you manage
 * is removed and a promoted side takes the place, which is exactly what
 * happens in a real division.
 */
const PROMOTED: readonly { name: string; str: number; var: number }[] = [
  { name: 'Leicester', str: 0.36, var: 0.11 },
  { name: 'Southampton', str: 0.32, var: 0.12 },
  { name: 'Ipswich', str: 0.29, var: 0.12 },
  { name: 'Burnley', str: 0.31, var: 0.11 },
  { name: 'Sheffield United', str: 0.3, var: 0.12 },
  { name: 'Norwich', str: 0.33, var: 0.11 },
  { name: 'Watford', str: 0.34, var: 0.11 },
  { name: 'Stoke', str: 0.35, var: 0.11 },
  { name: 'Middlesbrough', str: 0.33, var: 0.12 },
  { name: 'Coventry', str: 0.31, var: 0.12 },
];

/**
 * The nineteen other clubs, given who you are.
 *
 * Nothing changes for the draft, where your XI is nobody's club. In a
 * career the club you manage comes out and the first promoted side that
 * is not already here goes in.
 */
export function leagueFor(
  club?: string | null,
  /** a career carries its own division, which changes every summer */
  own?: readonly { name: string; str: number; var: number }[] | null,
): readonly { name: string; str: number; var: number }[] {
  if (own && own.length) return own;
  if (!club) return SIM_LEAGUE;
  const i = SIM_LEAGUE.findIndex((t) => t.name === club);
  if (i < 0) return SIM_LEAGUE;
  const up = PROMOTED.find(
    (r) => r.name !== club && !SIM_LEAGUE.some((t) => t.name === r.name),
  );
  const rest = SIM_LEAGUE.filter((_, j) => j !== i);
  return up ? [...rest, up] : rest;
}

/**
 * The other nineteen seasons.
 *
 * 2.93 goals a game across the 2024/25 Premier League, split between the
 * two sides, and home teams score about a seventh more than away ones.
 * The spread is what turns a strength gap into a scoreline gap.
 */
const LEAGUE_MEAN = 1.28;
const LEAGUE_SPREAD = 1.95;
const HOME_EDGE = 1.14;

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

/**
 * How many of the nineteen clubs your XI is stronger than.
 *
 * The projection says where you should finish; this says who you are better
 * than, which is the same fact told in the way a football fan asks it.
 */
export function strongerThan(avg: number, chem: number): number {
  const str = strFromAvg(avg + chem);
  return SIM_LEAGUE.filter((t) => t.str < str).length;
}

/** The headline a projected finish deserves. */
export function verdictFor(projFinish: number): string {
  if (projFinish === 1) return 'Title favourites';
  if (projFinish <= 4) return 'Champions League push';
  if (projFinish <= 7) return 'European contenders';
  if (projFinish <= 14) return 'Mid-table';
  if (projFinish <= 17) return 'A survival fight';
  return 'Relegation favourites';
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

/**
 * How likely this player is to be the one who scores.
 *
 * The clamp matters. A rating under 60 made the base negative, and a
 * negative number to a fractional power is NaN in JavaScript, which
 * poisoned the total, made every comparison in the roulette below false,
 * and quietly handed the goal to whoever happened to be last in the list.
 * One promoted academy player in the squad was enough to give him 52 of
 * the team's 59 goals while a striker finished on none.
 */
function scoreWeight(rtg: number, base: number, curve: number): number {
  return base * Math.max(0.15, Math.pow(Math.max(0, rtg - 60) / 30, curve));
}

/** Better players score more, but a defender can still nick one. */
function genScorers(
  numGoals: number,
  players: Slot[],
  stats: Record<string, PlayerStat>,
  rnd: Rng,
): Scorer[] {
  const scorers: Scorer[] = [];
  for (let i = 0; i < numGoals; i++) {
    const weights = players.map((s) =>
      scoreWeight(s.player!.rtg, GOAL_WEIGHT[s.pos] ?? 0.1, 1.5),
    );
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
        const aw = pool.map((s) =>
          scoreWeight(s.player!.rtg, GOAL_WEIGHT[s.pos] ?? 0.1, 1.3),
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

export type Verdict = { headline: string; quote: string; source: string };

/**
 * The morning papers.
 *
 * Carried over from the web build's staticVerdict, with its em-dashes
 * removed. A grade tells you how you did; this tells you what it felt like,
 * and it is the difference between a results screen and a scoreboard.
 */
export function verdict(r: {
  position: number;
  pts: number;
  wins: number;
  draws: number;
  losses: number;
}): Verdict {
  const { position: pos, pts, draws, losses } = r;
  const ord = ordinal(pos);

  if (!losses && !draws)
    return {
      headline: 'A Perfect Season',
      quote:
        'Flawless. Thirty-eight games, thirty-eight wins. Nothing more can be asked of any side.',
      source: 'Sky Sports',
    };
  if (pos === 1 && !losses)
    return {
      headline: 'The New Invincibles',
      quote:
        'Unbeaten champions. A campaign that will be spoken about for decades. Truly historic.',
      source: 'BBC Sport',
    };
  if (pos === 1 && pts >= 90)
    return {
      headline: 'Dominant from Start to Finish',
      quote: `${pts} points. The relentlessness was extraordinary. This team never gave the rest a chance.`,
      source: 'The Athletic',
    };
  if (pos === 1)
    return {
      headline: 'Worthy Champions',
      quote: `A deserved title. From the opening weeks it was clear this was a side of rare quality, and ${pts} points confirms it.`,
      source: 'The Athletic',
    };
  if (pos === 2)
    return {
      headline: 'So Close to Glory',
      quote: `Second with ${pts} points. The quality was never in doubt but the title slipped away. A whisker from history.`,
      source: 'Guardian Sport',
    };
  if (pos <= 4)
    return {
      headline: 'Top Four Secured',
      quote: `Champions League football confirmed. ${pts} points and a ${ord} place finish reflects genuine quality throughout the campaign.`,
      source: 'Telegraph',
    };
  if (pos <= 7)
    return {
      headline: 'European Nights Return',
      quote: `${ord} place and European football. There were glimpses of real class but inconsistency cost a tilt at the top four.`,
      source: 'Mail Sport',
    };
  if (pos <= 14)
    return {
      headline: 'Mid-Table Mediocrity',
      quote: `A ${ord} place finish on ${pts} points. The talent was there but it never clicked. A season to forget.`,
      source: 'BBC Sport',
    };
  if (pos <= 17)
    return {
      headline: 'Survival, but at what cost?',
      quote: `Scraped through in ${ord}. The talent on paper made this campaign a grave disappointment. Change is needed.`,
      source: 'Sky Sports',
    };
  return {
    headline: 'Relegation. A Stunning Collapse',
    quote: `Down in ${ord} on just ${pts} points. One of the most shocking collapses the league has ever witnessed.`,
    source: 'Guardian Sport',
  };
}

export type Award = { name: string; value: number; extra?: number } | null;

/**
 * The three end of season awards, as the web build works them out.
 *
 * The glove goes to a goalkeeper if there is one in the XI, because a
 * centre back with the same clean sheets did not keep them.
 */
export function awards(
  stats: Record<string, PlayerStat>,
  squad: Slot[],
): { pots: Award; boot: Award; playmaker: Award; glove: Award } {
  const rows = Object.entries(stats).map(([name, s]) => ({ name, ...s }));
  if (!rows.length) return { pots: null, boot: null, playmaker: null, glove: null };

  const boot = [...rows].sort((a, b) => b.g - a.g || b.a - a.a)[0];
  // Goals count for most, assists next, a clean sheet for something. The
  // web build weights it exactly this way, so the same XI wins it in both.
  const pots = [...rows].sort(
    (a, b) => b.g * 3 + b.a * 2 + b.cs - (a.g * 3 + a.a * 2 + a.cs),
  )[0];
  const playmaker = [...rows].sort((a, b) => b.a - a.a || b.g - a.g)[0];

  const keepers = new Set(
    squad.filter((s) => s.player && s.pos === 'GK').map((s) => s.player!.n),
  );
  const gkRows = rows.filter((r) => keepers.has(r.name));
  const glove = [...(gkRows.length ? gkRows : rows)].sort((a, b) => b.cs - a.cs)[0];

  return {
    pots: pots ? { name: pots.name, value: pots.g, extra: pots.a } : null,
    boot: boot.g > 0 ? { name: boot.name, value: boot.g } : null,
    playmaker: playmaker.a > 0 ? { name: playmaker.name, value: playmaker.a } : null,
    glove: glove && glove.cs > 0 ? { name: glove.name, value: glove.cs } : null,
  };
}

/**
 * Where the XI would sit if the season stopped now.
 *
 * The other nineteen played their own full season, so their points are
 * pro-rated to the games you have actually played. Without this the table
 * position is meaningless until the very last match.
 */
export function livePosition(pts: number, played: number, table: TableRow[]): number {
  if (played <= 0) return table.length;
  const share = played / 38;
  const better = table.filter((r) => !r.isYou && r.pts * share > pts).length;
  return better + 1;
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
  /** the club you manage, so it is not also one of your opponents */
  club?: string | null,
  /** the nineteen this career is actually playing, if it has its own */
  own?: readonly { name: string; str: number; var: number }[] | null,
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

  const league = leagueFor(club, own);

  // Home and away against all nineteen, drawn so a club is not played twice
  // in a row: shuffle each half, then alternate them.
  const homeFx = shuffle(
    league.map((t) => ({ team: t, home: true })),
    rnd,
  );
  const awayFx = shuffle(
    league.map((t) => ({ team: t, home: false })),
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
  const others: TableRow[] = league.map((t) => {
    let w = 0;
    let d = 0;
    let l = 0;
    let tgf = 0;
    let tga = 0;
    const teamStr = Math.max(0.2, Math.min(0.98, t.str + (rnd() - 0.5) * t.var * 1.6));
    for (let g = 0; g < 38; g++) {
      const oppStr = league[g % league.length].str;
      const home = g < 19;
      /* The nineteen other seasons, scored the way a league actually
         scores. The old version was linear in strength, which made the
         best side score two a game and the worst side eight hundredths of
         one: a hundred point champion and an eight point bottom club, in a
         division where the real numbers are 84 and 12. This is
         multiplicative around the league mean, so a gap in quality is a
         ratio rather than a subtraction and nobody falls off the end. */
      const edge = Math.exp(LEAGUE_SPREAD * (teamStr - oppStr));
      const g1 = poissonR(LEAGUE_MEAN * edge * (home ? HOME_EDGE : 1 / HOME_EDGE), rnd);
      const g2 = poissonR(LEAGUE_MEAN / edge / (home ? HOME_EDGE : 1 / HOME_EDGE), rnd);
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

/**
 * What a squad of this quality is supposed to finish.
 *
 * The web build's curve, carried over unchanged. It is deliberately coarser
 * than the odds card: the odds say where the maths puts you, this says what
 * would count as a good season, and the gap between the two is the whole
 * point of the results screen.
 */
export function expectedFinish(avg: number): number {
  if (avg >= 90) return 1;
  if (avg >= 87) return 2;
  if (avg >= 84) return 4;
  if (avg >= 81) return 7;
  if (avg >= 77) return 11;
  if (avg >= 73) return 15;
  return 18;
}

export type Expectation = {
  expected: number;
  /** how the expectation reads in words: "the title", "top 4", "mid-table" */
  label: string;
  verdict: 'over' | 'met' | 'under';
  /** places better than expected, negative for worse */
  diff: number;
};

export function expectation(avg: number, pos: number): Expectation {
  const expected = expectedFinish(avg);
  const diff = expected - pos;
  const label =
    expected === 1
      ? 'the title'
      : expected <= 4
        ? `top ${expected}`
        : expected <= 8
          ? 'top 8'
          : expected <= 14
            ? 'mid-table'
            : 'a relegation battle';
  return {
    expected,
    label,
    diff,
    verdict: diff >= 1 ? 'over' : diff <= -1 ? 'under' : 'met',
  };
}

export type FinishTone = 'gold' | 'silver' | 'ucl' | 'europa' | 'mid' | 'low' | 'rel';

export type Finish = {
  title: string;
  sub: string;
  mark: string;
  tone: FinishTone;
};

/**
 * The headline the season earned, in the site's own words.
 *
 * A perfect season and a nineteenth place finish are not the same event and
 * must not arrive on the same card in the same colour.
 */
export function finishFor(r: {
  position: number;
  pts: number;
  draws: number;
  losses: number;
}): Finish {
  const { position: pos, pts, draws, losses } = r;
  const ord = ordinal(pos);
  if (!losses && !draws)
    return {
      title: 'Perfect Season',
      sub: `${pts} pts. Unbeaten, undefeated, flawless.`,
      mark: '🏆',
      tone: 'gold',
    };
  if (pos === 1 && !losses)
    return {
      title: 'Invincible Champions',
      sub: `Champions, unbeaten, ${pts} pts. Immortal.`,
      mark: '🏆',
      tone: 'gold',
    };
  if (pos === 1)
    return {
      title: 'Champions',
      sub: `${pts} pts. Premier League champions.`,
      mark: '🏆',
      tone: 'gold',
    };
  if (pos === 2)
    return {
      title: 'Runners Up',
      sub: `Second on ${pts} pts. So close.`,
      mark: '🥈',
      tone: 'silver',
    };
  if (pos <= 4)
    return {
      title: `Champions League, ${ord}`,
      sub: `${pts} pts. Top four secured.`,
      mark: '🏅',
      tone: 'ucl',
    };
  if (pos <= 6)
    return {
      title: `Europa League, ${ord}`,
      sub: `${pts} pts. European football secured.`,
      mark: '⭐',
      tone: 'europa',
    };
  if (pos === 7)
    return {
      title: 'Conference League, 7th',
      sub: `${pts} pts. European nights, just about.`,
      mark: '⭐',
      tone: 'europa',
    };
  if (pos <= 10)
    return {
      title: `${ord} Place`,
      sub: `${pts} pts. A solid mid-table finish.`,
      mark: '📊',
      tone: 'mid',
    };
  if (pos <= 14)
    return {
      title: `Mid-table, ${ord}`,
      sub: `${pts} pts. An unremarkable campaign.`,
      mark: '📊',
      tone: 'mid',
    };
  if (pos <= 17)
    return {
      title: `Lower Mid-table, ${ord}`,
      sub: `${pts} pts. Survival, and little else.`,
      mark: '😅',
      tone: 'low',
    };
  return {
    title: `Relegated, ${ord}`,
    sub: `${pts} pts. Down to the Championship.`,
    mark: '😔',
    tone: 'rel',
  };
}

export type Highlight = { value: string; label: string };

/** The eight numbers the site puts under Season Highlights. */
export function highlights(r: SeasonResult): Highlight[] {
  const games = r.matches.length || 38;
  const gd = r.gf - r.ga;
  const rows = Object.entries(r.playerStats).map(([n, s]) => ({ n, g: s.g }));
  rows.sort((a, b) => b.g - a.g);
  const top = rows[0];

  return [
    { value: (r.pts / games).toFixed(2), label: 'Points per game' },
    { value: `${Math.round((r.wins / games) * 100)}%`, label: 'Win rate' },
    { value: `${gd >= 0 ? '+' : ''}${gd}`, label: 'Goal difference' },
    { value: (r.gf / games).toFixed(1), label: 'Goals per game' },
    { value: String(r.cleanSheets), label: 'Clean sheets' },
    { value: String(r.longestStreak), label: 'Longest win streak' },
    { value: r.biggestWin ?? '0-0', label: 'Biggest win' },
    {
      value: top ? `${lastName(top.n)} (${top.g})` : '0',
      label: 'Top scorer',
    },
  ];
}
