/**
 * mulberry32, carried over from the web build unchanged.
 *
 * The exact sequence matters: a Daily Challenge is "the same spins for
 * everyone" only because every device draws the same numbers in the same
 * order from the same seed, and a leaderboard replay only agrees with the
 * phone for the same reason. Do not swap this for a nicer generator.
 */
export function mulberry32(seed) {
    let a = seed;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** Unseeded play. Every run that is scored against others uses a seed. */
export const systemRng = Math.random;
/** Fisher-Yates, taking its randomness from the run's own generator. */
export function shuffle(list, rnd) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        const t = out[i];
        out[i] = out[j];
        out[j] = t;
    }
    return out;
}
