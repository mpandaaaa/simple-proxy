import { SQUADS } from '../data/squads';
import { ALL_KEYS, seasonStr } from './draft';
import { dcExpected, poissonR, strFromAvg } from './sim';
import { mulberry32, type Rng } from './rng';
import type { DbPlayer } from './types';

/**
 * A knockout between sixteen sides from anywhere in the database.
 *
 * The two tournaments answer "what if this nation" and "what if this
 * club, this year". This answers the argument everybody actually has:
 * the Invincibles against Guardiola's City, 1995 Blackburn against 2016
 * Leicester, in a bracket, until one of them is left.
 *
 * Sixteen, one match a round, four rounds, no away goals and no second
 * legs, because the whole point is that every tie is one night. Extra
 * time and penalties settle a draw, the same way they settle a knockout
 * anywhere else in this app.
 *
 * Pure and seeded. Nothing here knows what a screen is.
 */

export type CupSide = {
  /** the club-season key, "Arsenal|2003" */
  key: string;
  club: string;
  /** the season in words, 2003/04 */
  season: string;
  /** squad rating on the same scale as everything else */
  rating: number;
};

export type CupRound = 'r16' | 'qf' | 'sf' | 'final' | 'done';

export const CUP_ROUND_NAME: Record<CupRound, string> = {
  r16: 'Round of 16',
  qf: 'Quarter-Final',
  sf: 'Semi-Final',
  final: 'Final',
  done: 'Over',
};

export const CUP_ROUNDS: readonly CupRound[] = ['r16', 'qf', 'sf', 'final'];

export type CupMatch = {
  round: CupRound;
  /** which tie of that round, from nought */
  n: number;
  /** the two sides. `a` is yours in your own ties. */
  a: string;
  b: string;
  ga: number;
  gb: number;
  ga90: number;
  gb90: number;
  et: boolean;
  pens: { a: number; b: number } | null;
  played: boolean;
};

export type CupRun = {
  seed: number;
  /** the sixteen, in bracket order */
  field: string[];
  /** the one you are following */
  you: string;
  round: CupRound;
  /** who is left, in bracket order */
  alive: string[];
  played: CupMatch[];
  /** the tie in front of you, or null when it is over */
  ahead: CupMatch | null;
  /** every result of every tie, for the bracket screen */
  results: CupMatch[];
  over: boolean;
  won: boolean;
  outAt: CupRound | null;
};

/* ---------- who can enter ---------- */

const cache = new Map<string, CupSide>();

/** A club-season as an entrant, or null if the database has no such thing. */
export function cupSide(key: string): CupSide | null {
  const held = cache.get(key);
  if (held) return held;

  const squad = SQUADS[key] as DbPlayer[] | undefined;
  if (!squad || squad.length < 11) return null;

  const bar = key.indexOf('|');
  const club = key.slice(0, bar);
  const year = Number(key.slice(bar + 1));
  if (!Number.isFinite(year)) return null;

  /* The best eleven, which is what a club would put out for one match. */
  const best = [...squad].sort((a, b) => b.rtg - a.rtg).slice(0, 11);
  const rating = Math.round(best.reduce((s, p) => s + p.rtg, 0) / best.length);

  const side: CupSide = { key, club, season: seasonStr(year), rating };
  cache.set(key, side);
  return side;
}

export function cupSquad(key: string): DbPlayer[] {
  return (SQUADS[key] as DbPlayer[] | undefined) ?? [];
}

let ranked: CupSide[] | null = null;

/** Every club-season worth entering, strongest first. */
export function cupField(): CupSide[] {
  if (ranked) return ranked;
  const out: CupSide[] = [];
  for (const key of ALL_KEYS) {
    const side = cupSide(key);
    if (side) out.push(side);
  }
  out.sort((a, b) => b.rating - a.rating || a.club.localeCompare(b.club) || a.season.localeCompare(b.season));
  ranked = out;
  return out;
}

/**
 * The strongest sixteen, one per club.
 *
 * Without the one per club rule this is eight Manchester Cities and the
 * bracket answers nothing. One season each makes it the argument it is
 * supposed to be.
 */
