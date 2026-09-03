import {
  boardFrom,
  canPlay,
  dealSequence,
  newDraft,
  place,
  slotsForPlayer,
  squadAvg,
} from './draft';
import { mulberry32, type Rng } from './rng';
import type { DraftState } from './draft';
import type { DraftConfig, Pick, Slot } from './types';

/**
 * The head to head draft.
 *
 * Two people, one board, alternate first pick. The board is the same
 * club-season for both of you and a footballer taken is off it for the
 * other one, which is the whole difference from the duel it replaces:
 * before, two people drafting the same spins usually ended up with much
 * the same XI, because the best man on the board is the best man on the
 * board. Now taking him is a decision that costs your opponent something,
 * and letting him go is one that costs you.
 *
 * A round is one board and two picks. Whoever picks first this round
 * picks second the next one, so across eleven rounds each of you has the
 * first pick five or six times and neither has an advantage worth
 * arguing about.
 *
 * Everything here is a pure function of the seed and the list of picks
 * made so far. That matters more than it usually does: it is what lets
 * two phones stay in step by exchanging nothing but their own picks, and
 * it is what lets a whole match be replayed on a server later to check
 * that nobody cheated.
 */

export type Side = 'a' | 'b';

/** One pick, in the order it was made. Twenty two of these are a match. */
export type H2HPick = {
  /** the pick number across the whole match, from nought */
  n: number;
  side: Side;
  /** the round it belongs to, from one */
  round: number;
  /** the player's name, which is what the two phones exchange */
  name: string;
  /** the place in that side's XI it filled */
  slot: number;
};

export type H2HState = {
  config: DraftConfig;
  seed: number;
  /** the round being played, from one */
  round: number;
  /** whose turn it is, or null when the match is over */
  turn: Side | null;
  /** who picks first this round */
  first: Side;
  /** the board in front of both of you, minus everyone already taken */
  board: Pick[];
  /** the club and season this board came from */
  club: string;
  season: string;
  a: DraftState;
  b: DraftState;
  picks: H2HPick[];
  done: boolean;
};

/** How many rounds a match is. One board each round, one XI at the end. */
export function roundsFor(config: DraftConfig): number {
  return newDraft(config).total;
}

/**
 * Who picks first in a given round.
 *
 * A alternates with B from round one, so odd rounds are A's and even
 * rounds are B's. With eleven rounds A gets the first pick six times and
 * B five, which is why the person who was already waiting in the queue is
 * B: the one who turned up last is the one who gets the small edge, and
 * the one who has been sitting there gets the compensation of having
 * chosen to wait.
 */
export function firstOf(round: number): Side {
  return round % 2 === 1 ? 'a' : 'b';
}

export const other = (side: Side): Side => (side === 'a' ? 'b' : 'a');

/** Everyone off the board, whoever took them. */
function takenNames(a: DraftState, b: DraftState): Set<string> {
  const out = new Set<string>();
  for (const s of a.squad) if (s.player) out.add(s.player.n);
  for (const s of b.squad) if (s.player) out.add(s.player.n);
  return out;
}

/**
 * The club-seasons a match deals, worked out once and kept.
 *
 * The sequence depends on the seed, the era and nothing else, and a
 * match asks for it after every single pick while it rebuilds itself.
 * Working it out each time was quadratic in the number of picks and it
 * showed: a draft that took a fifth of a second to answer a tap.
 *
 * Small on purpose. A phone plays one match at a time and the cache
 * exists to survive a rebuild, not a session.
 */
const DEALS = new Map<string, string[]>();
/**
 * How many boards a match can need.
 *
 * Eleven rounds fill two XIs when every board has somebody on it both of
 * you can use, and three matches in a thousand did not: a shared board
 * runs thin, and a side whose only empty place is in goal can be shown a
 * club-season whose keeper has already gone. Those rounds are passed and
 * the match moves to the next board, so it needs more boards than rounds.
 * Sixty is far more than any match has ever wanted.
 */
const DEAL_ROUNDS = 60;

function sequence(config: DraftConfig, seed: number): string[] {
  const key = `${seed}|${config.eraFrom}|${config.eraTo}|${config.nation ?? ''}`;
  let got = DEALS.get(key);
  if (!got) {
    got = dealSequence(config, seed, DEAL_ROUNDS);
    if (DEALS.size > 8) DEALS.clear();
    DEALS.set(key, got);
  }
  return got;
}

