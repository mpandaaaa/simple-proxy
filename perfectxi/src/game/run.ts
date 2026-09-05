import { useEffect, useRef, useSyncExternalStore } from 'react';
import { swap } from './nav';
import {
  ENGINE_VERSION,
  canPlay,
  mulberry32,
  newDraft,
  place,
  slotsForPlayer,
  spin,
  type DraftConfig,
  type DraftState,
  type Pick,
  type SeasonResult,
  type SpinResult,
  type SubmittedPick,
} from '../engine';

/**
 * The run in progress, held outside React.
 *
 * The draft spans three screens and a native stack unmounts a screen the
 * moment it is popped, so the run cannot live in a screen's state. It also
 * must not live in a context provider wrapping the whole app, because then
 * every tick of a season redraws Home. It lives here, and a screen
 * subscribes to the slice it draws.
 *
 * The engine stays pure: this holds the run, the engine decides what
 * happens to it.
 */

export type Run = {
  seed: number;
  engineVersion: number;
  /**
   * The Daily puzzle number, when this run is one.
   *
   * The Daily is the same game with a fixed seed, so it plays through the
   * same three screens rather than copies of them. This is how the last
   * of those screens knows to bank the result and count the streak.
   */
  daily: number | null;
  /** the Weekly Event number, when this run is one */
  weekly: number | null;
  /**
   * The duel code this run is answering.
   *
   * Set when a code has been entered, so the results screen knows there
   * is somebody to be measured against. Null when the run is a duel you
   * are creating rather than answering: that one becomes a code at the
   * end rather than starting from one.
   */
  duel: string | null;
  /** true when this run is being played to make a code to send */
  sending: boolean;
  /**
   * True when the XI came out of a head to head draft.
   *
   * The season is played exactly as any other, and only the page at the
   * end is different: a duel is a comparison rather than a report, so it
   * has its own review.
   */
  h2h: boolean;
  /**
   * Every pick in the order it was made, and the rerolls spent before it.
   *
   * Kept because it is the only thing that lets a leaderboard prove a run
   * was played rather than typed. A seed and a config fix which club
   * seasons are dealt, so the seed plus this list replays the whole run
   * spin for spin, and the server can work out the score for itself
   * instead of believing the phone.
   *
   * Nothing else reads it, and it leaves the phone only when somebody
   * submits to a board.
   */
  picks: SubmittedPick[];
  /** rerolls spent since the last pick, waiting to be recorded with it */
  spentRerolls: number;
  state: DraftState;
  /** the board on the table right now, unfiltered by blitz */
  board: Pick[] | null;
  club: string | null;
  season: string | null;
  spinning: boolean;
  result: SeasonResult | null;
};

let run: Run | null = null;
let rnd = mulberry32(1);
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** A seed the run can be replayed from, even for casual play. */
function freshSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

export function startRun(
  config: DraftConfig,
  seed = freshSeed(),
  kind: {
    daily?: number | null;
    weekly?: number | null;
    duel?: string | null;
    sending?: boolean;
  } = {},
): void {
  rnd = mulberry32(seed);
  run = {
    seed,
    engineVersion: ENGINE_VERSION,
    daily: kind.daily ?? null,
    weekly: kind.weekly ?? null,
    duel: kind.duel ?? null,
    sending: kind.sending ?? false,
    h2h: false,
    picks: [],
    spentRerolls: 0,
    state: newDraft(config),
    board: null,
    club: null,
    season: null,
    spinning: false,
    result: null,
  };
  emit();
}

export function getRun(): Run | null {
  return run;
}

/**
 * Start a run with the XI already picked.
 *
 * The head to head does its own drafting, on its own screen, with its own
 * rules. What comes out of it is eleven footballers, and from there it is
 * a season like any other: the same engine, the same page playing it out
 * match by match. Only the review at the end is different.
 */
export function startRunWithSquad(
  config: DraftConfig,
  seed: number,
  squad: DraftState['squad'],
): void {
  rnd = mulberry32(seed);
  const base = newDraft(config);
  run = {
    seed,
    engineVersion: ENGINE_VERSION,
    daily: null,
    weekly: null,
    duel: null,
    sending: false,
    h2h: true,
    /* a head to head XI is drafted by its own rules and is never ranked
       on a board, so there is no pick list to record */
    picks: [],
    spentRerolls: 0,
    state: { ...base, squad, filled: squad.filter((s) => s.player).length },
    board: null,
    club: null,
    season: null,
    spinning: false,
    result: null,
  };
  emit();
}

