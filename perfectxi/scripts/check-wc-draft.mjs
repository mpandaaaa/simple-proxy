/**
 * The World XI draft, measured.
 *
 * A draft is only a decision if drafting well beats drafting carelessly.
 * So this drafts four hundred XIs taking the best available every round,
 * four hundred taking whatever comes, and reports what each is worth on
 * the same scale as a nation. It also plays the drafted sides through real
 * tournaments, because an XI that cannot enter the World Cup is a toy.
 */
import {
  wcBoard,
  wcCustomSquad,
  wcDraftDone,
  wcDraftStart,
  wcExpected,
  wcNations,
  wcPlace,
  wcPlayNext,
  wcPool,
  wcSlotsFor,
  wcSpread,
  wcStart,
  wcWeakest,
  wcXi,
  wcXiRating,
  WC_ROUNDS,
} from '../.headless/engine/index.js';

let bad = 0;
const fail = (m) => {
  console.log('  ' + m);
  bad++;
};

const pool = wcPool();
console.log('');
console.log(`  ${pool.length} players in the pool, from every squad at the tournament`);

/* Nobody may appear twice, or the pool would deal the same man to two shirts. */
const seen = new Set();
for (const p of pool) {
  const k = `${p.code}|${p.n}`;
  if (seen.has(k)) fail(`${k} is in the pool twice`);
  seen.add(k);
}

/* ---------- drafting ---------- */

function draft(seed, mode) {
  let st = wcDraftStart('4-3-3', seed);
  let guard = 0;
  while (!wcDraftDone(st) && guard++ < 40) {
    const board = wcBoard(st);
    if (!board.length) return null;
    if (board.length > 5) fail(`a board of ${board.length}`);
    const playable = board.map((p) => ({ p, sl: wcSlotsFor(st, p) })).filter((x) => x.sl.length);
    if (!playable.length) return null;
    const take = mode === 'best' ? playable[0] : playable[(seed + guard) % playable.length];
    const before = st;
    st = wcPlace(st, take.p, take.sl[0]);
    if (st === before) fail('a legal pick was refused');
  }
  return wcDraftDone(st) ? st : null;
}

for (const mode of ['best', 'rand']) {
  const rows = [];
  const spreads = [];
  for (let s = 0; s < 400; s++) {
    const st = draft(6000 + s, mode);
    if (!st) {
      fail(`draft ${s} never filled eleven shirts`);
      continue;
    }
    const xi = wcXi(st);
    if (xi.length !== WC_ROUNDS) fail(`an XI of ${xi.length}`);
    if (new Set(xi.map((p) => `${p.code}|${p.n}`)).size !== xi.length) {
      fail('the same player twice in one XI');
    }
    if (xi.filter((p) => (p.pos[0] ?? '') === 'GK').length > 1) fail('two goalkeepers');
    rows.push(wcXiRating(st));
    spreads.push(wcSpread(st));
  }
  rows.sort((a, b) => a - b);
  const q = (p) => rows[Math.floor(rows.length * p)];
  const nations = (spreads.reduce((a, b) => a + b, 0) / spreads.length).toFixed(1);
  console.log(
    `  ${mode === 'best' ? 'drafting well ' : 'drafting badly'}  ` +
      `min ${rows[0]}  median ${q(0.5)}  max ${rows[rows.length - 1]}  ` +
      `from ${nations} nations, expected ${wcExpected(q(0.5))}`,
  );
  if (mode === 'best' && q(0.5) < 84) fail(`drafting well only reaches ${q(0.5)}`);
  if (mode === 'rand' && q(0.5) > 83) fail(`drafting badly still reaches ${q(0.5)}`);
}

/* The gap between the two is what makes it a game. */
const good = [];
const poorly = [];
for (let s = 0; s < 200; s++) {
  const a = draft(3000 + s, 'best');
  const b = draft(3000 + s, 'rand');
  if (a) good.push(wcXiRating(a));
  if (b) poorly.push(wcXiRating(b));
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const gap = mean(good) - mean(poorly);
console.log(`  ${gap.toFixed(1)} points between drafting well and not bothering`);
if (gap < 3) fail('drafting well is barely worth anything');

/* ---------- the same board every time ---------- */

const one = wcDraftStart('4-3-3', 4242);
if (JSON.stringify(wcBoard(one)) !== JSON.stringify(wcBoard(one))) {
  fail('the same round deals two different boards');
}

/* ---------- and it can play the tournament ---------- */

const nations = wcNations();
let played = 0;
let titles = 0;
for (let s = 0; s < 60; s++) {
  const st = draft(1500 + s, 'best');
  if (!st) continue;
  /* The same seat the game gives it: the weakest nation in the draw. */
  let run = wcStart(wcWeakest(), 500 + s, {
    name: 'Your World XI',
    flag: '\u{1F30D}',
    rating: wcXiRating(st),
    squad: wcCustomSquad(st),
  });
  let guard = 0;
  while (!run.over && guard++ < 12) {
    const step = wcPlayNext(run);
    if (!step) break;
    run = step.run;
    played++;
  }
  if (!run.over) fail('a drafted run that never ended');
  if (run.won) titles++;
}
console.log(`  ${played} matches played by drafted XIs, ${titles} of 60 won it`);
if (!played) fail('a drafted XI could not play a single match');

console.log('');
if (bad) {
  console.log(`${bad} problems\n`);
  process.exit(1);
}
console.log('A drafted XI is a real entrant, and drafting well is worth doing.\n');
