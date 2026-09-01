/**
 * The spin wheel's maths, kept apart from the component that draws it.
 *
 * Everything about how the reel feels is a number in here, so tuning the
 * spin means editing this file and nothing else. It is also why the haptic
 * schedule can be printed and read in a terminal rather than guessed at by
 * holding a phone: see scripts/wheel-ticks.mjs.
 *
 * No React, no React Native.
 */

export const WHEEL = {
  /** height of one club-season strip, in points */
  ITEM: 56,
  /** strips visible through the window; odd, so one is centred */
  VISIBLE: 5,
  /** how many strips cross the centre line before the winner does */
  TRAVEL: 30,

  /** the long decelerating run, in ms */
  SPIN_MS: 1800,
  /** how far past the winner the reel carries before coming back */
  OVERSHOOT: 40,
  /** the spring back down onto the winner, in ms */
  SNAP_MS: 320,

  /**
   * The Taptic Engine cannot resolve taps much closer than this, and
   * trying turns a run of ticks into one buzz.
   */
  MIN_TICK_GAP: 58,
} as const;

/** Total travel of the long run, overshoot included. */
export const travelDistance = WHEEL.TRAVEL * WHEEL.ITEM + WHEEL.OVERSHOOT;

/**
 * Deceleration curve.
 *
 * Quadratic out, not cubic. Cubic spends the last quarter of its time
 * covering two percent of the distance, which reads as the reel giving up
 * rather than slowing down, and it leaves a second of silence after the
 * final tick. Quadratic keeps the reel visibly moving into the overshoot.
 */
export function ease(p: number): number {
  return 1 - (1 - p) * (1 - p);
}

/** Given a fraction of the distance, when it was reached. */
export function easeInverse(f: number): number {
  return 1 - Math.sqrt(1 - f);
}

export type Tick = { at: number; index: number; strong: boolean };

/**
 * When each strip crosses the centre line, thinned to what a thumb can
 * feel, and to a rhythm that only ever slows.
 *
 * Two rules. A tick must be at least MIN_TICK_GAP after the last one, and
 * it must not come sooner after it than the previous gap did. Without the
 * second rule the thinning leaves gaps that jump about (103ms, then 57ms,
 * then 63ms) and the reel sounds like it is speeding up again just as it
 * is meant to be settling.
 *
 * The winner's own crossing is always kept, and is the firm one.
 */
export function tickSchedule(): Tick[] {
  const out: Tick[] = [];
  // Both start at zero, measured from the moment the reel is released.
  // Seeding `last` with -Infinity makes the first gap infinite, which then
  // becomes the floor every later gap is compared against, and nothing
  // after the first tick ever qualifies.
  let last = 0;
  let lastGap = 0;

  for (let k = 1; k <= WHEEL.TRAVEL; k++) {
    const f = (k * WHEEL.ITEM) / travelDistance;
    const at = WHEEL.SPIN_MS * easeInverse(f);
    const winner = k === WHEEL.TRAVEL;

    if (!winner) {
      const gap = at - last;
      if (gap < WHEEL.MIN_TICK_GAP || gap < lastGap) continue;
      lastGap = gap;
    }

    last = at;
    out.push({ at: Math.round(at), index: k, strong: winner });
  }

  return out;
}

/** When the winner reaches the centre line. */
export function landingAt(): number {
  return Math.round(
    WHEEL.SPIN_MS * easeInverse((WHEEL.TRAVEL * WHEEL.ITEM) / travelDistance),
  );
}

/** Total time from pressing spin to the reel being still. */
export const spinDuration = WHEEL.SPIN_MS + WHEEL.SNAP_MS;

export type ReelItem = { club: string; season: string };

/**
 * The strip of club-seasons the reel scrolls through.
 *
 * The winner sits at index TRAVEL, with a few behind it so the window is
 * never short of something to draw. The decoys come from Math.random on
 * purpose: they are scenery, and drawing them from the run's own generator
 * would change the season a seed produces and break replay.
 */
export function buildReel(
  winner: ReelItem,
  pool: readonly ReelItem[],
): ReelItem[] {
  const strip: ReelItem[] = [];
  for (let i = 0; i < WHEEL.TRAVEL; i++) {
    strip.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  strip.push(winner);
  for (let i = 0; i < WHEEL.VISIBLE; i++) {
    strip.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return strip;
}
