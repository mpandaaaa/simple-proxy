/**
 * Print the spin reel's timing and haptic schedule.
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
  WHEEL, stepDelays, stepCount, tickSchedule, spinDuration,
  peakVelocity, arrivalVelocity, durationFor, SETTLE_MS,
} = w;

for (const allTime of [false, true]) {
  const delays = stepDelays(allTime);
  const run = delays.reduce((n, ms) => n + ms, 0);
  const ticks = tickSchedule(allTime);
  const phases = { 65: 0, 100: 0, 150: 0 };
  for (const d of delays) phases[d]++;

  console.log(allTime ? '\nALL TIME XI' : 'SQUAD DRAFT');
  console.log(`  site dur argument   ${durationFor(allTime)}ms`);
  console.log(`  steps               ${stepCount(allTime)}   (floor(dur / 65))`);
  console.log(`  phases              ${phases[65]} x 65ms, ${phases[100]} x 100ms, ${phases[150]} x 150ms`);
  console.log(`  stepped run         ${run}ms`);
  console.log(`  settle              spring stiffness ${WHEEL.SETTLE.stiffness}, damping ${WHEEL.SETTLE.damping}, mass ${WHEEL.SETTLE.mass}`);
  console.log(`  arrival velocity    ${Math.round(arrivalVelocity(allTime))}pt/s into the spring`);
  console.log(`  total               ${spinDuration(allTime)}ms  (run + ~${SETTLE_MS}ms settle)`);
  console.log(`  peak speed          ${Math.round(peakVelocity())}pt/s`);
  console.log(`  haptics             ${ticks.length}  (${ticks.length - 1} ticks, then the thud)`);
  console.log('   at ms  ' + ticks.map((t) => String(t.at).padStart(5)).join(''));
  let last = 0;
  console.log('   gap    ' + ticks.map((t) => { const g = t.at - last; last = t.at; return String(g).padStart(5); }).join(''));
}