export function strongestSixteen(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const side of cupField()) {
    if (seen.has(side.club)) continue;
    seen.add(side.club);
    out.push(side.key);
    if (out.length === 16) break;
  }
  return out;
}

const yearOf = (key: string) => Number(key.slice(key.indexOf('|') + 1));

/** Each club's best season inside a window, strongest club first. */
function bestPerClub(from: number, to: number): CupSide[] {
  const best = new Map<string, CupSide>();
  for (const side of cupField()) {
    const y = yearOf(side.key);
    if (y < from || y > to) continue;
    const held = best.get(side.club);
    if (!held || side.rating > held.rating) best.set(side.club, side);
  }
  return [...best.values()].sort((a, b) => b.rating - a.rating || a.club.localeCompare(b.club));
}

/*
 * The four eras the database covers.
 *
 * Ratings drift upwards across thirty five seasons, so the strongest
 * sixteen outright is almost entirely the last few years and the bracket
 * answers nothing anybody wanted to ask. Four from each era is the
 * argument people actually have.
 */
const ERAS: readonly [number, number][] = [
  [1992, 1999],
  [2000, 2009],
  [2010, 2019],
  [2020, 2026],
];

/** Four from each era, best of their club, spread across thirty five seasons. */
export function spreadSixteen(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const [from, to] of ERAS) {
    let taken = 0;
    for (const side of bestPerClub(from, to)) {
      if (seen.has(side.club)) continue;
      seen.add(side.club);
      out.push(side.key);
      if (++taken === 4) break;
    }
  }
  if (out.length < 16) {
    for (const key of strongestSixteen()) {
      if (out.indexOf(key) < 0) out.push(key);
      if (out.length === 16) break;
    }
  }
  return out.slice(0, 16);
}

/**
 * Sixteen drawn out of an era.
 *
 * One season per club, and drawn from the best two dozen of the era
 * rather than from all of it. A flat draw over an era is mostly the
 * clubs that were relegated out of it, and a bracket of those is not a
 * bracket anybody wants to watch.
 */
export function drawSixteen(from: number, to: number, seed: number): string[] {
  const rnd = mulberry32(seed >>> 0);
  const pool = bestPerClub(from, to).slice(0, 24);

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = pool[i];
    pool[i] = pool[j];
    pool[j] = t;
  }

  const out = pool.slice(0, 16).map((s) => s.key);

  /* An era too small to fill a bracket is topped up rather than handed
     back short. */
  if (out.length < 16) {
    for (const key of spreadSixteen()) {
      if (out.indexOf(key) < 0) out.push(key);
      if (out.length === 16) break;
    }
  }
  return out.slice(0, 16);
}

/* ---------- one tie ---------- */

/**
 * One match, and whatever it takes to settle it.
 *
 * The same Dixon-Coles expectation and the same Poisson draw as
 * everywhere else, on neutral ground, because a bracket like this is
 * played nowhere in particular.
 */
export function playTie(
  a: string,
  b: string,
  rnd: Rng,
): { ga: number; gb: number; ga90: number; gb90: number; et: boolean; pens: { a: number; b: number } | null } {
  const ra = cupSide(a)?.rating ?? 74;
  const rb = cupSide(b)?.rating ?? 74;
  const sa = strFromAvg(ra);
  const sb = strFromAvg(rb);
  const { lam, mu } = dcExpected(sa, sb, 'neutral', null);

  let ga = poissonR(lam, rnd);
  let gb = poissonR(mu, rnd);
  const ga90 = ga;
  const gb90 = gb;
  if (ga !== gb) return { ga, gb, ga90, gb90, et: false, pens: null };

  ga += poissonR(lam / 3, rnd);
  gb += poissonR(mu / 3, rnd);
  if (ga !== gb) return { ga, gb, ga90, gb90, et: true, pens: null };

  const edge = 0.5 + (sa - sb) * 0.35;
  let pa = 0;
  let pb = 0;
  for (let i = 0; i < 5; i++) {
    if (rnd() < 0.76 + edge * 0.06) pa++;
    if (rnd() < 0.82 - edge * 0.06) pb++;
  }
  let guard = 0;
  while (pa === pb && guard++ < 20) {
    if (rnd() < 0.74 + edge * 0.06) pa++;
    if (rnd() < 0.8 - edge * 0.06) pb++;
  }
  if (pa === pb) pa++;
  return { ga, gb, ga90, gb90, et: true, pens: { a: pa, b: pb } };
}

