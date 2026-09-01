/**
 * Build the shipped player database from the web build.
 *
 * The browser game holds its data in three layers that only make sense in
 * order: a base SQUADS object, then the 2025/26 and 2026/27 squads written
 * on top of it, then a correction pass that removes players who were at the
 * wrong club and re-rates a list of names. The phone must never run that
 * pass, so it is run once here and the finished result is shipped.
 *
 * The layers are executed rather than parsed. Re-implementing the
 * correction arithmetic in a second language is how the two copies drift
 * apart; running the original is how they cannot.
 *
 *   node scripts/extract-db.mjs [path-to-index.html]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const source = process.argv[2] ?? resolve(root, 'vendor/index.html');
const outFile = resolve(root, 'src/data/squads.ts');

const html = readFileSync(source, 'utf8');
const lines = html.split(/\r?\n/);

const startsWith = (needle) => {
  const i = lines.findIndex((l) => l.startsWith(needle));
  if (i < 0) throw new Error(`could not find a line starting "${needle}"`);
  return i;
};

// The data block runs from the base object to the last statement that
// touches it. Anchoring on statements rather than line numbers means a
// re-download of the site does not silently shift the slice.
const from = startsWith('var SQUADS=');
const to = startsWith("delete SQUADS['Southampton|2025']");
const block = lines.slice(from, to + 1).join('\n');

const sandbox = { window: {}, console };
createContext(sandbox);
runInContext(block + '\n;globalThis.__out = SQUADS;', sandbox, {
  filename: 'perfectxi-data-block.js',
});

const squads = sandbox.__out;
const keys = Object.keys(squads).sort();

// Anything that fails here would ship as a silent hole in the game, so it
// is checked now rather than discovered on a phone.
const names = new Set();
const clubs = new Set();
const seasons = new Set();
let rows = 0;
for (const k of keys) {
  const [club, year] = k.split('|');
  if (!club || !/^\d{4}$/.test(year)) throw new Error(`bad key: ${k}`);
  clubs.add(club);
  seasons.add(Number(year));
  const squad = squads[k];
  if (!Array.isArray(squad) || squad.length === 0) {
    throw new Error(`empty squad: ${k}`);
  }
  for (const p of squad) {
    if (typeof p.n !== 'string' || !p.n) throw new Error(`bad name in ${k}`);
    if (!Array.isArray(p.pos) || p.pos.length === 0) {
      throw new Error(`${p.n} in ${k} has no position`);
    }
    if (typeof p.rtg !== 'number' || p.rtg < 40 || p.rtg > 99) {
      throw new Error(`${p.n} in ${k} has rating ${p.rtg}`);
    }
    if (typeof p.prime !== 'number') p.prime = p.rtg;
    names.add(p.n);
    rows++;
  }
}

const ordered = {};
for (const k of keys) ordered[k] = squads[k];

// Emitted as a TypeScript module holding one JSON string rather than as a
// .json file. Importing a megabyte of JSON makes the compiler infer a type
// with a member for every club-season and every player in it, which costs
// far more than the data is worth; a string literal costs nothing to type
// and JSON.parse is the fast path at runtime anyway.
const banner = `/**
 * GENERATED FILE. Do not edit by hand.
 *
 * Written by scripts/extract-db.mjs from the web build in vendor/. The
 * three data layers and the correction pass have already been applied, so
 * this is the finished database exactly as the game should see it.
 *
 * ${keys.length} club-seasons, ${clubs.size} clubs, ${seasons.size} seasons, ${rows} player rows, ${names.size} distinct players.
 */
import type { DbPlayer } from '../engine/types';

const RAW =
  ${JSON.stringify(JSON.stringify(ordered))};

export const SQUADS: Record<string, DbPlayer[]> = JSON.parse(RAW);
`;
writeFileSync(outFile, banner);

const years = [...seasons].sort((a, b) => a - b);
console.log(`source        ${source}`);
console.log(`club-seasons  ${keys.length}`);
console.log(`clubs         ${clubs.size}`);
console.log(`seasons       ${seasons.size}  (${years[0]} to ${years[years.length - 1]})`);
console.log(`player rows   ${rows}`);
console.log(`distinct      ${names.size}`);
console.log(`written       ${outFile}`);
