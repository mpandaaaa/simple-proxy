/**
 * Seeded randomness, ported unchanged from the web game.
 *
 * Every random draw in a season comes from one of these, in a fixed order.
 * That order is what makes a seeded run (the Daily, a multiplayer room)
 * come out identically for everyone. Reordering two draws changes every
 * result after them.
 */
export type Rng = () => number;

/** mulberry32, exactly as the web game's line for line. */
export function mulberry32(seed: number): Rng {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random source that counts how many numbers it has handed out. */
export type CountedRng = Rng & { draws: () => number };

export function counted(rnd: Rng): CountedRng {
  let n = 0;
  const f = (() => {
    n++;
    return rnd();
  }) as CountedRng;
  f.draws = () => n;
  return f;
}

/** Fisher-Yates from the back, as the web game's shuf(). Returns a copy. */
export function shuffle<T>(a: readonly T[], rnd: Rng): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = b[i];
    b[i] = b[j];
    b[j] = t;
  }
  return b;
}

/** Knuth Poisson sampler, as the web game's poissonR(). */
export function poisson(l: number, rnd: Rng): number {
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

/** Days since the Unix epoch for the device's local calendar date. */
export function epochDay(d: Date = new Date()): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}
