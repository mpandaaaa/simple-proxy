/**
 * The Chief Scout has to be worth paying for.
 *
 * He was in the game as a name and a wage bill and did nothing at all:
 * nothing in the engine read d.staff.scout. This measures what he is
 * worth now, so "elite scouting" cannot quietly go back to meaning
 * nothing.
 */
import { startCareer, clubOptions } from '../.headless/engine/career.js';
import { market } from '../.headless/engine/dynastySquad.js';
import { mulberry32 } from '../.headless/engine/rng.js';

const base = startCareer({
  clubKey: clubOptions(2026)[0].key,
  scenario: 'elite',
  mode: 'simple',
  formation: '4-3-3',
  seed: 4242,
});

const RUNS = 400;
const rows = [];
for (let stars = 0; stars <= 5; stars++) {
  const d = { ...base, staff: { ...base.staff, scout: stars } };
  let names = 0;
  let elite = 0;
  let best = 0;
  let frees = 0;
  for (let i = 0; i < RUNS; i++) {
    const list = market(d, mulberry32(1000 + i));
    names += list.length;
    elite += list.filter((p) => p.rtg >= 85).length;
    frees += list.filter((p) => p.free).length;
    best += Math.max(...list.map((p) => p.rtg));
  }
  rows.push({
    stars,
    names: names / RUNS,
    elite: elite / RUNS,
    frees: frees / RUNS,
    best: best / RUNS,
  });
}

console.log('\nWhat the Chief Scout brings back, over ' + RUNS + ' markets');
console.log('  stars   names   85+   free   best');
for (const r of rows) {
  console.log(
    `  ${r.stars}       ${r.names.toFixed(1).padStart(4)}   ${r.elite
      .toFixed(1)
      .padStart(3)}   ${r.frees.toFixed(1).padStart(4)}   ${r.best.toFixed(1)}`,
  );
}

let failures = 0;
const fail = (m) => {
  console.log('  FAIL ' + m);
  failures++;
};

const none = rows[0];
const top = rows[5];
if (top.names <= none.names) fail('elite scouting does not bring back more names');
if (top.elite <= none.elite + 1) fail('elite scouting does not bring back more 85+ players');
if (top.best <= none.best) fail('elite scouting does not raise the best name available');
if (top.frees <= none.frees) fail('elite scouting does not improve the free agents');
for (let i = 1; i < rows.length; i++) {
  if (rows[i].names < rows[i - 1].names) fail(`${rows[i].stars} stars is worse than ${rows[i - 1].stars}`);
}
if (none.names < 9) fail('with no scout at all the market is too thin to play with');

console.log(
  failures
    ? `\n${failures} problems. The Chief Scout is not worth his wage.\n`
    : '\nEvery star is worth paying for, and no scout still fields a market.\n',
);
process.exit(failures ? 1 : 0);
