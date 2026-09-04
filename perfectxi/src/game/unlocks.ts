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

/**
 * How many will ever be shown at once.
 *
 * Each one holds the screen for three and a half seconds, so twenty of
 * them is over a minute of banners with nothing else to do. That happens
 * for real: the first time an existing player opens a build with a new
 * shelf in the cabinet, everything they already qualified for is earned
 * at once.
 *
 * Anything past the cap is still earned and still in the cabinet. It just
 * does not queue up to be announced.
 */
const SHOW_AT_MOST = 4;

export function pushUnlocks(keys: readonly string[]): void {
  if (!keys.length) return;
  const room = Math.max(0, SHOW_AT_MOST - queue.length);
  if (!room) return;
  queue = [...queue, ...keys.slice(0, room)];
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
