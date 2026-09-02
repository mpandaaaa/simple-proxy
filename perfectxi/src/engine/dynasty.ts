import type { Position, Slot } from './types';
import type { Rng } from './rng';
import { mulberry32 } from './rng';
import { AGE_CURVES, DOB } from '../data/dynasty';

/**
 * The Dynasty ageing engine.
 *
 * Ported from the web build's Dynasty 3.0 without changing a number. Every
 * curve, weight and threshold here is tuned and balanced against the rest
 * of the game, and the comment the site carries about its sources is worth
 * keeping: ageing is position specific and split across three attribute
 * tracks, because physical peaks early and falls fast, technical holds,
 * and mental keeps rising. Dendir 2016, Rey et al. 2022, Branquinho 2025,
 * UEFA injury data.
 *
 * Two departures from the site, both deliberate. Every random draw comes
 * from a seeded generator rather than Math.random, so a career can be
 * replayed and verified the way a season can. And the position curves come
 * from the shipped database rather than being written out again here,
 * because there should be one copy of a tuned number.
 *
 * Pure. Nothing in this file knows what a screen is.
 */

/** How much a position is worth in the transfer market. */
const POS_VALUE: Record<Position, number> = { ATT: 1.15, MID: 1.05, DEF: 0.9, GK: 0.75 };

export type Contract = { yrs: number; wage: number };

export type DynastyPlayer = {
  n: string;
  nat: string;
  pos: Position;
  /** the club and season he was drafted from, kept for the badge */
  club: string;
  season: string;
  rtg: number;
  age: number;
  /** the three tracks the rating is blended from */
  phys: number;
  tech: number;
  ment: number;
  pot: number;
  /** this player's own peak, a few years either side of the position's */
  peakOff: number;
  /** how fast this player in particular falls away */
  declMul: number;
  /** how prone he is to injury */
  prone: number;
  contract: Contract;
  apps: number;
  goals: number;
  /** seasons lost to injury, which leaves a permanent mark */
  injHist: number;
  /** the change in rating from the last ageing, for the report */
  delta: number;
  retired: boolean;
};

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

