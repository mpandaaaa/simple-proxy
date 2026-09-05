import { WC_SQUADS, WC_TEAMS } from '../data/worldcup.js';
import { FORMATIONS, posCompat, slotsFor } from './formations.js';
import { mulberry32 } from './rng.js';
/** How many you choose from each round. */
export const WC_BOARD = 5;
/** Eleven rounds, one for each shirt. */
export const WC_ROUNDS = 11;
export function keyOf(p) {
    return `${p.code}|${p.n}`;
}
/* ---------- the pool ---------- */
let cached = null;
/**
 * Every player at the tournament, in one list.
 *
 * Sorted, because the order the data happened to be written in must never
 * decide what a seed draws. A run has to land in the same place on any
 * build of the app.
 */
export function wcPool() {
    if (cached)
        return cached;
    const out = [];
    for (const code of Object.keys(WC_SQUADS).sort()) {
        for (const p of WC_SQUADS[code]) {
            out.push({ n: p.n, pos: p.pos, rtg: p.rtg, code });
        }
    }
    out.sort((a, b) => a.code.localeCompare(b.code) || a.n.localeCompare(b.n));
    cached = out;
    return out;
}
/* ---------- starting ---------- */
export function wcDraftStart(formation, seed) {
    const shape = FORMATIONS[formation] ? formation : '4-3-3';
    return {
        seed: seed >>> 0,
        formation: shape,
        round: 0,
        slots: slotsFor(shape).map((s) => ({ pos: s.pos, player: null })),
        taken: [],
    };
}
/* ---------- the board ---------- */
function rngFor(state) {
    return mulberry32((state.seed ^ Math.imul(state.round + 1, 0x9e3779b9)) >>> 0);
}
/**
 * How likely a player is to be dealt.
 *
 * Flat is wrong in the boring direction. Nine in ten of the players at the
 * tournament are rated under eighty five, so a flat board is four squad
 * players and a decision that makes itself, and a drafted XI comes out
 * weaker than half the nations it has to beat.
 *
 * Tilted towards the top end, a board usually holds one or two players
 * worth arguing about. Measured over three hundred drafts: taking the best
 * available every round lands a median of eighty seven, and taking
 * whatever comes lands eighty one. Six points between drafting well and
 * drafting carelessly is the whole point of a draft.
 */
function weightOf(p) {
    return 1 + Math.pow(Math.max(0, p.rtg - 76), 1.6) * 0.05;
}
/** Whether an empty slot exists that he could fill. */
export function wcCanPlay(state, p) {
    return state.slots.some((s) => !s.player && posCompat(p.pos, s.pos));
}
/** Every empty slot he could fill, by index. */
export function wcSlotsFor(state, p) {
    const out = [];
    state.slots.forEach((s, i) => {
        if (!s.player && posCompat(p.pos, s.pos))
            out.push(i);
    });
    return out;
}
/**
 * The five you choose from this round.
 *
 * Only players who can actually go somewhere, so a board is never a dead
 * end, and never anybody already taken. Worked out from the seed and the
 * round rather than stored, so closing the app mid draft and coming back
 * deals the same five.
 */
export function wcBoard(state) {
    if (state.round >= WC_ROUNDS)
        return [];
    const rnd = rngFor(state);
    const gone = new Set(state.taken);
    const pool = wcPool().filter((p) => !gone.has(keyOf(p)) && wcCanPlay(state, p));
    if (!pool.length)
        return [];
    const out = [];
    const used = new Set();
    let total = pool.reduce((s, p) => s + weightOf(p), 0);
    for (let n = 0; n < Math.min(WC_BOARD, pool.length); n++) {
        let roll = rnd() * total;
        let at = -1;
        for (let i = 0; i < pool.length; i++) {
            if (used.has(i))
                continue;
            roll -= weightOf(pool[i]);
            if (roll <= 0) {
                at = i;
                break;
            }
        }
        if (at < 0) {
            /* Rounding ate the last of the roll. Take the first one left. */
            at = pool.findIndex((_, i) => !used.has(i));
            if (at < 0)
                break;
        }
        used.add(at);
        total -= weightOf(pool[at]);
        out.push(pool[at]);
    }
    return out.sort((a, b) => b.rtg - a.rtg || a.n.localeCompare(b.n));
}
/* ---------- picking ---------- */
/**
 * Take one, and move on.
 *
 * Refuses a slot that is taken or that he cannot fill, because a draft
 * that quietly puts a goalkeeper at centre forward is worse than one that
 * says no.
 */
export function wcPlace(state, p, slot) {
    const at = state.slots[slot];
    if (!at || at.player)
        return state;
    if (!posCompat(p.pos, at.pos))
        return state;
    if (state.taken.indexOf(keyOf(p)) > -1)
        return state;
    const slots = state.slots.map((s, i) => (i === slot ? { ...s, player: p } : s));
    return {
        ...state,
        slots,
        round: state.round + 1,
        taken: [...state.taken, keyOf(p)],
    };
}
/** The board's best, for a player who would rather not choose. */
export function wcAutoPick(state) {
    const board = wcBoard(state);
    for (const p of board) {
        const slots = wcSlotsFor(state, p);
        if (slots.length)
            return { player: p, slot: slots[0] };
    }
    return null;
}
export function wcDraftDone(state) {
    return state.slots.every((s) => s.player);
}
/* ---------- what you built ---------- */
/** The eleven, in the order the shape draws them. */
export function wcXi(state) {
    return state.slots.map((s) => s.player).filter((p) => Boolean(p));
}
/**
 * What the XI is worth, on the same nought to ninety nine scale as a
 * nation, so a drafted side and a real one can be put in the same group.
 */
export function wcXiRating(state) {
    const xi = wcXi(state);
    if (!xi.length)
        return 0;
    const mean = xi.reduce((s, p) => s + p.rtg, 0) / xi.length;
    const shape = FORMATIONS[state.formation];
    /* The shape counts for a little, the way it does everywhere else. */
    const tilt = shape ? (shape.att + shape.def) / 2 : 1;
    return Math.round(Math.max(0, Math.min(99, mean * (0.97 + tilt * 0.03))));
}
/** How many nations you drew from, which is the whole point of a World XI. */
export function wcSpread(state) {
    return new Set(wcXi(state).map((p) => p.code)).size;
}
/** The eleven as a squad the tournament itself can use. */
export function wcCustomSquad(state) {
    return wcXi(state).map((p) => ({ n: p.n, pos: p.pos, rtg: p.rtg }));
}
/** The nation a drafted player belongs to, for the badge on his card. */
export function wcNationOf(code) {
    return WC_TEAMS[code];
}
