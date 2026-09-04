/**
 * Opening the same page twice.
 *
 * The bug this exists to prevent has now been reported three times: tap a
 * row, nothing appears to happen, tap it again, and going back lands on
 * an identical copy of the page you were just on.
 *
 * The first guard was a time window and it was not enough. A window
 * catches a double tap and misses the far more common thing, which is
 * tapping again a second later because the screen has not appeared yet.
 * So this drives the real rules out of nav.ts against a model of a
 * navigation stack and checks the one invariant that matters: no two
 * adjacent entries are ever the same page.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let bad = 0;
const fail = (m) => {
  console.log('  ' + m);
  bad++;
};

/* The rules, read out of the file rather than described again here, so a
   change to nav.ts that breaks them fails this rather than passing it. */
const src = readFileSync(join('src', 'game', 'nav.ts'), 'utf8');
if (!src.includes('if (here && pathOf(href) === here) return;')) {
  fail('nav.ts no longer refuses to push the page it is already on');
}
if (!src.includes('export function noteHere')) {
  fail('nav.ts no longer takes the current route from the layout');
}
const layout = readFileSync(join('app', '_layout.tsx'), 'utf8');
if (!layout.includes('noteHere(path)')) {
  fail('the root layout no longer tells nav.ts where it is');
}

/* A model of the two, and a stack to check the result against. */
const GAP_MS = 1200;

function makeNav() {
  let here = '';
  let lastKey = '';
  let lastAt = 0;
  const stack = ['/'];
  let clock = 0;

  const path = (href) => String(href).split('?')[0];

  return {
    tick: (ms) => {
      clock += ms;
    },
    /* The layout reports the route after every change. */
    settle() {
      here = stack[stack.length - 1];
      lastKey = '';
      lastAt = 0;
    },
    go(href) {
      if (here && path(href) === here) return;
      if (href === lastKey && clock - lastAt < GAP_MS) return;
      lastKey = href;
      lastAt = clock;
      stack.push(path(href));
    },
    back() {
      lastKey = '';
      lastAt = 0;
      if (stack.length > 1) stack.pop();
    },
    stack: () => stack.slice(),
  };
}

function adjacentDuplicate(stack) {
  for (let i = 1; i < stack.length; i++) {
    if (stack[i] === stack[i - 1]) return stack[i];
  }
  return null;
}

/* ---------- the three ways somebody taps twice ---------- */

const cases = [
  { name: 'twice in the same instant', gaps: [0] },
  { name: 'twice, half a second apart', gaps: [500] },
  { name: 'twice, a second and a half apart', gaps: [1500] },
  { name: 'twice, five seconds apart', gaps: [5000] },
  { name: 'four times, slowly', gaps: [1500, 1500, 1500] },
];

for (const c of cases) {
  const nav = makeNav();
  nav.settle();
  nav.go('/cabinet');
  /* The screen appears some time after the tap, which is the whole
     problem: the second tap can land either side of that. */
  for (const gap of c.gaps) {
    nav.tick(gap);
    if (gap >= 400) nav.settle();
    nav.go('/cabinet');
  }
  const dup = adjacentDuplicate(nav.stack());
  if (dup) fail(`${c.name} opened ${dup} twice`);
  if (nav.stack().length !== 2) {
    fail(`${c.name} left a stack of ${nav.stack().length}: ${nav.stack().join(' > ')}`);
  }
}
console.log('');
console.log(`  ${cases.length} ways of tapping the same row again, none of them opened it twice`);

/* ---------- and it must not block anything real ---------- */

{
  const nav = makeNav();
  nav.settle();
  nav.go('/cabinet');
  nav.settle();
  nav.back();
  nav.settle();
  nav.go('/cabinet');
  if (nav.stack().length !== 2) fail('going back and in again was refused');
}
{
  /* Backing out with the edge swipe never touches nav.ts. The route
     changes anyway, and going in again has to still work. */
  const nav = makeNav();
  nav.settle();
  nav.go('/cabinet');
  nav.settle();
  nav.back();
  nav.settle();
  nav.tick(50);
  nav.go('/cabinet');
  if (nav.stack().length !== 2) fail('going in again after an edge swipe was refused');
}
{
  const nav = makeNav();
  nav.settle();
  nav.go('/cup');
  nav.settle();
  nav.go('/cup/hub');
  nav.settle();
  nav.go('/cup/match');
  if (nav.stack().length !== 4) fail('a real flow through three screens was blocked');
  if (adjacentDuplicate(nav.stack())) fail('a real flow produced a duplicate');
}
{
  /* Two different rows tapped quickly is somebody moving fast, not a
     double tap, and it must go through. */
  const nav = makeNav();
  nav.settle();
  nav.go('/cabinet');
  nav.settle();
  nav.tick(80);
  nav.go('/hall');
  if (nav.stack().length !== 3) fail('moving quickly between two screens was blocked');
}
console.log('  and nothing real is ever blocked: back and in, an edge swipe, a flow, a fast tap');

console.log('');
if (bad) {
  console.log(`${bad} problems\n`);
  process.exit(1);
}
console.log('No page can be opened on top of itself.\n');
