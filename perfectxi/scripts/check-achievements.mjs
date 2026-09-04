/**
 * The trophy cabinet, checked.
 *
 * The failure that matters here is silent: an achievement in the
 * catalogue that no code can ever hand out. It looks fine on the shelf,
 * it can never be earned, and nobody finds out until somebody tries for
 * a hundred percent. So every key in the catalogue is matched against
 * every key the award code can actually give, in both directions.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACHIEVEMENTS,
  CATEGORIES,
  CATEGORY_NOTE,
  EMPTY_CAREER,
  earnDynasty,
  earnUcl,
  earnWorldCup,
  foldUcl,
  foldWorldCup,
  nextUp,
  sweep,
} from '../.headless/game/achievements.js';

let bad = 0;
const fail = (m) => {
  console.log('  ' + m);
  bad++;
};

const keys = ACHIEVEMENTS.map((a) => a.key);
console.log('');
console.log(`  ${keys.length} achievements across ${CATEGORIES.length} shelves`);

/* ---------- the catalogue itself ---------- */

const seen = new Set();
for (const a of ACHIEVEMENTS) {
  if (seen.has(a.key)) fail(`${a.key} appears twice`);
  seen.add(a.key);
  if (!a.name || !a.desc || !a.hint) fail(`${a.key} is missing text`);
  if (!a.mark) fail(`${a.key} has no mark`);
  if (CATEGORIES.indexOf(a.cat) < 0) fail(`${a.key} is in an unknown category: ${a.cat}`);
  for (const field of ['name', 'desc', 'hint']) {
    if (a[field].includes('—')) fail(`${a.key} has an em-dash in its ${field}`);
  }
  if (a.name.length > 30) fail(`${a.key} has a name of ${a.name.length} characters`);
}

for (const cat of CATEGORIES) {
  const n = ACHIEVEMENTS.filter((a) => a.cat === cat).length;
  if (!n) fail(`the ${cat} shelf is empty`);
  if (!CATEGORY_NOTE[cat]) fail(`the ${cat} shelf has no note`);
}

/* ---------- every one of them can be given ---------- */

