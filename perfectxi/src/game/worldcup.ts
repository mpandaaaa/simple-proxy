import { useSyncExternalStore } from 'react';
import { showBreak } from './ads';
import { worldCupStore } from '../save';
import { awardWorldCup } from './award';
import { wcPlayNext, wcStart, type WcCustom, type WcPlayed, type WcRun } from '../engine';

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

/**
 * Begin one. Replaces whatever was there, which the screen confirms first.
 *
 * With a custom side, the nation is the place in the draw you take and the
 * flag you carry; everything that decides a match comes from the XI you
 * drafted instead.
 */
export function startWorldCup(nation: string, custom?: WcCustom | null): WcRun {
  const run = wcStart(nation, Math.floor(Math.random() * 0x100000000) >>> 0, custom ?? null);
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
  /* A tournament that has just ended is the moment the cabinet has to be
     told, because the run is thrown away when the next one starts. */
  if (step.run.over) {
    awardWorldCup(step.run);
    /* The tournament is finished, which is a break rather than an
       interruption. The advert decides for itself whether it is too soon. */
    void showBreak('tournament');
  }
  return step;
}

export function clearWorldCup(): void {
  setWorldCup(null);
}
