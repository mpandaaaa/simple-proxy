import { useSyncExternalStore } from 'react';
import {
  autoPick,
  h2hFrom,
  machinePick,
  mulberry32,
  newH2H,
  other,
  pickH2H,
  type DraftConfig,
  type H2HPick,
  type H2HState,
  type Side,
} from '../engine';
import { fetchPicks, sendPick } from '../net/h2hNet';
import type { Match } from '../net/lobby';

/**
 * The head to head in progress.
 *
 * Held outside React for the same reason the solo run is: the match
 * spans screens and a native stack throws a screen away the moment it is
 * popped. It also ticks once a second for the clock, and a whole board
 * redrawing because a countdown moved would make the mode feel worse
 * than no clock at all, so screens subscribe to the slice they draw.
 *
 * Two opponents, one code path. The Machine picks after a pause on a
 * timer; a person's picks arrive off the list. Neither of them is ever
 * asked what the state is, because both phones rebuild the whole match
 * from the seed and the picks, so the only thing that ever moves between
 * them is a pick.
 */

/** How long you get to pick before it is taken for you. */
export const SHOT_CLOCK_MS = 30000;
/**
 * And how long after that before the other phone takes it for you.
 *
 * A person who puts their phone down must not be able to end somebody
 * else's match. Both phones work out the same forced pick, both try to
 * write it, and the pick number being the key means exactly one lands.
 */
const MERCY_MS = 8000;

export type H2HMatch = {
  config: DraftConfig;
  seed: number;
  state: H2HState;
  /** which side you are */
  me: Side;
  opponentName: string;
  bot: boolean;
  /** the real duel, when the other chair holds a person */
  match: Match | null;
  /** how good the Machine is, when it is the Machine */
  skill: number;
  /** when the side to move runs out of time */
  deadline: number;
  /** true once both XIs are full */
  done: boolean;
};

let live: H2HMatch | null = null;
const listeners = new Set<() => void>();
let botTimer: ReturnType<typeof setTimeout> | null = null;
let poller: ReturnType<typeof setInterval> | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getH2H(): H2HMatch | null {
  return live;
}

export function useH2H(): H2HMatch | null {
  return useSyncExternalStore(subscribe, getH2H, getH2H);
}

function stopAll() {
  if (botTimer) clearTimeout(botTimer);
  if (poller) clearInterval(poller);
  if (ticker) clearInterval(ticker);
  botTimer = null;
  poller = null;
  ticker = null;
}

export function clearH2H(): void {
  stopAll();
  live = null;
  emit();
}

/** Push the state on, restart the clock, and set whatever has to happen next going. */
function settle(state: H2HState) {
  if (!live) return;
  const done = state.done;
  live = { ...live, state, done, deadline: done ? 0 : Date.now() + SHOT_CLOCK_MS };
  emit();
  if (done) {
    stopAll();
    return;
  }
  if (botTimer) clearTimeout(botTimer);
  botTimer = null;
  if (live.bot && state.turn === other(live.me)) scheduleMachine();
}

/**
 * The Machine takes its turn, after a pause.
 *
 * The pause is the point. A opponent that answers in four milliseconds
 * reads as a menu rather than a person, and there is no tension in a
 * board you never get to look at while somebody else is looking at it.
 */
function scheduleMachine() {
  if (!live || !live.bot) return;
  const rnd = mulberry32((live.seed ^ (live.state.picks.length * 2654435761)) >>> 0);
  const wait = 1100 + rnd() * 2600;
  botTimer = setTimeout(() => {
    if (!live || !live.bot) return;
    const side = live.state.turn;
    if (!side || side === live.me) return;
    const got = machinePick(live.state, side, rnd, live.skill);
    if (!got) return;
    settle(pickH2H(live.state, side, got.name, got.slot));
  }, wait);
}

/**
 * Start one.
 *
 * `me` is which side you are. The person who was already waiting in the
 * queue is B, so the one who arrived last gets the first pick of the
 * match: waiting is its own small advantage and this is the balance for
 * it.
 */
export function startH2H(args: {
  config: DraftConfig;
  seed: number;
  opponentName: string;
  bot: boolean;
  match: Match | null;
  /** left out to draw one, so no two Machines play the same */
  skill?: number;
}): void {
  stopAll();
  const { config, seed, opponentName, bot, match } = args;
  const me: Side = match && match.waited ? 'b' : 'a';
  const rnd = mulberry32((seed ^ 0x9e3779b9) >>> 0);

  live = {
    config,
    seed,
    state: newH2H(config, seed),
    me,
    opponentName,
    bot,
    match,
    skill: args.skill ?? 0.6 + rnd() * 0.32,
    deadline: Date.now() + SHOT_CLOCK_MS,
    done: false,
  };
  emit();

  /* One tick a second, so the clock on the screen is honest and so a turn
     that runs out is taken rather than left. */
  ticker = setInterval(tick, 1000);
  if (bot) {
    if (live.state.turn === other(me)) scheduleMachine();
  } else if (match) {
    poller = setInterval(() => void pull(), 1100);
    void pull();
  }
}

/** Take somebody. Only ever your own turn: the rules refuse the rest. */
export function take(name: string, slot: number): void {
  if (!live || live.done) return;
  const side = live.me;
  if (live.state.turn !== side) return;
  const n = live.state.picks.length;
  const next = pickH2H(live.state, side, name, slot);
  if (next === live.state) return;
  settle(next);
  if (live.match) void sendPick(live.match, { n, side, name, slot });
}

/**
 * A second's worth of clock.
 *
 * Your own time running out takes the obvious pick for you, because a
 * match that stops because somebody looked away is a worse outcome than
 * a pick they did not choose. Theirs running out is left alone for a few
 * seconds longer in case their phone is simply slow, and then taken from
 * here as well: both phones work out the same forced pick and the pick
 * number stops it being made twice.
 */
function tick() {
  if (!live || live.done) return;
  const now = Date.now();
  if (now < live.deadline) {
    emit();
    return;
  }
  const side = live.state.turn;
  if (!side) return;

  if (side === live.me) {
    const got = autoPick(live.state, side);
    if (!got) return;
    const n = live.state.picks.length;
    settle(pickH2H(live.state, side, got.name, got.slot));
    if (live.match) void sendPick(live.match, { n, side, name: got.name, slot: got.slot });
    return;
  }

  if (!live.match) return;
  if (now < live.deadline + MERCY_MS) {
    emit();
    return;
  }
  const got = autoPick(live.state, side);
  if (!got) return;
  const n = live.state.picks.length;
  settle(pickH2H(live.state, side, got.name, got.slot));
  void sendPick(live.match, { n, side, name: got.name, slot: got.slot });
}

/**
 * Read the list and catch up.
 *
 * Rebuilt from every pick rather than applying the new ones, so a phone
 * that missed four of them is right again after one read and there is no
 * such thing as applying a pick out of order.
 */
async function pull() {
  if (!live?.match || live.done) return;
  const picks = await fetchPicks(live.match);
  if (!live || !picks) return;
  if (picks.length <= live.state.picks.length) return;
  const rebuilt = h2hFrom(live.config, live.seed, picks as H2HPick[]);
  settle(rebuilt);
}

/** Seconds left on the clock, for the screen. */
export function secondsLeft(m: H2HMatch): number {
  if (m.done || !m.state.turn) return 0;
  return Math.max(0, Math.ceil((m.deadline - Date.now()) / 1000));
}
