import { useSyncExternalStore } from 'react';
import { uclDraftStore } from '../save';
import { uclDraftPlace, uclDraftStart, type UclDraftState, type UclPick } from '../engine';

/**
 * The Champions League XI being drafted, shared by its screens.
 *
 * One copy outside React, written through on every pick. A draft is eleven
 * decisions and every one of them is worth keeping.
 */

let current: UclDraftState | null = uclDraftStore.read();
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

function snapshot(): UclDraftState | null {
  return current;
}

export function useUclDraft(): UclDraftState | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function getUclDraft(): UclDraftState | null {
  return current;
}

function set(state: UclDraftState | null): void {
  current = state;
  uclDraftStore.write(state);
  emit();
}

export function beginUclDraft(formation: string): UclDraftState {
  const state = uclDraftStart(formation, Math.floor(Math.random() * 0x100000000) >>> 0);
  set(state);
  return state;
}

export function pickUclPlayer(p: UclPick, slot: number): UclDraftState | null {
  if (!current) return null;
  const next = uclDraftPlace(current, p, slot);
  if (next === current) return current;
  set(next);
  return next;
}

export function clearUclDraft(): void {
  set(null);
}
