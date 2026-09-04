import { useSyncExternalStore } from 'react';
import { showBreak } from './ads';
import { cupStore } from '../save';
import { cupPlayNext, cupStart, type CupPlayed, type CupTieRun } from '../engine';

/**
 * The knockout in progress, shared by its screens.
 *
 * Same shape as the two tournaments: one copy held outside React, written
 * through on every change, every screen subscribing.
 */

let current: CupTieRun | null = cupStore.read();
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

function snapshot(): CupTieRun | null {
  return current;
}

export function useCup(): CupTieRun | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function getCup(): CupTieRun | null {
  return current;
}

export function setCup(run: CupTieRun | null): void {
  current = run;
  cupStore.write(run);
  emit();
}

/** Begin one. Replaces whatever was there, which the screen confirms first. */
export function startCup(field: string[], you: string): CupTieRun {
  const run = cupStart(field, you, Math.floor(Math.random() * 0x100000000) >>> 0);
  setCup(run);
  return run;
}

/**
 * Play the next tie.
 *
 * Returns what happened so the match screen can show it, and banks the
 * run before it returns, so a tie that has been seen has been saved.
 */
export function playNextTie(): CupPlayed | null {
  if (!current) return null;
  const step = cupPlayNext(current);
  if (!step) return null;
  setCup(step.run);
  if (step.run.over) void showBreak('cup');
  return step;
}

export function clearCup(): void {
  setCup(null);
}
