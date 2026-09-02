import { useSyncExternalStore } from 'react';
import { dynastyStore } from '../save';
import type { Dynasty } from '../engine';

/**
 * The career in progress, shared by every Dynasty screen.
 *
 * Eight screens all read the same save, and each one reading it on mount
 * meant a screen could sit there showing a squad you had already changed
 * on another. This is one copy, held outside React, written through to
 * storage on every change, and every screen subscribes to it.
 */

let current: Dynasty | null = dynastyStore.read();
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

function snapshot(): Dynasty | null {
  return current;
}

export function useCareer(): Dynasty | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function getCareer(): Dynasty | null {
  return current;
}

/** Write the career, to memory and to disk, in that order. */
export function setCareer(d: Dynasty | null): void {
  current = d;
  dynastyStore.write(d);
  emit();
}

/** Change it in place, for the many screens that adjust one field. */
export function updateCareer(fn: (d: Dynasty) => Dynasty): void {
  if (!current) return;
  setCareer(fn(current));
}

/**
 * Re-read from disk.
 *
 * Only needed when something outside this module wrote the save, which is
 * the draft's "take this XI into a Dynasty" and nothing else.
 */
export function reloadCareer(): void {
  current = dynastyStore.read();
  emit();
}
