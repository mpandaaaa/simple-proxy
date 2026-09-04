import { useSyncExternalStore } from 'react';
import { uclStore } from '../save';
import {
  uclPlayNext,
  uclSkipLeague,
  uclStart,
  type UclCustom,
  type UclMatch,
  type UclPlayed,
  type UclRun,
} from '../engine';

/**
 * The Champions League campaign in progress, shared by its screens.
 *
 * Same shape as the World Cup: one copy held outside React, written
 * through to storage on every change, and every screen subscribing to it.
 * Five screens read the same campaign, and five screens each reading the
 * save on mount is how one of them ends up showing yesterday's table.
 */

let current: UclRun | null = uclStore.read();
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

function snapshot(): UclRun | null {
  return current;
}

export function useUcl(): UclRun | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function getUcl(): UclRun | null {
  return current;
}

export function setUcl(run: UclRun | null): void {
  current = run;
  uclStore.write(run);
  emit();
}

/**
 * Begin one. Replaces whatever was there, which the screen confirms first.
 *
 * With a drafted XI, the club is the place in the league phase you take
 * and everything that decides a match comes from the eleven instead.
 */
export function startUcl(club: string, custom?: UclCustom | null): UclRun {
  const run = uclStart(club, Math.floor(Math.random() * 0x100000000) >>> 0, custom ?? null);
  setUcl(run);
  return run;
}

/**
 * Play the next match.
 *
 * Returns what happened so the match screen can show it, and banks the run
 * before it returns, so a match that has been seen has been saved.
 */
export function playNextUcl(): UclPlayed | null {
  if (!current) return null;
  const step = uclPlayNext(current);
  if (!step) return null;
  setUcl(step.run);
  return step;
}

/** Play out the rest of the league phase in one go. */
export function skipLeaguePhase(): UclMatch[] {
  if (!current) return [];
  const done = uclSkipLeague(current);
  setUcl(done.run);
  return done.matches;
}

export function clearUcl(): void {
  setUcl(null);
}
