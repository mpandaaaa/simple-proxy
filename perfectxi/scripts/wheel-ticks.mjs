/**
 * Print the spin reel's timing and haptic schedule.
 *
 * Tuning a spin by holding a phone and saying "about right" does not
 * converge. This prints the numbers instead.
 *
 *   npm run wheel
 */
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const w = require(resolve(root, '.headless/game/wheel.js'));
const { WHEEL, tickSchedule, spinDuration, landingAt, travelDistance, peakVelocity, ease } = w;

for (const allTime of [false, true]) {
  const ticks = tickSchedule(allTime);
  console.log(allTime ? '\nALL TIME XI' : 'SQUAD DRAFT');
  console.log(`  card             ${WHEEL.CARD_W}x${WHEEL.CARD_H}pt, pitch ${WHEEL.CARD}pt`);
  console.log(`  cards passed     ${WHEEL.TRAVEL}`);
  console.log(`  travel           ${travelDistance}pt (incl. ${WHEEL.OVERSHOOT}pt overshoot, half a card)`);
  console.log(`  creep back       ${WHEEL.CREEP}pt over ${WHEEL.CREEP_MS}ms`);
  console.log(`  run              ${allTime ? WHEEL.SPIN_MS_ALLTIME : WHEEL.SPIN_MS}ms, quadratic out`);
  console.log(`  peak speed       ${Math.round(peakVelocity(allTime))}pt/s`);
  console.log(`  winner centred   ${landingAt(allTime)}ms`);
  console.log(`  snap             ${WHEEL.SNAP_MS}ms spring`);
  console.log(`  total            ${spinDuration(allTime)}ms`);
  console.log(`  ticks            ${ticks.length}`);

  let last = 0;
  const gaps = ticks.map((t) => {
    const g = t.at - last;
    last = t.at;
    return g;
  });
  console.log('   at ms  ' + ticks.map((t) => String(t.at).padStart(5)).join(''));
  console.log('   gap    ' + gaps.map((g) => String(g).padStart(5)).join(''));
}

console.log('\nDECELERATION');
for (const q of [0.25, 0.5, 0.75, 1]) {
  console.log(
    `  ${String(Math.round(q * 100)).padStart(3)}% of the run   ${String(Math.round(ease(q) * 100)).padStart(3)}% of the distance`,
  );
}
