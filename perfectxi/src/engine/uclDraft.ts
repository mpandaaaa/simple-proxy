import { UCL_CLUBS, type UclPlayer } from '../data/ucl';
import { FORMATIONS, posCompat, slotsFor } from './formations';
import { mulberry32, type Rng } from './rng';
import { uclSquad } from './ucl';
import type { Position } from './types';

/**
 * Drafting a Champions League XI.
 *
 * The same idea as the World XI and the same shape of code, over a
 * different pool: every squad in the competition rather than every squad
 * at a tournament. Eleven rounds, five players a round, whoever you take
 * is gone.
 *
 * The XI then enters the competition itself, taking a real club's place in
 * the league phase, because there are thirty six places and there is no
 * thirty seventh.
 */

export type UclPick = {
  n: string;
  pos: string[];
  rtg: number;
  /** the club he actually plays for */
  club: string;
};

export type UclDraftSlot = { pos: Position; player: UclPick | null };

export type UclDraftState = {
  seed: number;
  formation: string;
  round: number;
  slots: UclDraftSlot[];
  taken: string[];
};

export const UCL_DRAFT_BOARD = 5;
export const UCL_DRAFT_ROUNDS = 11;

export function uclKeyOf(p: UclPick): string {
  return `${p.club}|${p.n}`;
}

/* ---------- the pool ---------- */

let cached: UclPick[] | null = null;

/**
 * Every player in the competition, in one list.
 *
 * Sorted, because the order the data happened to be written in must never
 * decide what a seed draws.
 */
export function uclPool(): UclPick[] {
  if (cached) return cached;
  const out: UclPick[] = [];
  for (const club of Object.keys(UCL_CLUBS).sort()) {
    for (const p of uclSquad(club)) out.push({ n: p.n, pos: p.pos, rtg: p.rtg, club });
  }
  out.sort((a, b) => a.club.localeCompare(b.club) || a.n.localeCompare(b.n));
  cached = out;
  return out;
}

/* ---------- starting ---------- */

export function uclDraftStart(formation: string, seed: number): UclDraftState {
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

function rngFor(state: UclDraftState): Rng {
  return mulberry32((state.seed ^ Math.imul(state.round + 1, 0x85ebca6b)) >>> 0);
}

/**
 * How likely a player is to be dealt.
 *
 * Tilted towards the top end, so a board usually holds one or two players
 * worth arguing about rather than five squad men and a decision that makes
 * itself. Gentler than the World XI's tilt, because this pool is six
 * hundred and eighty eight rather than twelve hundred and its best players
 * are a larger share of it.
 *
 * Measured over eight hundred drafts: taking the best available lands a
 * median of eighty six, which is the second best side in the competition,
 * and taking whatever comes lands seventy six, which is a play-off place.
 * Ten points between drafting well and not bothering, and fifteen in a
 * hundred well drafted XIs win the thing.
 */
function weightOf(p: UclPick): number {
  return 1 + Math.pow(Math.max(0, p.rtg - 78), 1.6) * 0.02;
}

export function uclCanPlay(state: UclDraftState, p: UclPick): boolean {
  return state.slots.some((s) => !s.player && posCompat(p.pos, s.pos));
}

export function uclSlotsFor(state: UclDraftState, p: UclPick): number[] {
  const out: number[] = [];
  state.slots.forEach((s, i) => {
    if (!s.player && posCompat(p.pos, s.pos)) out.push(i);
  });
  return out;
}

/** The five you choose from this round, worked out from the seed. */
export function uclBoard(state: UclDraftState): UclPick[] {
  if (state.round >= UCL_DRAFT_ROUNDS) return [];
  const rnd = rngFor(state);
  const gone = new Set(state.taken);
  const pool = uclPool().filter((p) => !gone.has(uclKeyOf(p)) && uclCanPlay(state, p));
  if (!pool.length) return [];

  const out: UclPick[] = [];
  const used = new Set<number>();
  let total = pool.reduce((s, p) => s + weightOf(p), 0);

  for (let n = 0; n < Math.min(UCL_DRAFT_BOARD, pool.length); n++) {
    let roll = rnd() * total;
    let at = -1;
    for (let i = 0; i < pool.length; i++) {
      if (used.has(i)) continue;
      roll -= weightOf(pool[i]);
      if (roll <= 0) {
        at = i;
        break;
      }
    }
    if (at < 0) {
      at = pool.findIndex((_, i) => !used.has(i));
      if (at < 0) break;
    }
    used.add(at);
    total -= weightOf(pool[at]);
    out.push(pool[at]);
  }

  return out.sort((a, b) => b.rtg - a.rtg || a.n.localeCompare(b.n));
}

/* ---------- picking ---------- */

export function uclDraftPlace(state: UclDraftState, p: UclPick, slot: number): UclDraftState {
  const at = state.slots[slot];
  if (!at || at.player) return state;
  if (!posCompat(p.pos, at.pos)) return state;
  if (state.taken.indexOf(uclKeyOf(p)) > -1) return state;

  return {
    ...state,
    slots: state.slots.map((s, i) => (i === slot ? { ...s, player: p } : s)),
    round: state.round + 1,
    taken: [...state.taken, uclKeyOf(p)],
  };
}

export function uclAutoPick(state: UclDraftState): { player: UclPick; slot: number } | null {
  for (const p of uclBoard(state)) {
    const slots = uclSlotsFor(state, p);
    if (slots.length) return { player: p, slot: slots[0] };
  }
  return null;
}

export function uclDraftDone(state: UclDraftState): boolean {
  return state.slots.every((s) => s.player);
}

/* ---------- what you built ---------- */

export function uclDraftXi(state: UclDraftState): UclPick[] {
  return state.slots.map((s) => s.player).filter((p): p is UclPick => Boolean(p));
}

/** What the XI is worth, on the same scale as a club's tier. */
export function uclXiRating(state: UclDraftState): number {
  const xi = uclDraftXi(state);
  if (!xi.length) return 0;
  const mean = xi.reduce((s, p) => s + p.rtg, 0) / xi.length;
  const shape = FORMATIONS[state.formation];
  const tilt = shape ? (shape.att + shape.def) / 2 : 1;
  return Math.round(Math.max(0, Math.min(99, mean * (0.97 + tilt * 0.03))));
}

/** How many clubs you raided, which is the whole point. */
export function uclDraftSpread(state: UclDraftState): number {
  return new Set(uclDraftXi(state).map((p) => p.club)).size;
}

/** The eleven as a squad the competition itself can use. */
export function uclDraftSquad(state: UclDraftState): UclPlayer[] {
  return uclDraftXi(state).map((p) => ({
    n: p.n,
    nat: '',
    pos: p.pos,
    rtg: p.rtg,
    prime: p.rtg,
  }));
}
