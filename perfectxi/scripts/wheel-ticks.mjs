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
const {
  WHEEL, STEP_COUNT, NEAR_MISS_AT, WINNER_AT, OVERSHOOT_AT,
  SETTLE_SPRING, SETTLE_MS, tickSchedule, spinDuration, peakVelocity,
} = w;

const ticks = tickSchedule();
const steps = WHEEL.STEPS.reduce((n, ms) => n + ms, 0);

console.log('SPIN');
console.log(`  card              ${WHEEL.CARD_W}x${WHEEL.CARD_H}pt, pitch ${WHEEL.CARD}pt`);
console.log(`  detents           ${STEP_COUNT} before the held beat`);
console.log(`  peak speed        ${Math.round(peakVelocity())}pt/s`);
console.log('');
console.log(`  creep back        ${WHEEL.CREEP}pt over ${WHEEL.CREEP_MS}ms`);
console.log(`  stepped run       ${steps}ms   ${WHEEL.STEPS.join(' / ')}`);
console.log(`  held beat         ${WHEEL.HELD_MS}ms on the near miss`);
console.log(`  lurch             ${WHEEL.LURCH_MS}ms, ${WHEEL.OVERSHOOT_CARDS} card past the winner`);
console.log(`  settle            spring stiffness ${SETTLE_SPRING.stiffness}, damping ${SETTLE_SPRING.damping}, mass ${SETTLE_SPRING.mass}  (~${SETTLE_MS}ms)`);
console.log(`  total             ${spinDuration()}ms`);
console.log('');
console.log(`  detent indexes    near miss ${NEAR_MISS_AT}, winner ${WINNER_AT}, overshoot ${OVERSHOOT_AT}`);

console.log(`\nHAPTICS  ${ticks.length} events, the last one firm`);
let last = 0;
console.log('   #   at ms   gap  detent');
ticks.forEach((t, i) => {
  console.log(
    '  ' + String(i + 1).padStart(2) + String(t.at).padStart(8) +
    String(t.at - last).padStart(6) + String(t.detent).padStart(8) +
    (t.strong ? '   <- lands' : ''),
  );
  last = t.at;
});
