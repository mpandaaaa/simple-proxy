import { useSyncExternalStore } from 'react';
import { wcDraftStore } from '../save';
import {
  wcDraftStart,
  wcPlace,
  type WcDraftState,
  type WcPick,
} from '../engine';

/**
 * The World XI being drafted, shared by its screens.
 *
 * Same shape as the run itself: one copy held outside React, written
 * through to storage on every pick, and the screens subscribing to it. A
 * draft is eleven decisions and every one of them is worth keeping, so
 * every one of them is saved as it is made.
 */

let current: WcDraftState | null = wcDraftStore.read();
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

function snapshot(): WcDraftState | null {
  return current;
}

export function useWcDraft(): WcDraftState | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function getWcDraft(): WcDraftState | null {
  return current;
}

function set(state: WcDraftState | null): void {
  current = state;
  wcDraftStore.write(state);
  emit();
}

/** Begin one, throwing away whatever was there. */
export function beginWcDraft(formation: string): WcDraftState {
  const state = wcDraftStart(formation, Math.floor(Math.random() * 0x100000000) >>> 0);
  set(state);
  return state;
}

/** Take one of the five. Does nothing if he cannot go in that shirt. */
export function pickWcPlayer(p: WcPick, slot: number): WcDraftState | null {
  if (!current) return null;
  const next = wcPlace(current, p, slot);
  if (next === current) return current;
  set(next);
  return next;
}

export function clearWcDraft(): void {
  set(null);
}