export function useRun(): Run | null {
  return useSyncExternalStore(subscribe, getRun, getRun);
}

/**
 * Draw a new board.
 *
 * `spinning` is set before the draw and cleared by the screen once its
 * reel has finished, so the animation and the state cannot disagree about
 * whether a spin is in flight.
 */
export function doSpin(): SpinResult | null {
  if (!run || run.spinning || run.state.filled >= run.state.total) return null;
  const result = spin(run.state, rnd);
  if (!result) return null;
  run = { ...run, spinning: true };
  emit();
  return result;
}

/** Called when the spin animation lands, putting the board on the table. */
export function settleSpin(result: SpinResult): void {
  if (!run) return;
  run = {
    ...run,
    spinning: false,
    board: result.board,
    club: result.club,
    season: result.season,
  };
  emit();
}

export function pickPlayer(player: Pick, slotIndex: number): void {
  if (!run) return;
  const next = place(run.state, player, slotIndex);
  if (next === run.state) return;
  run = {
    ...run,
    state: next,
    /* recorded as it happens, because after the fact there is no way to
       know which board a player came off or what was spent getting there */
    picks: [
      ...run.picks,
      { name: player.n, slot: slotIndex, rerolls: run.spentRerolls },
    ],
    spentRerolls: 0,
    board: null,
    club: null,
    season: null,
  };
  emit();
}

/** Rerolls do not refund a pick, they only replace the board in front of you. */
export function spendReroll(): boolean {
  if (!run) return false;
  if (run.state.rerolls >= run.state.rerollsMax) return false;
  run = {
    ...run,
    state: { ...run.state, rerolls: run.state.rerolls + 1 },
    /* counted against the pick this reroll was spent looking for */
    spentRerolls: run.spentRerolls + 1,
    board: null,
    club: null,
    season: null,
  };
  emit();
  return true;
}

/**
 * Fill the rest of the XI, taking the best playable player off every board.
 *
 * A testing tool, so the draft does not have to be played by hand to reach
 * squad complete and the season. It is not a shortcut around the rules: it
 * spins through the same engine, draws from the run's own generator, and
 * respects position eligibility, so the squad it produces is one that could
 * have been drafted by hand.
 *
 * The whole run happens before anything is emitted, so the eleven picks are
 * one update rather than eleven renders.
 */
export function autoFill(): void {
  if (!run) return;

  let state = run.state;
  let guard = 0;
  while (state.filled < state.total) {
    if (++guard > 500) break;
    const result = spin(state, rnd);
    if (!result) break;
    const choice = result.board.find((p) => canPlay(state, p));
    if (!choice) continue;
    const slots = slotsForPlayer(state, choice);
    if (!slots.length) continue;
    state = place(state, choice, slots[0]);
  }

  run = { ...run, state, board: null, club: null, season: null, spinning: false };
  emit();
}

export function setResult(result: SeasonResult): void {
  if (!run) return;
  run = { ...run, result };
  emit();
}

/** The generator the season must be played with, so the run stays replayable. */
export function runRng() {
  return rnd;
}

export function clearRun(): void {
  run = null;
  emit();
}

/**
 * The run, with a redirect for arriving at a draft screen without one.
 *
 * Three screens needed this and each had its own copy, which is how the
 * same bug shipped twice. The subtlety is the guard: the redirect is for
 * opening a screen with nothing loaded, not for the run ending.
 *
 * A finished run is cleared while every screen of the draft is still
 * mounted underneath the results page, and a stack unmounts them over
 * several frames rather than at once. An unguarded screen sees the empty
 * run in that window and replaces whatever route is on top, which is how
 * taking an XI into a Dynasty landed on the draft setup instead.
 *
 * Once a run has existed on a screen, losing it means the flow is
 * finishing and that screen should say nothing.
 */
export function useRequireRun(): Run | null {
  const run = useRun();
  const everHadRun = useRef(false);
  if (run) everHadRun.current = true;

  useEffect(() => {
    if (!run && !everHadRun.current) swap('/draft');
  }, [run]);

  return run;
}