/**
 * Deal the board for a round.
 *
 * The club and the season come off the sequence, which never moves. The
 * board is that club-season with everybody either of you has taken
 * removed, which is the only part that changes as a match goes on.
 */
function dealFor(state: {
  config: DraftConfig;
  seed: number;
  round: number;
  a: DraftState;
  b: DraftState;
}): { club: string; season: string; board: Pick[] } {
  const keys = sequence(state.config, state.seed);
  const key = keys[state.round - 1];
  if (!key) return { club: '', season: '', board: [] };
  return boardFrom(state.config, key, takenNames(state.a, state.b));
}

/**
 * A match from nothing, or a match rebuilt from the picks that have been
 * made in it.
 *
 * The second is the one that matters. Two phones never send each other a
 * state, only picks, and each of them rebuilds the whole match from the
 * seed and the list. So a phone that missed three updates catches up
 * completely on the next one, and there is no such thing as the two of
 * them disagreeing about what the board is.
 */
export function h2hFrom(config: DraftConfig, seed: number, picks: H2HPick[]): H2HState {
  let a = newDraft(config);
  let b = newDraft(config);
  const total = a.total;
  const keys = sequence(config, seed);

  let round = 1;
  /* Nought is the first turn of the round, one is the second. */
  let turnIndex = 0;

  const cur = (): Side => (turnIndex === 0 ? firstOf(round) : other(firstOf(round)));
  const advance = () => {
    if (turnIndex === 0) turnIndex = 1;
    else {
      turnIndex = 0;
      round++;
    }
  };

  let cachedRound = -1;
  let cached: { club: string; season: string; board: Pick[] } = { club: '', season: '', board: [] };
  let cachedTaken = -1;
  const boardNow = () => {
    const made = a.filled + b.filled;
    if (cachedRound !== round || cachedTaken !== made) {
      const key = keys[round - 1];
      cached = key
        ? boardFrom(config, key, takenNames(a, b))
        : { club: '', season: '', board: [] };
      cachedRound = round;
      cachedTaken = made;
    }
    return cached;
  };

  const bothDone = () => a.filled >= total && b.filled >= total;
  const canMove = (side: Side): boolean => {
    const st = side === 'a' ? a : b;
    if (st.filled >= total) return false;
    return boardNow().board.some((p) => canPlay(st, p) && slotsForPlayer(st, p).length > 0);
  };

  /*
   * Walk forward past every turn nobody could have taken.
   *
   * A pass is not a decision and is never sent between phones: it is
   * forced, so both sides work it out from the same board and arrive at
   * the same place. That is what keeps a match rebuildable from nothing
   * but the picks that were actually made.
   */
  const settle = () => {
    let guard = 0;
    while (guard++ < 400) {
      if (bothDone()) return;
      if (round > keys.length) return;
      if (canMove(cur())) return;
      advance();
    }
  };

  const clean: H2HPick[] = [];
  for (const p of [...picks].sort((x, y) => x.n - y.n)) {
    settle();
    if (bothDone() || round > keys.length) break;
    const side = cur();
    /* Rebuilt rather than trusted. A pick out of turn, or naming somebody
       who has gone, or a place that is filled, is dropped: the list comes
       off a network and the rules are not the network's to decide. */
    if (p.side !== side) continue;
    const found = boardNow().board.find((x) => x.n === p.name);
    if (!found) continue;
    const st = side === 'a' ? a : b;
    const target = st.squad[p.slot];
    if (!target || target.player) continue;
    const next = place(st, found, p.slot);
    if (next === st) continue;
    if (side === 'a') a = next;
    else b = next;
    clean.push({ n: clean.length, side, round, name: p.name, slot: p.slot });
    advance();
  }
  settle();

  const done = bothDone() || round > keys.length;
  const deal = done ? { club: '', season: '', board: [] } : boardNow();

  return {
    config,
    seed,
    round,
    turn: done ? null : cur(),
    first: firstOf(round),
    board: deal.board,
    club: deal.club,
    season: deal.season,
    a,
    b,
    picks: clean,
    done,
  };
}

/** A fresh match. */
export function newH2H(config: DraftConfig, seed: number): H2HState {
  return h2hFrom(config, seed, []);
}

