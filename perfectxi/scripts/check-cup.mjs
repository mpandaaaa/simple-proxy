/**
 * The knockout, measured.
 *
 * A bracket is easy to get subtly wrong: a side meeting itself, a round
 * with the wrong number of ties, somebody who lost turning up in the next
 * round, a level tie that never went to penalties. So this plays hundreds
 * of them and checks the bracket after every round.
 */
import {
  CUP_ROUNDS,
  cupPlayNext,
  cupReached,
  cupSide,
  cupStart,
  drawSixteen,
  spreadSixteen,
  strongestSixteen,
} from '../.headless/engine/index.js';

let bad = 0;
const seen = new Set();
const fail = (m) => {
  if (seen.has(m)) return;
  seen.add(m);
  console.log('  ' + m);
  bad++;
};

/* ---------- the three ways a bracket gets filled ---------- */

const fields = [
  ['across the eras', spreadSixteen()],
  ['the strongest', strongestSixteen()],
  ['a 1990s draw', drawSixteen(1992, 1999, 7)],
  ['a 2000s draw', drawSixteen(2000, 2009, 8)],
  ['a 2010s draw', drawSixteen(2010, 2019, 9)],
  ['a 2020s draw', drawSixteen(2020, 2026, 10)],
];

for (const [name, field] of fields) {
  if (field.length !== 16) fail(`${name} filled ${field.length} places`);
  if (new Set(field).size !== field.length) fail(`${name} has the same side twice`);
  const clubs = field.map((k) => cupSide(k)?.club);
  if (new Set(clubs).size !== clubs.length) fail(`${name} has the same club twice`);
  for (const k of field) {
    const side = cupSide(k);
    if (!side) fail(`${name} contains ${k}, which is not in the database`);
    else if (side.rating < 60 || side.rating > 99) fail(`${name} has a side rated ${side.rating}`);
  }
}
console.log('');
console.log(`  ${fields.length} ways of filling a bracket, all sixteen, no club twice`);

/* ---------- playing them ---------- */

const field = spreadSixteen();
let runs = 0;
let ties = 0;
let pens = 0;
let et = 0;
const wins = {};

for (let f = 0; f < field.length; f++) {
  for (let s = 0; s < 8; s++) {
    let run = cupStart(field, field[f], 3000 + f * 17 + s);
    if (run.alive.length !== 16) fail(`a cup that started with ${run.alive.length} sides`);

    let guard = 0;
    let expected = 16;
    while (!run.over && guard++ < 6) {
      const before = run.alive.slice();
      const step = cupPlayNext(run);
      if (!step) break;
      run = step.run;
      ties++;

      const m = step.match;
      if (m.a !== before[before.indexOf(m.a)]) fail('a tie against somebody not in the draw');
      if (m.a === m.b) fail('a side drawn against itself');
      if (m.ga === m.gb && !m.pens) fail(`a level tie of ${m.ga}-${m.gb} with no shootout`);
      if (m.pens) pens++;
      if (m.et) et++;

      /* Every tie of the round is settled at once, and the round halves. */
      expected = expected / 2;
      const round = run.results.filter((x) => x.round === m.round);
      if (round.length !== expected) {
        fail(`the ${m.round} produced ${round.length} results, wanted ${expected}`);
      }
      if (!run.over && run.alive.length !== expected) {
        fail(`${run.alive.length} left after a round of ${expected * 2}`);
      }

      /* Nobody who lost may still be in it. */
      for (const r of round) {
        const aWon = r.pens ? r.pens.a > r.pens.b : r.ga > r.gb;
        const loser = aWon ? r.b : r.a;
        if (run.alive.indexOf(loser) >= 0) fail('a beaten side is still in the draw');
      }
      if (new Set(run.alive).size !== run.alive.length) fail('a side is in the draw twice');
    }

    if (!run.over) fail('a cup that never ended');
    runs++;
    if (run.won) {
      const club = cupSide(run.you)?.club ?? run.you;
      wins[club] = (wins[club] ?? 0) + 1;
      if (run.played.length !== 4) fail(`won it in ${run.played.length} ties`);
      if (cupReached(run) !== 4) fail(`won it but reached ${cupReached(run)}`);
    } else {
      if (!run.outAt) fail('a cup that ended nowhere');
      if (run.played.length !== cupReached(run) + 1) {
        fail(`played ${run.played.length} and reached ${cupReached(run)}`);
      }
    }
    if (run.results.length !== 15 && !run.over) fail(`${run.results.length} ties in a bracket of 16`);
  }
}

const top = Object.entries(wins).sort((a, b) => b[1] - a[1]).slice(0, 4);
console.log(`  ${runs} cups, ${ties} ties, ${et} needing extra time, ${pens} going to penalties`);
console.log(`  most wins: ${top.map(([n, c]) => `${n} ${c}`).join(', ')}`);

/* A sixteen side bracket gives everybody one in sixteen on average, and a
   field spread across the eras should not have one side winning half. */
const most = top[0]?.[1] ?? 0;
if (most > runs * 0.25) fail(`one side won ${most} of ${runs}, which is not a competition`);
if (!pens) fail('not one tie in hundreds went to penalties');

console.log('');
if (bad) {
  console.log(`${bad} problems\n`);
  process.exit(1);
}
console.log('Every bracket halves cleanly and nobody beaten is ever still in it.\n');
