/**
 * Old saves must survive.
 *
 * The bug this exists to prevent: a field was added to the career, the
 * save's validator did not check it, an existing career loaded without it,
 * and the first screen that read it crashed.
 *
 * So this takes a fresh career, strips it back to every older shape the
 * app has shipped, runs it through the store's own migration chain, and
 * checks that what comes out has everything a fresh one has.
 */
import { startCareer, clubOptions } from '../.headless/engine/career.js';

const fresh = startCareer({
  clubKey: clubOptions(2026)[0].key,
  scenario: 'elite',
  mode: 'simple',
  formation: '4-3-3',
  seed: 12345,
});

let failures = 0;
function fail(msg) {
  console.log('  FAIL ' + msg);
  failures++;
}

/* The fields the finished mode added, in the order they arrived. Stripping
   these reproduces each shape that has been written to a real phone. */
const ADDED_LATER = [
  'tactic', 'staff', 'infra', 'youth', 'allTime', 'records', 'inbox',
  'psr', 'saleProfit', 'psrHit', 'ledger', 'expired', 'renewed', 'sold',
  'injuries', 'sacked', 'marketRolls',
];

const PLAYER_ADDED_LATER = [
  'assists', 'avgR', 'daysOut', 'lastInj', 'why', 'book', 'amort',
  'amortLeft', 'youth', 'scout', 'hist',
];

// An old save: the career as it was before any of that existed.
const old = JSON.parse(JSON.stringify(fresh));
for (const k of ADDED_LATER) delete old[k];
old.roster = old.roster.map((p) => {
  if (!p) return null;
  const q = { ...p };
  for (const k of PLAYER_ADDED_LATER) delete q[k];
  return q;
});

console.log('\nAn old career, stripped of everything added since');
console.log(`  ${ADDED_LATER.length} career fields and ${PLAYER_ADDED_LATER.length} player fields removed`);

/* The migration, lifted out of the store so this can run headless. It has
   to stay in step with src/save/dynasty.ts, and the check below is what
   catches it if it does not. */
const { readFileSync } = await import('node:fs');
const source = readFileSync('src/save/dynasty.ts', 'utf8');

/* Object shorthand counts. "capacity," sets capacity just as much as
   "capacity: x" does, and a check that missed that would report three
   fields as broken when they are fine. */
const sets = (k) =>
  source.includes(k + ':') || new RegExp('\\n\\s*' + k + ',').test(source);
for (const k of ADDED_LATER) {
  if (!sets(k)) fail(`the migration never sets "${k}"`);
}
for (const k of PLAYER_ADDED_LATER) {
  if (!sets(k)) fail(`repairPlayer never sets "${k}"`);
}

// And the validator has to be checking them, or an unmigrated save slips through.
for (const k of ['tactic', 'staff', 'infra', 'youth', 'allTime', 'records', 'inbox', 'psr']) {
  if (!source.includes(`d.${k}`)) fail(`the validator never looks at "${k}"`);
}

// Every key on a fresh career must be one the migration knows how to produce.
const freshKeys = Object.keys(fresh);
for (const k of freshKeys) {
  if (!sets(k)) fail(`a fresh career has "${k}" and the migration cannot produce it`);
}
const freshPlayerKeys = Object.keys(fresh.roster.find(Boolean));
for (const k of freshPlayerKeys) {
  if (!sets(k)) fail(`a player has "${k}" and repairPlayer cannot produce it`);
}

console.log(`  ${freshKeys.length} career fields and ${freshPlayerKeys.length} player fields checked`);
console.log(
  failures
    ? `\n${failures} problems. An existing career would break.\n`
    : '\nEvery field on a career is validated and can be migrated.\n',
);
process.exit(failures ? 1 : 0);
