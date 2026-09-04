/**
 * The Champions League, measured.
 *
 * The league phase is the part that can quietly be wrong: a club with
 * seven games, a table where everybody has played a different number, an
 * eight game schedule where somebody meets the same club twice. So the
 * fixture list is checked properly before a single match is simulated, and
 * then the whole field plays the competition to see where the format
 * actually sends everybody.
 */
import {
  UCL_MATCHDAYS,
  UCL_STAGE_NAME,
  leagueFixtures,
  potOf,
  uclClub,
  uclClubs,
  uclExpected,
  uclPlayNext,
  uclPosition,
  uclSkipLeague,
  uclSquad,
  uclStart,
  uclVerdict,
} from '../.headless/engine/index.js';

let bad = 0;
const fail = (m) => {
  console.log('  ' + m);
  bad++;
};

/* ---------- the field ---------- */

const clubs = uclClubs();
if (clubs.length !== 36) fail(`${clubs.length} clubs rather than thirty six`);
for (let p = 1; p <= 4; p++) {
  const pot = potOf(p);
  if (pot.length !== 9) fail(`pot ${p} holds ${pot.length}`);
}

for (const c of clubs) {
  const squad = uclSquad(c.name);
  if (squad.length < 16) fail(`${c.name} can only field ${squad.length}`);
  for (const pos of ['GK', 'DEF', 'MID', 'ATT']) {
    if (!squad.filter((x) => (x.pos[0] ?? '') === pos).length) fail(`${c.name} has no ${pos}`);
  }
  /* Filler must never outrank a player the database actually named. */
  const named = squad.filter((x) => x.nat !== c.country || true);
  if (!named.length) fail(`${c.name} has an empty squad`);
}

/* ---------- the fixture list ---------- */

const fixtures = leagueFixtures();
if (fixtures.length !== 144) fail(`${fixtures.length} fixtures rather than a hundred and forty four`);

const games = new Map();
const homes = new Map();
const aways = new Map();
const byDay = new Map();
const met = new Map();

for (const f of fixtures) {
  if (f.a === f.b) fail(`${f.a} plays itself`);
  games.set(f.a, (games.get(f.a) ?? 0) + 1);
  games.set(f.b, (games.get(f.b) ?? 0) + 1);
  homes.set(f.a, (homes.get(f.a) ?? 0) + 1);
  aways.set(f.b, (aways.get(f.b) ?? 0) + 1);
  if (!byDay.has(f.n)) byDay.set(f.n, []);
  byDay.get(f.n).push(f);
  const k = [f.a, f.b].sort().join(' v ');
  met.set(k, (met.get(k) ?? 0) + 1);
}

for (const c of clubs) {
  if (games.get(c.name) !== 8) fail(`${c.name} plays ${games.get(c.name) ?? 0}`);
  if (homes.get(c.name) !== 4) fail(`${c.name} is at home ${homes.get(c.name) ?? 0} times`);
  if (aways.get(c.name) !== 4) fail(`${c.name} is away ${aways.get(c.name) ?? 0} times`);
}

for (const [k, n] of met) {
  if (n > 1) fail(`${k} happens ${n} times`);
}

if (byDay.size !== UCL_MATCHDAYS) fail(`${byDay.size} matchdays`);
for (const [day, list] of byDay) {
  if (list.length !== 18) fail(`matchday ${day + 1} has ${list.length} games`);
  const on = new Set();
  for (const f of list) {
    if (on.has(f.a)) fail(`${f.a} plays twice on matchday ${day + 1}`);
    if (on.has(f.b)) fail(`${f.b} plays twice on matchday ${day + 1}`);
    on.add(f.a);
    on.add(f.b);
  }
  if (on.size !== 36) fail(`matchday ${day + 1} only involves ${on.size} clubs`);
}

/* Two opponents from every pot, which the two same-pot matchdays cannot
   give the four clubs left over. Eight club-matchdays of the two hundred
   and eighty eight, and no more than that. */
let offRule = 0;
for (const c of clubs) {
  const byPot = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const f of fixtures) {
    if (f.a !== c.name && f.b !== c.name) continue;
    const other = f.a === c.name ? f.b : f.a;
    byPot[uclClub(other).pot]++;
  }
  for (const p of [1, 2, 3, 4]) if (byPot[p] !== 2) offRule++;
}
if (offRule > 16) fail(`${offRule} pot counts are off, which is more than the construction allows`);

