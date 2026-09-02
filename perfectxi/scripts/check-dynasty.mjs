/**
 * The Dynasty numbers that say the ageing is intact.
 *
 * The web build's stated balance is that a 92 rated 23 year old is worth
 * about £125m, a 70 about £24m and an 85 about £77m. Those are the
 * anchors. The rest measures whether a career actually behaves: young
 * players improve, old ones fall away, and the great ones retire later
 * than the fringe ones.
 */
import { mulberry32 } from '../.headless/engine/rng.js';
import {
  value,
  wage,
  seedTracks,
  ageOne,
  retireOdds,
  overall,
} from '../.headless/engine/dynasty.js';

let failures = 0;

function check(label, got, lo, hi, fmt = (v) => String(v)) {
  const ok = got >= lo && got <= hi;
  if (!ok) failures++;
  console.log(
    `  ${ok ? 'pass' : 'FAIL'}  ${label.padEnd(36)} ${fmt(got).padStart(8)}   expected ${fmt(lo)} to ${fmt(hi)}`,
  );
}

console.log('\nVALUATION, at peak age with a long contract');
// The stated anchor, 'a 92 rated 23 year old worth about £125m', is an
// attacker. The position multiplier is the difference: the same player as
// a midfielder is £113m and as a keeper £81m.
check('92 attacker, 23 years old', value(92, 23, 'ATT', 4), 118, 130, (v) => '£' + v + 'm');
check('92 midfielder, 23 years old', value(92, 23, 'MID', 4), 108, 118, (v) => '£' + v + 'm');
check('85 midfielder, 23 years old', value(85, 23, 'MID', 4), 66, 74, (v) => '£' + v + 'm');
check('70 midfielder, 23 years old', value(70, 23, 'MID', 4), 20, 25, (v) => '£' + v + 'm');
check('92 midfielder, 33 years old', value(92, 33, 'MID', 4), 22, 28, (v) => '£' + v + 'm');
check('an attacker costs more than a keeper', value(88, 24, 'ATT', 4) - value(88, 24, 'GK', 4), 28, 36, (v) => '£' + v + 'm');

console.log('\nWAGES, weekly and in thousands');
check('65 rated squad player', wage(65, 26), 30, 38, (v) => '£' + v + 'k');
check('90 rated star', wage(90, 27), 225, 252, (v) => '£' + v + 'k');
check('a teenager is paid less', wage(80, 20), 40, 60, (v) => '£' + v + 'k');

console.log('\nAGEING, 400 careers per case');
function career(rtg, age, pos, years, seed) {
  const rnd = mulberry32(seed);
  let p = seedTracks(
    {
      n: 'Test', nat: 'ENG', pos, club: 'X', season: '2020/21', rtg, age,
      contract: { yrs: 4, wage: 0 }, apps: 0, goals: 0, injHist: 0,
    },
    rnd,
  );
  for (let i = 0; i < years; i++) p = ageOne(p, rnd);
  return p;
}

function mean(rtg, age, pos, years) {
  let t = 0;
  for (let i = 0; i < 400; i++) t += career(rtg, age, pos, years, i * 7919 + 13).rtg;
  return Math.round((t / 400) * 10) / 10;
}

check('an 80 rated 21 year old, 5 years on', mean(80, 21, 'MID', 5), 82, 89);
check('a 92 rated 23 year old, 5 years on', mean(92, 23, 'MID', 5), 93, 98);
// An attacker past his peak loses about a point a year, which is the
// tuned curve rather than a guess: physical is 40% of his overall and it
// is the only track falling.
check('an 88 rated attacker at 30, 5 years on', mean(88, 30, 'ATT', 5), 79, 85);
// A keeper barely moves. His overall is mostly technical and mental, and
// both hold well past thirty.
check('a 90 rated keeper at 32, 5 years on', mean(90, 32, 'GK', 5), 85, 91);
check('seeded rating is preserved', career(84, 25, 'DEF', 0, 5).rtg, 84, 84);

console.log('\nRETIREMENT, chance in one season');
function odds(rtg, age, pos) {
  const p = career(rtg, age, pos, 0, 99);
  p.age = age;
  p.rtg = rtg;
  return Math.round(retireOdds(p) * 1000) / 10;
}
check('a 90 at 30', odds(90, 30, 'MID'), 0, 0, (v) => v + '%');
check('a 90 at 35', odds(90, 35, 'MID'), 0, 12, (v) => v + '%');
check('a 70 at 35', odds(70, 35, 'MID'), 30, 63, (v) => v + '%');
check('a 90 at 40', odds(90, 40, 'MID'), 30, 60, (v) => v + '%');
check('a keeper lasts longer than an attacker', odds(80, 35, 'ATT') - odds(80, 35, 'GK'), 1, 60, (v) => v + ' points');

console.log('\nDETERMINISM');
const a = career(88, 24, 'MID', 8, 424242).rtg;
const b = career(88, 24, 'MID', 8, 424242).rtg;
console.log(`  ${a === b ? 'pass' : 'FAIL'}  the same seed gives the same career`);
if (a !== b) failures++;

console.log(
  failures ? `\n${failures} Dynasty numbers have moved.` : '\nAll Dynasty numbers hold.\n',
);
process.exit(failures ? 1 : 0);
