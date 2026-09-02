/**
 * The spin reel's maths, kept apart from the component that draws it.
 *
 * Every number that decides how the spin feels is here, so tuning it means
 * editing this file and nothing else, and the whole schedule can be printed
 * and read in a terminal rather than guessed at by holding a phone:
 * `npm run wheel`.
 *
 * No React, no React Native.
 */

export const WHEEL = {
  /** one card plus its gap, in points; the reel travels in these units */
  CARD: 124,
  /** the card itself, the rest of CARD being the gap */
  CARD_W: 112,
  CARD_H: 132,

  /** cards drawn behind the start, so the reel is never empty on the left */
  PAD: 3,
  /** cards drawn past the overshoot, so it is never empty on the right */
  TAIL: 2,

  /** the reel easing back before it goes */
  CREEP: 16,
  CREEP_MS: 130,

  /**
   * Detent timings, one entry per card that clicks past the window.
   *
   * A reel is stepped, not swept. Driving it as one long eased slide makes
   * the ticks land wherever the curve happens to put them; driving it as a
   * run of timed steps means every tick lands exactly on a detent by
   * construction, and no thinning is needed because the steps are already
   * further apart than the Taptic Engine can resolve.
   *
   * Three phases, after the web build's 65 / 100 / 150: a fast run, a
   * middle, then the last two dragged out so the reel is visibly giving up.
   */
  STEPS: [50, 50, 50, 50, 50, 50, 50, 50, 88, 88, 88, 140, 195] as const,

  /**
   * The reel stops one short and holds there.
   *
   * The card sitting in the window during this beat is deliberately a big
   * club. A near miss is more arousing than a clean loss (Clark et al.,
   * Neuron 2009), and it costs nothing because the result was decided
   * before the reel drew a frame. See the caveat in the header of
   * NEAR_MISS_CLUBS.
   */
  HELD_MS: 200,

  /** the last lurch, carrying a full card past the winner */
  LURCH_MS: 170,
  OVERSHOOT_CARDS: 1,
} as const;

/** How many detents click past before the held beat. */
export const STEP_COUNT = WHEEL.STEPS.length;

/** Detent index of the card that hangs in the window during the held beat. */
export const NEAR_MISS_AT = STEP_COUNT;
/** Detent index of the real result. */
export const WINNER_AT = STEP_COUNT + 1;
/** Detent index the lurch carries to before springing back. */
export const OVERSHOOT_AT = WINNER_AT + WHEEL.OVERSHOOT_CARDS;

/**
 * Spring for the settle, from the report: stiffness 250, damping 18,
 * mass 1.2. Enough overshoot to read as physical, not enough to wobble.
 */
export const SETTLE_SPRING = { stiffness: 250, damping: 18, mass: 1.2 } as const;

/** Where the strip sits, in points, for a given detent. */
export function offsetFor(detent: number): number {
  return -(WHEEL.PAD + detent) * WHEEL.CARD;
}

export type Tick = { at: number; detent: number; strong: boolean };

/**
 * When each detent clicks into the window, measured from the press.
 *
 * The last entry is the landing, which is the only firm one.
 */
export function tickSchedule(): Tick[] {
  const out: Tick[] = [];
  let t = WHEEL.CREEP_MS;

  WHEEL.STEPS.forEach((ms, i) => {
    t += ms;
    out.push({ at: Math.round(t), detent: i + 1, strong: false });
  });

  // held beat, then the lurch onto the winner
  t += WHEEL.HELD_MS + WHEEL.LURCH_MS;
  out.push({ at: Math.round(t), detent: WINNER_AT, strong: true });

  return out;
}

/** Roughly how long the settle spring takes to be visually done. */
export const SETTLE_MS = 400;

/** Press to still. */
export function spinDuration(): number {
  const steps = WHEEL.STEPS.reduce((n, ms) => n + ms, 0);
  return WHEEL.CREEP_MS + steps + WHEEL.HELD_MS + WHEEL.LURCH_MS + SETTLE_MS;
}

/** Peak speed, during the fast phase, in points per second. */
export function peakVelocity(): number {
  return (WHEEL.CARD / WHEEL.STEPS[0]) * 1000;
}

export type ReelItem = { club: string; season: string };

/**
 * Clubs worth hanging a near miss on.
 *
 * Caveat, stated plainly because it matters: this is a slot machine
 * technique. It is used here only to give a spin a shape, and it changes
 * nothing about the result, which is drawn before the reel moves and is
 * unaffected by what is shown beside it. No money is involved and nothing
 * is being sold. If it ever starts feeling like a tease rather than a
 * flourish, delete this and land straight on the winner.
 */
const NEAR_MISS_CLUBS = new Set([
  'Man United', 'Liverpool', 'Arsenal', 'Chelsea', 'Man City',
  'Tottenham', 'Newcastle', 'Leeds', 'Everton', 'Aston Villa',
]);

/**
 * The strip of club-seasons the reel travels through.
 *
 * Laid out so the window always has cards on both sides: PAD behind the
 * start, then one per detent, the near miss, the winner, the overshoot,
 * and TAIL past that.
 *
 * The decoys come from Math.random on purpose. They are scenery, and
 * drawing them from the run's own generator would change the season a seed
 * produces and break replay.
 */
export function buildReel(
  winner: ReelItem,
  pool: readonly ReelItem[],
): ReelItem[] {
  const pick = () => pool[Math.floor(Math.random() * pool.length)];

  const marquee = pool.filter((p) => NEAR_MISS_CLUBS.has(p.club));
  const nearMiss =
    marquee.length && marquee[0].club !== winner.club
      ? marquee[Math.floor(Math.random() * marquee.length)]
      : pick();

  const strip: ReelItem[] = [];
  // PAD + the detents that click past
  for (let i = 0; i < WHEEL.PAD + STEP_COUNT; i++) strip.push(pick());
  strip.push(nearMiss);  // NEAR_MISS_AT
  strip.push(winner);    // WINNER_AT
  for (let i = 0; i < WHEEL.OVERSHOOT_CARDS + WHEEL.TAIL; i++) strip.push(pick());
  return strip;
}
