/**
 * The queue of achievements waiting to be shown.
 *
 * Held outside React, like the run is, because an achievement is earned
 * while a screen is banking a season and has to be shown by something
 * mounted above the whole navigator. Anything can push; one thing listens.
 *
 * Three at once is common, a treble season can be six, so they queue and
 * come out one at a time rather than stacking up the screen.
 */

let queue: string[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeUnlocks(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function peekUnlock(): string | null {
  return queue[0] ?? null;
}

export function pushUnlocks(keys: readonly string[]): void {
  if (!keys.length) return;
  queue = [...queue, ...keys];
  emit();
}

/** Called by the banner once it has finished showing the front one. */
export function shiftUnlock(): void {
  if (!queue.length) return;
  queue = queue.slice(1);
  emit();
}

export function clearUnlocks(): void {
  if (!queue.length) return;
  queue = [];
  emit();
}
