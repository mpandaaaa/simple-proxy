/**
 * Print the spin wheel's haptic schedule.
 *
 * Tuning the spin by holding a phone and saying "about right" does not
 * converge. This prints the actual numbers: how long the spin runs, when
 * every tick fires, and how the gaps open up as the reel slows.
 *
 *   npm run wheel
 */
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { WHEEL, tickSchedule, spinDuration, travelDistance, landingAt, ease } =
  require(resolve(root, '.headless/game/wheel.js'));

const ticks = tickSchedule();

console.log('SPIN');
console.log(`  strip height     ${WHEEL.ITEM}pt, ${WHEEL.VISIBLE} visible`);
console.log(`  strips passed    ${WHEEL.TRAVEL}`);
console.log(`  travel           ${travelDistance}pt (incl. ${WHEEL.OVERSHOOT}pt overshoot)`);
console.log(`  long run         ${WHEEL.SPIN_MS}ms, quadratic out`);
console.log(`  snap back        ${WHEEL.SNAP_MS}ms spring`);
console.log(`  winner centred   ${landingAt()}ms`);
console.log(`  total            ${spinDuration}ms`);

console.log(`\nHAPTICS  ${ticks.length} ticks, plus one firmer tap on landing`);
console.log('  #   at ms   gap   strip');
let last = 0;
for (const t of ticks) {
  console.log(
    '  ' +
      String(ticks.indexOf(t) + 1).padStart(2) +
      String(t.at).padStart(8) +
      String(t.at - last).padStart(6) +
      String(t.index).padStart(8),
  );
  last = t.at;
}

// How much of the distance is covered in each quarter of the run, which is
// the number that decides whether it reads as a slot machine or as a slide.
console.log('\nDECELERATION');
for (const q of [0.25, 0.5, 0.75, 1]) {
  const pct = Math.round(ease(q) * 100);
  console.log(`  ${String(Math.round(q * 100)).padStart(3)}% of the time   ${String(pct).padStart(3)}% of the distance`);
}
