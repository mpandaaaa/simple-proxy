/**
 * The spin reel's maths, kept apart from the component that draws it.
 *
 * Everything about how the spin feels is a number in here, so tuning it
 * means editing this file and nothing else. It is also why the haptic
 * schedule can be printed and read in a terminal rather than guessed at by
 * holding a phone: see scripts/wheel-ticks.mjs.
 *
 * No React, no React Native.
 */

export const WHEEL = {
  /** one card plus its gap, in points; the reel travels in these units */
  CARD: 124,
  /** the card itself, the rest of CARD being the gap */
  CARD_W: 112,
  CARD_H: 132,

  /** how many cards cross the centre before the winner does */
  TRAVEL: 10,

  /** the reel easing back before it goes, in ms */
  CREEP_MS: 150,
  /** how far it eases back, in points */
  CREEP: 16,

  /** the decelerating run, in ms. The web build uses 900. */
  SPIN_MS: 900,
  /** All Time XI runs slightly longer, as it does on the site */
  SPIN_MS_ALLTIME: 1000,

  /** carried past the winner by half a card before it comes back */
  OVERSHOOT: 62,
  /** the spring back onto the winner, in ms */
  SNAP_MS: 260,

  /**
   * The floor for two taps to read as two taps rather than one buzz.
   * Over 900ms this is what decides the tick count, so it is the number to
   * move if the ticking feels sparse.
   */
  MIN_TICK_GAP: 42,
} as const;

export function spinMs(allTime: boolean): number {
  return allTime ? WHEEL.SPIN_MS_ALLTIME : WHEEL.SPIN_MS;
}

/** Total travel of the run, overshoot included. */
export const travelDistance = WHEEL.TRAVEL * WHEEL.CARD + WHEEL.OVERSHOOT;

/**
 * Deceleration curve.
 *
 * Quadratic out. Its velocity falls off linearly, which is what lets the
 * motion smear ride a plain linear ramp instead of sampling the animation.
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
 * When each card boundary crosses the centre line.
 *
 * Solved from the curve rather than sampled off the running animation.
 * That is not a shortcut: it is exact, it cannot be thrown off by a
 * dropped frame, and it does not need a value bridged back into JavaScript
 * sixty times a second while the reel is the only thing on screen.
 *
 * Two rules thin it: at least MIN_TICK_GAP apart, and never a shorter gap
 * than the one before, so the rhythm only ever slows. The winner's own
 * crossing is always kept, and is the firm one.
 */
export function tickSchedule(allTime = false): Tick[] {
  const out: Tick[] = [];
  const D = spinMs(allTime);
  // Measured from when the reel is released, not from the button press.
  // Starting at zero makes the first gap include the creep, and the
  // monotonic rule then treats that as the floor and drops everything.
  let last: number = WHEEL.CREEP_MS;
  let lastGap = 0;

  for (let k = 1; k <= WHEEL.TRAVEL; k++) {
    const f = (k * WHEEL.CARD) / travelDistance;
    const at = WHEEL.CREEP_MS + D * easeInverse(f);
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
export function landingAt(allTime = false): number {
  return Math.round(
    WHEEL.CREEP_MS +
      spinMs(allTime) * easeInverse((WHEEL.TRAVEL * WHEEL.CARD) / travelDistance),
  );
}

/** Creep, run and snap: press to still. */
export function spinDuration(allTime = false): number {
  return WHEEL.CREEP_MS + spinMs(allTime) + WHEEL.SNAP_MS;
}

/** Peak speed off the line, in points per second. */
export function peakVelocity(allTime = false): number {
  return (2 * travelDistance) / (spinMs(allTime) / 1000);
}

export type ReelItem = { club: string; season: string };

/**
 * The strip of club-seasons the reel travels through.
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
  for (let i = 0; i < 3; i++) {
    strip.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return strip;
}
