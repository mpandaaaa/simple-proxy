import { useSyncExternalStore } from 'react';
import {
  ENGINE_VERSION,
  mulberry32,
  newDraft,
  place,
  spin,
  type DraftConfig,
  type DraftState,
  type Pick,
  type SeasonResult,
  type SpinResult,
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

export function startRun(config: DraftConfig, seed = freshSeed()): void {
  rnd = mulberry32(seed);
  run = {
    seed,
    engineVersion: ENGINE_VERSION,
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
  run = { ...run, state: next, board: null, club: null, season: null };
  emit();
}

/** Rerolls do not refund a pick, they only replace the board in front of you. */
export function spendReroll(): boolean {
  if (!run) return false;
  if (run.state.rerolls >= run.state.rerollsMax) return false;
  run = {
    ...run,
    state: { ...run.state, rerolls: run.state.rerolls + 1 },
    board: null,
    club: null,
    season: null,
  };
  emit();
  return true;
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