/** That side's own draft, for the rules that ask about one squad. */
export function squadOf(state: H2HState, side: Side): DraftState {
  return side === 'a' ? state.a : state.b;
}

/**
 * What a side can actually take off this board.
 *
 * Not just what is on it. A striker is no use to somebody whose only
 * empty place is in goal, and offering him is offering a tap that does
 * nothing.
 */
export function playableFor(state: H2HState, side: Side): Pick[] {
  const mine = squadOf(state, side);
  return state.board.filter((p) => canPlay(mine, p) && slotsForPlayer(mine, p).length > 0);
}

/** Where this player could go in that side's shape. */
export function slotsFor(state: H2HState, side: Side, player: Pick): number[] {
  return slotsForPlayer(squadOf(state, side), player);
}

/**
 * Take somebody.
 *
 * Returns the match with the pick in it, or the match untouched when the
 * pick is not one the rules allow: not your turn, not on the board, or
 * not a place he can fill. Nothing throws, because this is reached from
 * a tap and from a network message and neither should be able to end a
 * match by being wrong.
 */
export function pickH2H(
  state: H2HState,
  side: Side,
  name: string,
  slot: number,
): H2HState {
  if (state.done || state.turn !== side) return state;
  const found = state.board.find((p) => p.n === name);
  if (!found) return state;
  const mine = squadOf(state, side);
  const target = mine.squad[slot];
  if (!target || target.player) return state;
  if (!slotsFor(state, side, found).includes(slot)) return state;

  const next = h2hFrom(state.config, state.seed, [
    ...state.picks,
    { n: state.picks.length, side, round: state.round, name, slot },
  ]);
  /* If the rebuild did not accept it, nothing happened. Better than a
     match that says it moved on and did not. */
  return next.picks.length > state.picks.length ? next : state;
}

/**
 * Take the obvious one.
 *
 * Used by the Machine, and by the shot clock when somebody has put their
 * phone down. The best player on the board who fits somewhere, in the
 * first place he fits, which is the pick anybody would make with two
 * seconds left.
 */
export function autoPick(state: H2HState, side: Side): { name: string; slot: number } | null {
  const can = playableFor(state, side);
  if (!can.length) return null;
  const best = can[0];
  const slot = slotsFor(state, side, best)[0];
  return slot === undefined ? null : { name: best.n, slot };
}

/**
 * What the Machine does, which is nearly the obvious one.
 *
 * Skill is the chance it takes the best man rather than one of the next
 * two. An opponent who never makes a mistake is not an opponent, and in a
 * head to head that matters more than it did before: taking the second
 * best striker because the best one does not fit your shape is the whole
 * game, and a machine that always takes the top of the list never has to
 * think about it.
 */
export function machinePick(
  state: H2HState,
  side: Side,
  rnd: Rng,
  skill: number,
): { name: string; slot: number } | null {
  const can = playableFor(state, side);
  if (!can.length) return null;
  const near = can.slice(0, 3);
  const choice = rnd() < skill ? can[0] : near[Math.floor(rnd() * near.length)] ?? can[0];
  const slots = slotsFor(state, side, choice);
  const slot = slots[0];
  return slot === undefined ? null : { name: choice.n, slot };
}

/** Play a whole match out, for the checks and for nothing else. */
export function playOut(
  config: DraftConfig,
  seed: number,
  skillA: number,
  skillB: number,
): H2HState {
  const rnd = mulberry32((seed ^ 0x1b873593) >>> 0);
  let state = newH2H(config, seed);
  let guard = 0;
  while (!state.done && guard++ < 200) {
    const side = state.turn;
    if (!side) break;
    const got = machinePick(state, side, rnd, side === 'a' ? skillA : skillB);
    if (!got) break;
    const next = pickH2H(state, side, got.name, got.slot);
    if (next === state) break;
    state = next;
  }
  return state;
}

/** What each XI is rated, for the strip and the result. */
export function ratings(state: H2HState): { a: number; b: number } {
  return {
    a: Math.round(squadAvg(state.a.squad)),
    b: Math.round(squadAvg(state.b.squad)),
  };
}

/** That side's XI, for handing to a season. */
export function xiOf(state: H2HState, side: Side): Slot[] {
  return squadOf(state, side).squad;
}
