/**
 * The spin reel's maths, transcribed from the web build.
 *
 * The site's spinTextAnim takes a `dur` and derives everything from it:
 *
 *   maxCount = floor(dur / 65)
 *   delay    = count < maxCount*0.6 ? 65
 *            : count < maxCount*0.85 ? 100
 *            : 150
 *
 * So `dur` is a parameter, not the elapsed time. At the site's 900 that is
 * thirteen steps totalling 1070ms, not 900ms. The numbers below reproduce
 * that formula exactly rather than approximating the shape of it, so the
 * app's spin is the site's spin.
 *
 * No React, no React Native.
 */

export const WHEEL = {
  /** one card plus its gap, in points; the reel travels in these units */
  CARD: 124,
  /** the card itself, the rest of CARD being the gap */
  CARD_W: 112,
  CARD_H: 132,

  /** cards drawn behind the start, so the window is never empty on the left */
  PAD: 3,
  /** cards drawn past the winner, so it is never empty on the right */
  TAIL: 3,

  /** the site's own arguments: 900 for a squad draft, 1000 for All Time XI */
  DUR: 900,
  DUR_ALLTIME: 1000,
  /** the site derives its step count from this, and so does this */
  STEP_BASE: 65,

  /**
   * The settle, which is the one thing the web reel could not do. The reel
   * arrives at the winner still carrying the speed of its last step; the
   * spring takes that velocity, carries it past, and brings it back.
   *
   * The overshoot is therefore physics rather than a magic number: it falls
   * out of how fast the reel was going when it got there.
   */
  SETTLE: { stiffness: 250, damping: 18, mass: 1.2 },
} as const;

export function durationFor(allTime: boolean): number {
  return allTime ? WHEEL.DUR_ALLTIME : WHEEL.DUR;
}

/** One delay per card that clicks past the pointer, exactly as the site. */
export function stepDelays(allTime = false): number[] {
  const maxCount = Math.floor(durationFor(allTime) / WHEEL.STEP_BASE);
  const out: number[] = [];
  for (let c = 0; c < maxCount; c++) {
    out.push(c < maxCount * 0.6 ? 65 : c < maxCount * 0.85 ? 100 : 150);
  }
  return out;
}

/** How many cards cross the pointer. The winner is the last of them. */
export function stepCount(allTime = false): number {
  return Math.floor(durationFor(allTime) / WHEEL.STEP_BASE);
}

/** Where the strip sits, in points, for a given detent. */
export function offsetFor(detent: number): number {
  return -(WHEEL.PAD + detent) * WHEEL.CARD;
}

/**
 * The reel's speed as it reaches the winner, in points per second, taken
 * from the length of the final step. Handed to the settle spring as its
 * starting velocity so the overshoot is the reel's own momentum.
 */
export function arrivalVelocity(allTime = false): number {
  const delays = stepDelays(allTime);
  return -(WHEEL.CARD / delays[delays.length - 1]) * 1000;
}

export type Tick = { at: number; detent: number; strong: boolean };

/**
 * When each card clicks past the pointer, for reading in a terminal.
 *
 * The reel does not run off this: it fires its haptics from real position,
 * so a tick lands when a card actually crosses. This exists so the schedule
 * can be checked without holding a phone.
 */
export function tickSchedule(allTime = false): Tick[] {
  const out: Tick[] = [];
  let t = 0;
  stepDelays(allTime).forEach((ms, i) => {
    t += ms;
    out.push({ at: Math.round(t), detent: i + 1, strong: false });
  });
  // the 40ms thud, once the settle spring is done
  out.push({ at: Math.round(t + SETTLE_MS), detent: stepCount(allTime), strong: true });
  return out;
}

/** Roughly how long the settle spring takes to be visually finished. */
export const SETTLE_MS = 420;

/** Press to still. */
export function spinDuration(allTime = false): number {
  return stepDelays(allTime).reduce((n, ms) => n + ms, 0) + SETTLE_MS;
}

/** Peak speed, during the 65ms phase, in points per second. */
export function peakVelocity(): number {
  return (WHEEL.CARD / WHEEL.STEP_BASE) * 1000;
}

export type ReelItem = { club: string; season: string };

/**
 * The strip of club-seasons the reel travels through.
 *
 * Padded at both ends so the window always has cards either side of the
 * pointer. Without the padding the reel runs out of strip on the left and
 * reads as a list that has ended rather than as a drum.
 *
 * The decoys come from Math.random on purpose. They are scenery, and
 * drawing them from the run's own generator would change the season a seed
 * produces and break replay.
 */
export function buildReel(
  winner: ReelItem,
  pool: readonly ReelItem[],
  allTime = false,
): ReelItem[] {
  const pick = () => pool[Math.floor(Math.random() * pool.length)];
  const strip: ReelItem[] = [];
  for (let i = 0; i < WHEEL.PAD + stepCount(allTime); i++) strip.push(pick());
  strip[WHEEL.PAD + stepCount(allTime)] = winner;
  for (let i = 0; i < WHEEL.TAIL; i++) strip.push(pick());
  return strip;
}
