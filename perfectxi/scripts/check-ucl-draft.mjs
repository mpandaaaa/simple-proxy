/**
 * The Champions XI draft, measured.
 *
 * The same three questions the World XI draft has to answer. Does drafting
 * well beat drafting carelessly, by enough to be worth doing. Does the XI
 * come out somewhere the competition can use it. And can it actually enter
 * and finish a campaign.
 */
import {
  UCL_DRAFT_ROUNDS,
  uclAutoPick,
  uclBoard,
  uclClubs,
  uclDraftDone,
  uclDraftSpread,
  uclDraftSquad,
  uclDraftStart,
  uclDraftPlace,
  uclDraftXi,
  uclExpected,
  uclPlayNext,
  uclPool,
  uclSkipLeague,
  uclSlotsFor,
  uclStart,
  uclXiRating,
} from '../.headless/engine/index.js';

let bad = 0;
const fail = (m) => {
  console.log('  ' + m);
  bad++;
};

const pool = uclPool();
console.log('');
console.log(`  ${pool.length} players in the pool, from all thirty six squads`);

const seen = new Set();
for (const p of pool) {
  const k = `${p.club}|${p.n}`;
  if (seen.has(k)) fail(`${k} is in the pool twice`);
  seen.add(k);
}

function draft(seed, mode) {
  let st = uclDraftStart('4-3-3', seed);
  let guard = 0;
  while (!uclDraftDone(st) && guard++ < 40) {
    const board = uclBoard(st);
    if (!board.length) return null;
    if (board.length > 5) fail(`a board of ${board.length}`);
    const playable = board.map((p) => ({ p, sl: uclSlotsFor(st, p) })).filter((x) => x.sl.length);
    if (!playable.length) return null;
    const take = mode === 'best' ? playable[0] : playable[(seed + guard) % playable.length];
    const before = st;
    st = uclDraftPlace(st, take.p, take.sl[0]);
    if (st === before) fail('a legal pick was refused');
  }
  return uclDraftDone(st) ? st : null;
}

const medians = {};
for (const mode of ['best', 'rand']) {
  const rows = [];
  const spreads = [];
  for (let s = 0; s < 400; s++) {
    const st = draft(8000 + s, mode);
    if (!st) {
      fail(`draft ${s} never filled eleven shirts`);
      continue;
    }
    const xi = uclDraftXi(st);
    if (xi.length !== UCL_DRAFT_ROUNDS) fail(`an XI of ${xi.length}`);
    if (new Set(xi.map((p) => `${p.club}|${p.n}`)).size !== xi.length) {
      fail('the same player twice in one XI');
    }
    if (xi.filter((p) => (p.pos[0] ?? '') === 'GK').length > 1) fail('two goalkeepers');
    rows.push(uclXiRating(st));
    spreads.push(uclDraftSpread(st));
  }
  rows.sort((a, b) => a - b);
  const q = (p) => rows[Math.floor(rows.length * p)];
  medians[mode] = q(0.5);
  const clubs = (spreads.reduce((a, b) => a + b, 0) / spreads.length).toFixed(1);
  console.log(
    `  ${mode === 'best' ? 'drafting well ' : 'drafting badly'}  ` +
      `min ${rows[0]}  median ${q(0.5)}  max ${rows[rows.length - 1]}  ` +
      `from ${clubs} clubs, expected ${uclExpected(q(0.5))}`,
  );
}
const gap = medians.best - medians.rand;
console.log(`  ${gap} points between drafting well and not bothering`);
if (gap < 3) fail('drafting well is barely worth anything');
if (medians.best < 82) fail(`drafting well only reaches ${medians.best}`);

/* The same round deals the same five. */
const one = uclDraftStart('4-3-3', 909);
if (JSON.stringify(uclBoard(one)) !== JSON.stringify(uclBoard(one))) {
  fail('the same round deals two different boards');
}
if (!uclAutoPick(one)) fail('the first board has nobody who can play');

/* ---------- and it can play the competition ---------- */

const clubs = uclClubs();
let played = 0;
let titles = 0;
for (let s = 0; s < 40; s++) {
  const st = draft(2500 + s, 'best');
  if (!st) continue;
  const seat = clubs[s % clubs.length];
  let run = uclStart(seat.name, 900 + s, {
    name: 'Your Champions XI',
    rating: uclXiRating(st),
    squad: uclDraftSquad(st),
  });
  const skipped = uclSkipLeague(run);
  run = skipped.run;
  played += skipped.matches.length;

  let guard = 0;
  while (!run.over && guard++ < 20) {
    const step = uclPlayNext(run);
    if (!step) break;
    run = step.run;
    played++;
  }
  if (!run.over) fail('a drafted campaign that never ended');
  if (run.won) titles++;
}
console.log(`  ${played} matches played by drafted XIs, ${titles} of 40 won it`);
if (!played) fail('a drafted XI could not play a single match');

console.log('');
if (bad) {
  console.log(`${bad} problems\n`);
  process.exit(1);
}
console.log('A drafted XI is a real entrant, and drafting well is worth doing.\n');