/* ---------- the bracket ---------- */

function fixtureFor(alive: string[], you: string, round: CupRound): CupMatch | null {
  const at = alive.indexOf(you);
  if (at < 0) return null;
  const other = alive.length - 1 - at;
  const opp = alive[other];
  if (!opp || opp === you) return null;
  return {
    round,
    n: Math.min(at, other),
    a: you,
    b: opp,
    ga: 0,
    gb: 0,
    ga90: 0,
    gb90: 0,
    et: false,
    pens: null,
    played: false,
  };
}

export function cupStart(field: string[], you: string, seed: number): CupRun {
  const sixteen = field.slice(0, 16);
  return {
    seed: seed >>> 0,
    field: sixteen,
    you,
    round: 'r16',
    alive: sixteen,
    played: [],
    ahead: fixtureFor(sixteen, you, 'r16'),
    results: [],
    over: false,
    won: false,
    outAt: null,
  };
}

function rngFor(run: CupRun, n: number): Rng {
  return mulberry32((run.seed ^ Math.imul(n + 1, 0x9e3779b9)) >>> 0);
}

export type CupPlayed = { run: CupRun; match: CupMatch };

/**
 * Play your tie, and everybody else's in the same round.
 *
 * The rest of the round has to be settled at the same time, because the
 * bracket screen shows all of it and the next opponent has to be a real
 * one rather than a guess.
 */
export function cupPlayNext(run: CupRun): CupPlayed | null {
  if (run.over || !run.ahead) return null;

  const rnd = rngFor(run, run.played.length);
  const fixture = run.ahead;
  const r = playTie(fixture.a, fixture.b, rnd);
  const match: CupMatch = { ...fixture, ...r, played: true };

  const alive = run.alive;
  const next: string[] = [];
  const results: CupMatch[] = [];
  for (let i = 0; i < alive.length / 2; i++) {
    const a = alive[i];
    const b = alive[alive.length - 1 - i];
    if (a === run.you || b === run.you) {
      const won = match.pens ? match.pens.a > match.pens.b : match.ga > match.gb;
      next.push(won ? run.you : fixture.b);
      results.push(match);
      continue;
    }
    const other = playTie(a, b, rnd);
    const aWon = other.pens ? other.pens.a > other.pens.b : other.ga > other.gb;
    next.push(aWon ? a : b);
    results.push({
      round: fixture.round,
      n: i,
      a,
      b,
      ...other,
      played: true,
    });
  }

  const won = match.pens ? match.pens.a > match.pens.b : match.ga > match.gb;
  const after: CupRun = {
    ...run,
    played: [...run.played, match],
    results: [...run.results, ...results],
    alive: next,
  };

  if (!won) {
    return {
      run: { ...after, over: true, outAt: fixture.round, ahead: null, round: 'done' },
      match,
    };
  }
  if (fixture.round === 'final') {
    return {
      run: { ...after, over: true, won: true, outAt: 'final', ahead: null, round: 'done' },
      match,
    };
  }

  const round = CUP_ROUNDS[CUP_ROUNDS.indexOf(fixture.round) + 1] ?? 'final';
  return {
    run: { ...after, round, ahead: fixtureFor(next, run.you, round) },
    match,
  };
}

/** How far a run got, nought for the first round and four for the trophy. */
export function cupReached(run: CupRun): number {
  if (run.won) return 4;
  const at = CUP_ROUNDS.indexOf(run.outAt ?? 'r16');
  return at < 0 ? 0 : at;
}