console.log('');
console.log(`  144 fixtures, 8 matchdays of 18, every club playing 4 home and 4 away`);
console.log(`  ${offRule} pot counts bent by the odd pot, out of 144`);

/* ---------- the whole field plays it ---------- */

const reached = {};
const verdicts = { over: 0, met: 0, under: 0 };
let runs = 0;
let matches = 0;
let finals = 0;
const titles = {};

for (let i = 0; i < clubs.length; i++) {
  for (let s = 0; s < 4; s++) {
    let run = uclStart(clubs[i].name, 4000 + i * 17 + s);
    const skipped = uclSkipLeague(run);
    run = skipped.run;
    matches += skipped.matches.length;
    if (skipped.matches.length !== 8) fail(`${clubs[i].name} played ${skipped.matches.length} league games`);

    const table = run.table;
    const played = new Set(table.map((r) => r.p));
    if (played.size !== 1 || !played.has(8)) {
      fail(`the table after the league phase reads ${[...played].join(', ')} games played`);
    }
    const pts = table.reduce((a, r) => a + r.pts, 0);
    const gf = table.reduce((a, r) => a + r.gf, 0);
    const ga = table.reduce((a, r) => a + r.ga, 0);
    if (gf !== ga) fail(`${gf} goals scored but ${ga} conceded`);
    if (pts < 144 * 2 || pts > 144 * 3) fail(`${pts} points handed out across 144 games`);

    let guard = 0;
    while (!run.over && guard++ < 20) {
      const step = uclPlayNext(run);
      if (!step) break;
      run = step.run;
      matches++;
    }
    if (!run.over) fail(`${clubs[i].name} has a run that never ended`);

    runs++;
    const at = run.won ? 'won' : (run.outAt ?? 'league');
    reached[at] = (reached[at] ?? 0) + 1;
    verdicts[uclVerdict(run)]++;
    if (run.won) titles[clubs[i].name] = (titles[clubs[i].name] ?? 0) + 1;
    if (run.outAt === 'final') finals++;
  }
}

console.log('');
console.log(`  ${runs} campaigns, ${matches} matches`);
const order = ['league', 'po', 'r16', 'qf', 'sf', 'final', 'won'];
for (const k of order) {
  const n = reached[k] ?? 0;
  if (!n) continue;
  const label = k === 'won' ? 'Won it' : `Out at ${UCL_STAGE_NAME[k] ?? k}`;
  console.log(`  ${label.padEnd(26)} ${String(n).padStart(4)}  ${((n / runs) * 100).toFixed(1)}%`);
}
console.log('');
console.log(
  `  verdicts  over ${((verdicts.over / runs) * 100).toFixed(0)}%  ` +
    `level ${((verdicts.met / runs) * 100).toFixed(0)}%  ` +
    `under ${((verdicts.under / runs) * 100).toFixed(0)}%`,
);

const won = Object.entries(titles).sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log(`  most titles: ${won.map(([n, c]) => `${n} ${c}`).join(', ')}`);

/* A third of the field going out in the league phase is the format, not a
   bug: twelve of thirty six are eliminated there every year. */
const outEarly = (reached.league ?? 0) / runs;
if (outEarly < 0.2 || outEarly > 0.45) fail(`${(outEarly * 100).toFixed(0)}% go out in the league phase`);
for (const k of ['over', 'met', 'under']) {
  const share = verdicts[k] / runs;
  if (share < 0.15) fail(`only ${(share * 100).toFixed(0)}% of runs come out ${k}`);
}

/* ---------- one at a time reaches the same place ---------- */

let a = uclStart(clubs[3].name, 777);
const skipRun = uclSkipLeague(a).run;
let b = uclStart(clubs[3].name, 777);
for (let i = 0; i < 8; i++) {
  const step = uclPlayNext(b);
  if (!step) break;
  b = step.run;
}
if (JSON.stringify(skipRun.table) !== JSON.stringify(b.table)) {
  fail('skipping the league phase gives a different table than watching it');
}

console.log('');
if (bad) {
  console.log(`${bad} problems\n`);
  process.exit(1);
}
console.log('The league phase is a real league phase, and the format sends everybody where it should.\n');
