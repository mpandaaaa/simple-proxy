import { defaultConfig } from './types.js';
import { FORMATIONS } from './formations.js';
/**
 * Duels.
 *
 * You draft an XI, you get a code, you send the code to somebody. They
 * draft from the identical spin sequence and the game says who won.
 *
 * The whole thing is in the code. Nothing is uploaded, nothing is
 * fetched, and it works with no signal on a bus, because a seed plus a
 * configuration fully determines a season: the same property that lets a
 * run be replayed to check it. The code carries the seed, the rules and
 * the score to beat, and that is a duel.
 *
 * It is fourteen characters in three groups, from an alphabet with no
 * letters anybody confuses. A checksum catches a typo before it becomes
 * a different puzzle, because a code that quietly works but is not the
 * one your friend played is worse than one that plainly does not.
 */
/**
 * Crockford's alphabet, near enough: no I, no L, no O, no U.
 *
 * Those are the characters people get wrong when they read a code off one
 * phone and type it into another, and U is left out because of the words
 * it makes.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const BASE = BigInt(ALPHABET.length);
/** The shapes a duel can be played in, indexed, so a code can name one. */
export const DUEL_SHAPES = Object.keys(FORMATIONS);
function bits(value, width) {
    return value & ((1n << BigInt(width)) - 1n);
}
/**
 * How wide the code is.
 *
 * Sixty three bits of duel and five of checksum is sixty eight, and
 * fourteen characters at five bits each is seventy. Thirteen was thirteen
 * too few and the top of the seed fell off the end, so most codes decoded
 * into a different puzzle from the one that was sent, which is the exact
 * failure a duel cannot have.
 */
const CHARS = 14;
/**
 * Pack a duel into a code.
 *
 * Thirty two bits for the seed, four for the shape, twelve for the era
 * window, two flags, seven for the score, six for the rating and five for
 * a checksum.
 */
export function encodeDuel(duel) {
    const shape = Math.max(0, DUEL_SHAPES.indexOf(duel.config.formation));
    const from = Math.max(0, Math.min(63, duel.config.eraFrom - 1992));
    const to = Math.max(0, Math.min(63, duel.config.eraTo - 1992));
    const pts = Math.max(0, Math.min(127, Math.round(duel.pts)));
    const rating = Math.max(0, Math.min(63, Math.round(duel.rating) - 40));
    let body = 0n;
    body = (body << 32n) | bits(BigInt(duel.seed >>> 0), 32);
    body = (body << 4n) | bits(BigInt(shape), 4);
    body = (body << 6n) | bits(BigInt(from), 6);
    body = (body << 6n) | bits(BigInt(to), 6);
    body = (body << 1n) | (duel.config.blitz ? 1n : 0n);
    body = (body << 1n) | (duel.config.showRatings ? 1n : 0n);
    body = (body << 7n) | bits(BigInt(pts), 7);
    body = (body << 6n) | bits(BigInt(rating), 6);
    const sum = checksum(body);
    let all = (body << 5n) | BigInt(sum);
    let out = '';
    for (let i = 0; i < CHARS; i++) {
        out = ALPHABET[Number(all % BASE)] + out;
        all /= BASE;
    }
    return `${out.slice(0, 5)}-${out.slice(5, 10)}-${out.slice(10)}`;
}
/** A small sum over the body, so one wrong character is caught. */
function checksum(body) {
    let h = 0n;
    let v = body;
    while (v > 0n) {
        h = (h * 31n + (v & 0x1fn)) & 0x1fn;
        v >>= 5n;
    }
    return Number(h);
}
/**
 * Read a code back.
 *
 * Null when it is not a code at all, when it has a character that is not
 * in the alphabet, or when the checksum says a character is wrong. Never
 * a half decoded duel, because a duel against a puzzle your friend did
 * not play is the one outcome worse than a rejected code.
 */
export function decodeDuel(code) {
    const clean = code
        .toUpperCase()
        .replace(/O/g, '0')
        .replace(/[IL]/g, '1')
        .replace(/[^0-9A-Z]/g, '');
    if (clean.length !== CHARS)
        return null;
    let all = 0n;
    for (const ch of clean) {
        const i = ALPHABET.indexOf(ch);
        if (i < 0)
            return null;
        all = all * BASE + BigInt(i);
    }
    const sum = Number(all & 0x1fn);
    const body = all >> 5n;
    if (checksum(body) !== sum)
        return null;
    let v = body;
    const rating = Number(bits(v, 6));
    v >>= 6n;
    const pts = Number(bits(v, 7));
    v >>= 7n;
    const showRatings = Number(bits(v, 1)) === 1;
    v >>= 1n;
    const blitz = Number(bits(v, 1)) === 1;
    v >>= 1n;
    const to = Number(bits(v, 6));
    v >>= 6n;
    const from = Number(bits(v, 6));
    v >>= 6n;
    const shape = Number(bits(v, 4));
    v >>= 4n;
    const seed = Number(bits(v, 32));
    const formation = DUEL_SHAPES[shape];
    if (!formation)
        return null;
    const eraFrom = 1992 + from;
    const eraTo = 1992 + to;
    if (eraFrom > eraTo || eraTo > 2026)
        return null;
    return {
        seed: seed >>> 0,
        pts,
        rating: rating + 40,
        config: {
            ...defaultConfig,
            diff: 'normal',
            mode: 'squad',
            rtype: 'prime',
            formation,
            eraFrom,
            eraTo,
            blitz,
            showRatings,
        },
    };
}
/** A fresh duel to send, before it has been played. */
export function newDuel(seed, config) {
    return { seed, config, pts: 0, rating: 40 };
}
/** How the two of you compare, in a word. */
export function duelOutcome(mine, theirs) {
    return mine > theirs ? 'won' : mine === theirs ? 'drew' : 'lost';
}
/** What a code says it is, for the screen that shows it before you play. */
export function duelRules(duel) {
    const parts = [duel.config.formation];
    parts.push(duel.config.eraFrom === 1992 && duel.config.eraTo === 2026
        ? 'all time'
        : `${duel.config.eraFrom} to ${duel.config.eraTo}`);
    if (duel.config.blitz)
        parts.push('Blitz');
    if (!duel.config.showRatings)
        parts.push('no ratings');
    return parts.join(' · ');
}