const src = readFileSync(join('src', 'game', 'achievements.ts'), 'utf8');
const given = new Set();
for (const m of src.matchAll(/give\(\s*'([A-Za-z0-9]+)'/g)) given.add(m[1]);

for (const k of keys) {
  if (!given.has(k)) fail(`${k} is in the catalogue but nothing can ever give it`);
}
for (const k of given) {
  if (!seen.has(k)) fail(`${k} is given but is not in the catalogue`);
}
console.log(`  ${given.size} of them are handed out by name, and every one exists`);

/* ---------- and the award functions actually return them ---------- */

/* A World Cup won without losing, by a drafted XI, with a six goal
   forward and five clean sheets. Everything the World Cup shelf has. */
const wcRun = {
  seed: 1,
  you: 'BRA',
  stage: 'done',
  played: [
    { stage: 'group', n: 0, a: 'BRA', b: 'X', ga: 2, gb: 0, pens: null, played: true },
    { stage: 'final', n: 0, a: 'BRA', b: 'Y', ga: 1, gb: 0, pens: null, played: true },
  ],
  ahead: [],
  table: [],
  bracket: [],
  squad: { 'A Forward': { g: 7, a: 2 } },
  cleanSheets: 5,
  over: true,
  outAt: 'final',
  won: true,
  world: [],
  custom: { name: 'Your World XI', flag: '', rating: 88, squad: [] },
};

let career = { ...EMPTY_CAREER };
career = foldWorldCup(career, wcRun);
career = foldWorldCup(career, wcRun);
career = foldWorldCup(career, wcRun);
const wcKeys = earnWorldCup(career, wcRun);
const wcWant = ACHIEVEMENTS.filter((a) => a.cat === 'World Cup').map((a) => a.key);
for (const k of wcWant) {
  if (wcKeys.indexOf(k) < 0) fail(`a perfect World Cup did not earn ${k}`);
}
console.log(`  a perfect World Cup earns all ${wcKeys.length} of its shelf`);

/* The same for Europe: won unbeaten, from pot four, with a drafted XI, a
   shootout, a comeback and eight from eight in the league phase. */
const legs = [];
for (let i = 0; i < 8; i++) {
  legs.push({ stage: 'league', n: i, a: 'You', b: 'X', ga: 2, gb: 0, pens: null, played: true });
}
legs.push({ stage: 'r16', n: 1, a: 'You', b: 'X', ga: 0, gb: 1, pens: null, played: true });
legs.push({
  stage: 'r16',
  n: 2,
  a: 'You',
  b: 'X',
  ga: 3,
  gb: 0,
  pens: { a: 5, b: 4 },
  played: true,
  agg: { a: 3, b: 1 },
});
const uclRun = {
  seed: 1,
  you: 'You',
  stage: 'done',
  played: legs,
  ahead: [],
  table: [],
  order: ['You'],
  rank: { You: 1 },
  alive: [],
  agg: null,
  squad: {},
  cleanSheets: 4,
  over: true,
  outAt: 'final',
  won: true,
  world: [],
  custom: { name: 'Your Champions XI', rating: 88, squad: [] },
};
let c2 = { ...EMPTY_CAREER };
c2 = foldUcl(c2, uclRun);
c2 = foldUcl(c2, uclRun);
c2 = foldUcl(c2, uclRun);
const uclKeys = earnUcl(c2, uclRun, 4);

/* Unbeaten is the one thing the run above cannot have, because winning a
   tie after losing the first leg means a leg was lost. So it gets its own
   campaign: eight from eight, and every knockout won outright. */
const cleanRun = {
  ...uclRun,
  played: legs.slice(0, 8).concat([
    { stage: 'final', n: 1, a: 'You', b: 'X', ga: 2, gb: 0, pens: null, played: true },
  ]),
};
const cleanKeys = earnUcl(c2, cleanRun, 4);
const together = new Set([...uclKeys, ...cleanKeys]);

const uclWant = ACHIEVEMENTS.filter((a) => a.cat === 'Champions League').map((a) => a.key);
for (const k of uclWant) {
  if (!together.has(k)) fail(`a perfect European campaign did not earn ${k}`);
}
console.log(`  two perfect European campaigns earn all ${together.size} of its shelf`);

/* Dynasty: twenty five seasons, five titles, promoted, a hundred points,
   an academy player and, in the end, the sack. */
const rows = [];
for (let i = 0; i < 25; i++) {
  rows.push({ s: i + 1, fin: i === 2 ? 1 : 4, pts: 90, w: 25, d: 5, l: 8, gf: 80, ga: 30, met: true, rev: 0, profit: 0, ded: 0, div: i === 0 ? 2 : 1 });
}
const dyn = {
  year: 25,
  titles: 5,
  seasons: rows,
  records: { bestPts: 101, bestFin: 1, unbeaten: 0 },
  roster: [{ n: 'A Kid', season: 'Academy' }],
  sacked: true,
};
const dynKeys = earnDynasty({ ...EMPTY_CAREER }, dyn);
const dynWant = ACHIEVEMENTS.filter((a) => a.cat === 'Dynasty').map((a) => a.key);
for (const k of dynWant) {
  if (dynKeys.indexOf(k) < 0) fail(`a full Dynasty career did not earn ${k}`);
}
console.log(`  a full Dynasty career earns all ${dynKeys.length} of its shelf`);

/* And everything that is simply read back. */
const swept = sweep(
  { ...EMPTY_CAREER },
  {
    cards: { all: 1200, icon: 12 },
    bestCard: 97,
    sets: 24,
    setsTotal: 24,
    level: 50,
    daily: { played: 60, won: 12, streak: 40 },
    weekly: { played: 9, streak: 6 },
    duels: { played: 40, won: 30 },
  },
);
const sweptWant = ACHIEVEMENTS.filter(
  (a) => a.cat === 'Collection' || a.cat === 'Play Today',
).map((a) => a.key);
for (const k of sweptWant) {
  if (swept.indexOf(k) < 0) fail(`a full collection and a full week did not earn ${k}`);
}
console.log(`  a full album and a full week earn all ${swept.length} of theirs`);

/* Nothing is ever handed out twice. */
const twice = earnWorldCup({ ...career, earned: wcKeys }, wcRun);
if (twice.length) fail(`${twice.length} World Cup achievements were given a second time`);

/* ---------- what to go after next ---------- */

const fresh = nextUp({ ...EMPTY_CAREER }, 3);
if (fresh.length !== 3) fail(`a new player is shown ${fresh.length} things to go after`);
for (const t of fresh) {
  if (t.need <= 0) fail(`${t.achievement.key} needs ${t.need}`);
  if (t.have > t.need) fail(`${t.achievement.key} shows ${t.have} of ${t.need}`);
}
console.log(`  a new player is shown ${fresh.length} things to go after`);

console.log('');
if (bad) {
  console.log(`${bad} problems\n`);
  process.exit(1);
}
console.log('Every achievement in the cabinet can be earned, and none of them twice.\n');
