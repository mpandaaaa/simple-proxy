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

console.log('\nVALUATION, against Transfermarkt');
/* Every band here is a real player, checked against Transfermarkt in
   September 2026 and converted at 0.85.

   These moved once, deliberately. The old anchor of GBP125m for a 92
   rated 23 year old was carried over from the web build rather than
   taken from the market, and the market says a footballer of that
   description costs more: Bellingham EUR180m, Haaland EUR180m, Yamal
   over EUR200m. The curve was also too flat at both ends, which is what
   made a 92 and an 84 in the same squad nine million apart. */
check('92 attacker at 23', value(92, 23, 'ATT', 4), 135, 180, (v) => 'GBP' + v + 'm');
check('89 defender at 24, Saliba EUR100m', value(89, 24, 'DEF', 4), 72, 100, (v) => 'GBP' + v + 'm');
check('89 defender at 27, Gabriel EUR75m', value(89, 27, 'DEF', 3), 55, 80, (v) => 'GBP' + v + 'm');
check('83 defender at 24, Timber EUR50m', value(83, 24, 'DEF', 4), 34, 55, (v) => 'GBP' + v + 'm');
check('93 attacker at 25, Haaland EUR180m', value(93, 25, 'ATT', 4), 135, 185, (v) => 'GBP' + v + 'm');
check('89 keeper at 29, Raya EUR34m', value(89, 29, 'GK', 3), 24, 45, (v) => 'GBP' + v + 'm');
check('82 defender at 34, Trippier EUR6m', value(82, 34, 'DEF', 1), 2, 9, (v) => 'GBP' + v + 'm');
check('70 midfielder at 23', value(70, 23, 'MID', 4), 3, 9, (v) => 'GBP' + v + 'm');
check('65 midfielder at 23', value(65, 23, 'MID', 4), 1, 3, (v) => 'GBP' + v + 'm');
check('92 midfielder at 33', value(92, 33, 'MID', 4), 22, 40, (v) => 'GBP' + v + 'm');
check('an attacker costs more than a keeper', value(88, 24, 'ATT', 4) - value(88, 24, 'GK', 4), 26, 60, (v) => 'GBP' + v + 'm');
check('a year left knocks the price down', value(88, 24, 'MID', 1), 40, 65, (v) => 'GBP' + v + 'm');
/* The complaint that started this: a 92 and an 84 in the same defence,
   both 31, came out nine million apart. Real football is more than
   double. */
check(
  'a 92 is worth more than twice an 84',
  value(92, 31, 'DEF', 2) / value(84, 31, 'DEF', 3),
  1.9,
  3.2,
  (v) => v.toFixed(2) + ' times',
);

console.log('\nWAGES, weekly and in thousands');
check('65 rated squad player', wage(65, 26), 30, 38, (v) => '£' + v + 'k');
/* Widened once, deliberately, in September 2026, when the wage curve got
   a premium above 88. The old curve topped out near £270k for anybody at
   all, in a league where Haaland is on £525k a week and Salah on £400k.
   Everything at 88 and below is untouched: the two checks either side of
   this one have not moved. */
check('90 rated star', wage(90, 27), 270, 330, (v) => '£' + v + 'k');
check('a genuine superstar', wage(94, 28), 380, 560, (v) => '£' + v + 'k');
check('88 is below the premium', wage(88, 27), 195, 220, (v) => '£' + v + 'k');
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
