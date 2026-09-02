import type { Rng } from './rng';
import type { Position } from './types';
import type { Dynasty, DynastyPlayer } from './dynasty';

/**
 * Match ratings, without simulating a single event.
 *
 * The web build derives them the way the real providers do: a baseline
 * around six and a half, then terms for the result, for goals conceded if
 * you are paid to stop them, for goals and assists if you are paid to
 * score them, for how good the player is, and noise at the spread actually
 * observed in the published data.
 *
 * Calibrated so the population averages 6.70, an elite attacker 7.77, an
 * elite keeper 7.15 and an ordinary midfielder 6.66. A hat-trick and an
 * assist reaches about 9.8; a keeper beaten six times drops to 2.3.
 *
 * Ported unchanged. Pure.
 */

const R = {
  BASE: 6.52,
  NOISE: 0.7,
  RESULT: { win: 0.3, draw: 0, loss: -0.25 } as Record<string, number>,
  RESULT_W: { GK: 1.15, DEF: 1.1, MID: 0.9, ATT: 0.65 } as Record<Position, number>,
  CLEAN: { GK: 0.82, DEF: 0.5, MID: 0.13, ATT: 0.02 } as Record<Position, number>,
  CONCEDE: { GK: -0.62, DEF: -0.24, MID: -0.09, ATT: -0.02 } as Record<Position, number>,
  GOAL: { GK: 1.2, DEF: 1.05, MID: 0.8, ATT: 0.62 } as Record<Position, number>,
  ASSIST: 0.52,
  CONTRIB_CAP: 2.6,
  QUALITY_K: 0.35,
  LEAGUE_AVG: 76,
} as const;

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function gauss(rnd: Rng): number {
  const u = 1 - rnd();
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export type MatchContext = {
  res: 'win' | 'draw' | 'loss';
  ga: number;
  goals: number;
  assists: number;
  /** minutes played, so a substitute regresses towards the baseline */
  mins: number;
};

export function matchRating(
  p: { pos: Position; rtg: number },
  ctx: MatchContext,
  rnd: Rng,
): number {
  let r = R.BASE;
  r += (R.RESULT[ctx.res] ?? 0) * (R.RESULT_W[p.pos] ?? 1);
  if (ctx.ga === 0) r += R.CLEAN[p.pos] ?? 0;
  else r += (R.CONCEDE[p.pos] ?? 0) * ctx.ga;

  const contrib = ctx.goals * (R.GOAL[p.pos] ?? 0.9) + ctx.assists * R.ASSIST;
  r += Math.min(R.CONTRIB_CAP, contrib);
  r += R.QUALITY_K * ((p.rtg - R.LEAGUE_AVG) / 10);

  // Better players are steadier, which is most of what "world class" means.
  r += gauss(rnd) * R.NOISE * (p.rtg >= 88 ? 0.82 : p.rtg >= 80 ? 0.92 : 1);

  if (ctx.mins < 90) r = R.BASE + (r - R.BASE) * Math.max(0.25, ctx.mins / 90);
  return clamp(Math.round(r * 10) / 10, 1, 10);
}

/** What a player of this quality is expected to average across a season. */
export function expectedRating(rtg: number): number {
  return clamp(
    Math.round((R.BASE + R.QUALITY_K * ((rtg - R.LEAGUE_AVG) / 10)) * 100) / 100,
    5.8,
    8.0,
  );
}

/**
 * How much a season's form should bend the age curve.
 *
 * Trajectory matters most when a player is young, but a great season has
 * to register at any age. Somebody in the form of his life is not
 * declining, whatever the curve says.
 */
export function perfBeta(age: number): number {
  if (age <= 18) return 0.7;
  if (age <= 21) return 0.58;
  if (age <= 24) return 0.46;
  if (age <= 27) return 0.36;
  if (age <= 30) return 0.28;
  if (age <= 33) return 0.2;
  return 0.12;
}

export type Development = {
  /** how far he still is from his ceiling, 0 to 1 */
  headroom: number;
  /** how much of the season he played, 0.42 to 1 */
  minutes: number;
  /** what his form did to his development, 0.62 to 1.55 */
  perf: number;
  /** how far above or below expectation he played */
  over: number | null;
  expected: number;
};

/**
 * Why a player developed the way he did.
 *
 * Minutes are the dominant lever, headroom is the brake, and the rating
 * signal is regressed halfway back to expectation so one hot season is not
 * mistaken for a permanent leap.
 */
export function development(p: DynastyPlayer): Development {
  const pot = p.pot || p.rtg;
  const expected = expectedRating(p.rtg);
  const out: Development = {
    headroom: clamp((pot - p.rtg) / 15, 0, 1),
    minutes: Math.max(0.42, Math.min(1, (p.apps || 0) / 26)),
    perf: 1,
    over: null,
    expected,
  };
  if (p.avgR != null) {
    const signal = expected + 0.5 * (p.avgR - expected);
    out.perf = clamp(1 + perfBeta(p.age) * (signal - expected), 0.62, 1.55);
    out.over = p.avgR - expected;
  }
  return out;
}

/**
 * A season of ratings for the whole squad, from the results that actually
 * happened.
 *
 * Goals and assists come from the match engine's own tallies and are
 * scattered across the games each player was fit for, so a striker who
 * missed half the season on his goals in the half he played. A substitute
 * appears in roughly every third game and at thirty minutes, which is what
 * pulls a bench rating back towards the baseline.
 */
export function seasonRatings(
  d: Dynasty,
  results: readonly { oc: 'win' | 'draw' | 'loss'; ga: number }[],
  stats: Record<string, { g: number; a: number }>,
  rnd: Rng,
): void {
  if (!results.length) return;

  for (let i = 0; i < d.roster.length; i++) {
    const p = d.roster[i];
    if (!p) continue;
    const starter = i < 11;
    const missed = Math.min(30, Math.round(p.daysOut / 9));

    const avail: number[] = [];
    for (let m = 0; m < results.length; m++) {
      if (starter) {
        if (m >= missed) avail.push(m);
      } else if (m % 3 === 0 && m >= missed) avail.push(m);
    }

    if (!avail.length) {
      p.avgR = null;
      p.apps = 0;
      p.goals = 0;
      p.assists = 0;
      continue;
    }

    const st = stats[p.n] ?? { g: 0, a: 0 };
    const gIn: Record<number, number> = {};
    const aIn: Record<number, number> = {};
    for (let g = 0; g < st.g; g++) {
      const x = avail[Math.floor(rnd() * avail.length)];
      gIn[x] = (gIn[x] ?? 0) + 1;
    }
    for (let a = 0; a < st.a; a++) {
      const y = avail[Math.floor(rnd() * avail.length)];
      aIn[y] = (aIn[y] ?? 0) + 1;
    }

    let sum = 0;
    for (const idx of avail) {
      const gm = results[idx];
      sum += matchRating(
        p,
        {
          res: gm.oc,
          ga: gm.ga,
          goals: gIn[idx] ?? 0,
          assists: aIn[idx] ?? 0,
          mins: starter ? 90 : 30,
        },
        rnd,
      );
    }

    p.avgR = Math.round((sum / avail.length) * 100) / 100;
    p.apps = avail.length;
    p.goals = st.g;
    p.assists = st.a;
  }
}