/** Box-Muller, so the noise is normal rather than flat. */
function gauss(rnd: Rng): number {
  const u = 1 - rnd();
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function rint(a: number, b: number, rnd: Rng): number {
  return a + Math.floor(rnd() * (b - a + 1));
}

function curve(pos: Position) {
  return AGE_CURVES[pos] ?? AGE_CURVES.MID;
}

/** The overall, blended from the three tracks by the position's weights. */
export function overall(p: {
  pos: Position;
  phys: number;
  tech: number;
  ment: number;
}): number {
  const w = curve(p.pos).w;
  return Math.round(clamp(p.phys * w[0] + p.tech * w[1] + p.ment * w[2], 40, 99));
}

/**
 * How old a player was in the season he was drafted from.
 *
 * The database records a birth year and whether he was born after the
 * first of August, which is the convention the ratings were built on. A
 * player the database has never heard of falls back to a plausible age for
 * his position rather than breaking the career.
 */
export function ageIn(name: string, seasonYear: number, pos: Position): number {
  const dob = DOB[name];
  if (!dob) return pos === 'GK' ? 28 : 26;
  const age = seasonYear - dob[0] - dob[1];
  return clamp(age, 16, 44);
}

/** "2003/04" back to 2003. */
export function seasonYear(season: string): number {
  const n = parseInt(season.slice(0, 4), 10);
  return Number.isFinite(n) ? n : 2024;
}

/**
 * Build the three tracks from a single rating and an age.
 *
 * A young player carries more physical than technical and a veteran the
 * reverse, so the same 85 is a different player at 21 and at 33. The
 * tracks are then nudged until they blend back to the rating he arrived
 * with, because the draft already decided how good he is.
 */
export function seedTracks(
  base: Omit<
    DynastyPlayer,
    'phys' | 'tech' | 'ment' | 'pot' | 'peakOff' | 'declMul' | 'prone' | 'delta' | 'retired'
  > & { pot?: number },
  rnd: Rng,
): DynastyPlayer {
  const c = curve(base.pos);
  const youth = clamp((c.phys + 2 - base.age) / 8, -1, 1);

  const p: DynastyPlayer = {
    ...base,
    phys: clamp(Math.round(base.rtg + youth * 4 + gauss(rnd) * 2), 40, 99),
    tech: clamp(Math.round(base.rtg - youth * 3 + gauss(rnd) * 2), 40, 99),
    ment: clamp(Math.round(base.rtg - youth * 4 + gauss(rnd) * 2), 40, 99),
    peakOff: Math.round(clamp(gauss(rnd) * 1.5, -3, 3)),
    declMul: clamp(Math.exp(gauss(rnd) * 0.25), 0.55, 1.8),
    prone: clamp(1 + gauss(rnd) * 0.22, 0.7, 1.5),
    pot: base.pot ?? 0,
    delta: 0,
    retired: false,
  };

  if (!base.pot) {
    const head = Math.max(0, c.phys + p.peakOff - p.age);
    p.pot = clamp(
      Math.round(base.rtg + (head > 0 ? rint(2, 10, rnd) : rint(0, 3, rnd)) + gauss(rnd) * 3),
      base.rtg,
      99,
    );
  }

  // Nudge all three until the blend matches the rating he came in with.
  let got = overall(p);
  let guard = 0;
  while (got !== base.rtg && guard < 40) {
    const step = base.rtg > got ? 1 : -1;
    p.phys = clamp(p.phys + step, 35, 99);
    p.tech = clamp(p.tech + step, 35, 99);
    p.ment = clamp(p.ment + step, 35, 99);
    got = overall(p);
    guard++;
  }
  p.rtg = overall(p);
  return p;
}

/** One season of ageing for one track. */
function trackStep(
  cur: number,
  pot: number,
  age: number,
  peak: number,
  kind: 'phys' | 'tech' | 'ment',
  declMul: number,
  rnd: Rng,
): number {
  let d: number;
  if (age < peak) {
    // Growth towards potential, fastest when furthest away.
    const gap = Math.max(0, pot - cur);
    d = gap * 0.3 * (kind === 'phys' ? 1.1 : kind === 'tech' ? 1.0 : 0.85);
    d = Math.min(d, 4.5);
  } else {
    const past = age - peak;
    if (kind === 'phys') {
      d = -(past <= 2 ? 0.5 : past <= 5 ? 1.5 : past <= 7 ? 2.6 : 3.6) * declMul;
    } else if (kind === 'tech') {
      d = past <= 1 ? 0.25 : past <= 4 ? 0 : -0.5 * declMul;
    } else {
      d = past <= 4 ? 0.35 : past <= 7 ? 0.1 : -0.35 * declMul;
    }
  }
  return clamp(cur + d + gauss(rnd) * 0.6, 35, 99);
}

/**
 * Put one player through a season.
 *
 * The rating cannot move more than six either way in one year, which is
 * what stops a career turning over in a single summer.
 */
export function ageOne(p: DynastyPlayer, rnd: Rng): DynastyPlayer {
  const c = curve(p.pos);
  const off = p.peakOff;
  const m = p.declMul;
  const before = p.rtg;

  const next: DynastyPlayer = {
    ...p,
    age: p.age + 1,
    phys: trackStep(p.phys, p.pot, p.age, c.phys + off, 'phys', m * c.dec, rnd),
    tech: trackStep(p.tech, p.pot, p.age, c.tech + off, 'tech', m, rnd),
    ment: trackStep(p.ment, p.pot, p.age, c.ment + off, 'ment', m, rnd),
  };

  // Injury history leaves a permanent mark on the physical track.
  if (next.injHist) next.phys = clamp(next.phys - next.injHist * 0.6, 35, 99);

  next.rtg = overall(next);
  if (next.rtg - before > 6) next.rtg = before + 6;
  if (next.rtg - before < -6) next.rtg = before - 6;
  next.delta = next.rtg - before;
  return next;
}

/**
 * The chance a player walks away at the end of this season.
 *
 * Age sets the baseline and quality decides who actually goes: a 99 is
 * about ten times less likely to retire than a 70 at the same age, which
 * is why the great ones play into their late thirties and fringe players
 * drift out at thirty two.
 */
export function retireOdds(p: DynastyPlayer): number {
  const a = p.age - (curve(p.pos).ret ?? 0);
  if (a < 31) return 0;

  let base =
    a === 31 ? 0.01
    : a === 32 ? 0.04
    : a === 33 ? 0.1
    : a === 34 ? 0.2
    : a === 35 ? 0.33
    : a === 36 ? 0.48
    : a === 37 ? 0.64
    : a === 38 ? 0.8
    : a === 39 ? 0.91
    : 0.97;

  base *= clamp((80 - p.rtg) / 12 + 1, 0.07, 1.9);

  // Form buys a great player years and a fringe player months.
  if (p.rtg < 82 && a >= 34) base = Math.max(base, 0.1 + (a - 34) * 0.09);
  // A body eventually gives out however good the player is.
  if (a >= 39) base = Math.max(base, 0.35);
  if (a >= 41) base = Math.max(base, 0.7);
  if (a >= 43) base = Math.max(base, 0.92);

  if (p.injHist) base *= 1 + Math.min(1.2, p.injHist * 0.3);
  if (p.rtg < 62 && a > 33) base *= 1.6;

  return clamp(base, 0, 0.97);
}

/* ---------- what a player is worth, and what he costs ---------- */

const AGE_VALUE: readonly [number, number][] = [
  [18, 0.86], [19, 0.92], [20, 0.96], [21, 0.99], [22, 1.0], [23, 1.0],
  [24, 0.97], [25, 0.93], [26, 0.88], [27, 0.82], [28, 0.72], [29, 0.62],
  [30, 0.52], [31, 0.41], [32, 0.31], [33, 0.22], [34, 0.15], [35, 0.09],
  [36, 0.05],
];

function ageValueMul(age: number): number {
  if (age <= 18) return 0.86;
  for (const [a, m] of AGE_VALUE) if (a === age) return m;
  return 0.03;
}

function contractMul(yrs: number): number {
  return yrs >= 4 ? 1.0 : yrs === 3 ? 0.87 : yrs === 2 ? 0.7 : yrs === 1 ? 0.45 : 0.05;
}

/**
 * Transfer value in £m.
 *
 * The sixth power is what makes the top of the market vertical: 70 is
 * worth £24m, 85 is £77m, and a 92 at his peak is about £125m. Do not
 * flatten it. That shape is the whole reason a great player feels
 * unaffordable.
 */
export function value(rtg: number, age: number, pos: Position, yrs = 3): number {
  const base = Math.pow(Math.max(0, rtg) / 50, 6) * 2.78;
  return Math.max(1, Math.round(base * ageValueMul(age) * contractMul(yrs) * POS_VALUE[pos]));
}

export function playerValue(p: DynastyPlayer): number {
  return value(p.rtg, p.age, p.pos, p.contract.yrs);
}

/** Weekly wage in thousands. A 65 rated squad player is about £30k, a 90 about £290k. */
export function wage(rtg: number, age: number): number {
  let w = Math.pow(Math.max(40, rtg) / 50, 6) * 7.0;
  if (age < 21) w *= 0.45;
  else if (age < 24) w *= 0.75;
  else if (age > 32) w *= 0.85;
  return Math.max(3, Math.round(w));
}

/* ---------- the career ---------- */

export type Dynasty = {
  seed: number;
  club: string;
  /** the season number, starting at 1 */
  year: number;
  formation: string;
  squad: DynastyPlayer[];
  /** everyone who has retired out of this career, newest first */
  retired: DynastyPlayer[];
  /** one entry per season played */
  seasons: {
    year: number;
    position: number;
    pts: number;
    w: number;
    d: number;
    l: number;
    gf: number;
    ga: number;
  }[];
  titles: number;
};

/** A seed of the career's own, so ageing never disturbs a season's draw. */
function careerSeed(seed: number, year: number): number {
  let h = (seed ^ Math.imul(year + 1, 0x27d4eb2f)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2545f491) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}

/** Take a finished XI and make a career out of it. */
export function startDynasty(squad: Slot[], formation: string, club: string, seed: number): Dynasty {
  const rnd = mulberry32(careerSeed(seed, 0));
  const players: DynastyPlayer[] = [];

  for (const slot of squad) {
    if (!slot.player) continue;
    const p = slot.player;
    const age = ageIn(p.n, seasonYear(p.season), slot.pos);
    players.push(
      seedTracks(
        {
          n: p.n,
          nat: p.nat,
          pos: slot.pos,
          club: p.club,
          season: p.season,
          rtg: p.rtg,
          age,
          contract: { yrs: rint(2, 4, rnd), wage: wage(p.rtg, age) },
          apps: 0,
          goals: 0,
          injHist: 0,
        },
        rnd,
      ),
    );
  }

  return {
    seed,
    club,
    year: 1,
    formation,
    squad: players,
    retired: [],
    seasons: [],
    titles: 0,
  };
}

export type AgeingReport = {
  improved: DynastyPlayer[];
  declined: DynastyPlayer[];
  retired: DynastyPlayer[];
  /** the squad average before and after */
  before: number;
  after: number;
};

/**
 * Roll the career on one year.
 *
 * Everyone ages, contracts run down, and the ones the hazard catches
 * retire. The report is what the player actually reads: who got better,
 * who fell away, and who is gone.
 */
export function advanceSeason(d: Dynasty): { dynasty: Dynasty; report: AgeingReport } {
  const rnd = mulberry32(careerSeed(d.seed, d.year));
  const before = squadRating(d.squad);

  const kept: DynastyPlayer[] = [];
  const gone: DynastyPlayer[] = [];
  const improved: DynastyPlayer[] = [];
  const declined: DynastyPlayer[] = [];

  for (const p of d.squad) {
    const aged = ageOne(p, rnd);
    aged.contract = {
      yrs: Math.max(0, aged.contract.yrs - 1),
      wage: wage(aged.rtg, aged.age),
    };

    if (rnd() < retireOdds(aged)) {
      gone.push({ ...aged, retired: true });
      continue;
    }
    kept.push(aged);
    if (aged.delta > 0) improved.push(aged);
    else if (aged.delta < 0) declined.push(aged);
  }

  improved.sort((a, b) => b.delta - a.delta);
  declined.sort((a, b) => a.delta - b.delta);

  return {
    dynasty: {
      ...d,
      year: d.year + 1,
      squad: kept,
      retired: [...gone, ...d.retired],
    },
    report: {
      improved,
      declined,
      retired: gone,
      before,
      after: squadRating(kept),
    },
  };
}

export function squadRating(squad: readonly DynastyPlayer[]): number {
  if (!squad.length) return 0;
  return Math.round(squad.reduce((s, p) => s + p.rtg, 0) / squad.length);
}

/** Total transfer value of the squad, in £m. */
export function squadValue(squad: readonly DynastyPlayer[]): number {
  return squad.reduce((s, p) => s + playerValue(p), 0);
}

/** The wage bill for a season, in £m. Wages are weekly and in thousands. */
export function wageBill(squad: readonly DynastyPlayer[]): number {
  return Math.round((squad.reduce((s, p) => s + p.contract.wage, 0) * 52) / 1000);
}

/** The XI as the match engine wants it, so a dynasty season uses the same maths. */
export function asSquad(squad: readonly DynastyPlayer[]): Slot[] {
  return squad.map((p) => ({
    pos: p.pos,
    player: {
      n: p.n,
      nat: p.nat,
      pos: [p.pos],
      rtg: p.rtg,
      club: p.club,
      season: p.season,
    },
  }));
}
