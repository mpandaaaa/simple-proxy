import { router } from 'expo-router';

/**
 * Going somewhere, once.
 *
 * A native stack pushes the moment it is told to, and a tap that lands
 * twice inside the same few hundred milliseconds tells it twice. The
 * screen then appears on the stack twice, and going back from it lands
 * on an identical copy of itself, which reads as the app being stuck.
 *
 * A person cannot deliberately open the same page twice in under a
 * second, so a second push of the same destination inside that window is
 * always an accident and is dropped. Anything else goes through
 * untouched: this is not a general throttle and it never stops somebody
 * moving quickly through a flow.
 *
 * Everything in the app navigates through here rather than calling the
 * router, so the guard cannot be forgotten on the next screen somebody
 * adds.
 */

type Href = Parameters<typeof router.push>[0];

/** How long the same destination is refused for. */
const GAP_MS = 900;

let lastKey = '';
let lastAt = 0;

function keyOf(href: Href): string {
  return typeof href === 'string' ? href : JSON.stringify(href);
}

export function go(href: Href): void {
  const key = keyOf(href);
  const now = Date.now();
  if (key === lastKey && now - lastAt < GAP_MS) return;
  lastKey = key;
  lastAt = now;
  router.push(href);
}

/**
 * Replace what is on top rather than stacking on it.
 *
 * Guarded the same way. A replace cannot stack, but a double tap on the
 * thing that replaces still runs the work behind it twice.
 */
export function swap(href: Href): void {
  const key = `!${keyOf(href)}`;
  const now = Date.now();
  if (key === lastKey && now - lastAt < GAP_MS) return;
  lastKey = key;
  lastAt = now;
  router.replace(href);
}

/**
 * Back to a screen already underneath you, rather than a new copy of it.
 *
 * `swap` replaces what is on top, which is right for a screen that has
 * finished but wrong for coming home from a match: the hub is already on
 * the stack, and replacing the match with a second hub leaves two of
 * them, so going back from a tournament lands on an identical copy of
 * itself. This pops back to the one that is already there.
 *
 * Falls back to a plain back if that route is not on the stack, which is
 * what the router would have done anyway.
 */
export function upTo(href: Href): void {
  lastKey = '';
  lastAt = 0;
  try {
    router.dismissTo(href);
  } catch {
    if (router.canGoBack()) router.back();
    else router.replace(href);
  }
}

/**
 * Going back.
 *
 * Clears the guard, because leaving a screen and coming straight back to
 * it is a thing people do on purpose.
 */
export function back(): void {
  lastKey = '';
  lastAt = 0;
  router.back();
}

/** Down to the root, for anything that ends a run. */
export function home(): void {
  lastKey = '';
  lastAt = 0;
  router.dismissAll();
}
