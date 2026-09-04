import { useSyncExternalStore } from 'react';
import { worldCupStore } from '../save';
import { wcPlayNext, wcStart, type WcPlayed, type WcRun } from '../engine';

/**
 * The World Cup in progress, shared by its screens.
 *
 * Same shape as the Dynasty career: one copy held outside React, written
 * through to storage on every change, and every screen subscribing to
 * it. Four screens read the same run, and four screens each reading the
 * save on mount is how one of them ends up showing a group table from
 * before the match you just played.
 */

let current: WcRun | null = worldCupStore.read();
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

function snapshot(): WcRun | null {
  return current;
}

export function useWorldCup(): WcRun | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function getWorldCup(): WcRun | null {
  return current;
}

export function setWorldCup(run: WcRun | null): void {
  current = run;
  worldCupStore.write(run);
  emit();
}

/** Begin one. Replaces whatever was there, which the screen confirms first. */
export function startWorldCup(nation: string): WcRun {
  const run = wcStart(nation, Math.floor(Math.random() * 0x100000000) >>> 0);
  setWorldCup(run);
  return run;
}

/**
 * Play the next match.
 *
 * Returns what happened so the match screen can show it, and banks the
 * run before it returns, so a match that has been seen has been saved.
 */
export function playNextMatch(): WcPlayed | null {
  if (!current) return null;
  const step = wcPlayNext(current);
  if (!step) return null;
  setWorldCup(step.run);
  return step;
}

export function clearWorldCup(): void {
  setWorldCup(null);
}
