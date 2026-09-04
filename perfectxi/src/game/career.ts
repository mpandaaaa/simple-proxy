import { useSyncExternalStore } from 'react';
import { DYNASTY_SLOTS, dynastySlots, dynastySummary, slotStore } from '../save';
import type { Dynasty } from '../engine';
import type { DynastySummary } from '../save';

/**
 * The career in progress, shared by every Dynasty screen.
 *
 * Eight screens all read the same save, and each one reading it on mount
 * meant a screen could sit there showing a squad you had already changed
 * on another. This is one copy, held outside React, written through to
 * storage on every change, and every screen subscribes to it.
 *
 * There are three careers now rather than one. Only the one you are
 * playing is held here: switching slots reads the new one and tells every
 * screen, and the other two sit on disk untouched. Nothing above this
 * module knows there is more than one, apart from the screen that picks.
 */

function store(n: number) {
  return dynastySlots[Math.max(0, Math.min(DYNASTY_SLOTS - 1, n))];
}

/* Which one was being played last time. A record that will not read means
   the first one, which is where a career lived before there were three. */
let slot = ((): number => {
  try {
    const at = slotStore.read().active;
    return at >= 0 && at < DYNASTY_SLOTS ? at : 0;
  } catch {
    return 0;
  }
})();

let current: Dynasty | null = store(slot).read();
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
  store(slot).write(d);
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
  current = store(slot).read();
  emit();
}

/* ---------- the three of them ---------- */

export function activeSlot(): number {
  return slot;
}

export function useActiveSlot(): number {
  return useSyncExternalStore(subscribe, activeSlot, activeSlot);
}

/**
 * Play a different one.
 *
 * The slot is written first so that a crash between the two lines leaves
 * the app pointing at a career that exists rather than at one it has
 * already forgotten how to find.
 */
export function switchSlot(n: number): void {
  const to = Math.max(0, Math.min(DYNASTY_SLOTS - 1, Math.round(n)));
  if (to === slot) return;
  slot = to;
  try {
    slotStore.write({ active: to });
  } catch {
    /* A slot that will not save means the app opens on the old one next
       time, which is recoverable. Losing the career is not. */
  }
  current = store(to).read();
  emit();
}

/** Throw one away without touching the other two. */
export function clearSlot(n: number): void {
  const at = Math.max(0, Math.min(DYNASTY_SLOTS - 1, Math.round(n)));
  store(at).write(null);
  if (at === slot) {
    current = null;
    emit();
  } else {
    /* Still tell the screens: the one that lists all three is looking. */
    emit();
  }
}

export type SlotSummary = {
  n: number;
  career: DynastySummary | null;
  /** how many seasons are in it, which is what a save slot is really worth */
  seasons: number;
  active: boolean;
};

/** All three, for the screen that picks between them. */
export function slotSummaries(): SlotSummary[] {
  const out: SlotSummary[] = [];
  for (let n = 0; n < DYNASTY_SLOTS; n++) {
    let d: Dynasty | null = null;
    try {
      d = n === slot ? current : store(n).read();
    } catch {
      d = null;
    }
    out.push({
      n,
      career: dynastySummary(d),
      seasons: d ? d.year : 0,
      active: n === slot,
    });
  }
  return out;
}
