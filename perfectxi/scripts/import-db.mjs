/**
 * Build the app's data modules from the shipped database.
 *
 * This replaces mining vendor/index.html. That script had to run the web
 * build's three data layers and its correction pass inside a sandbox to
 * arrive at the finished squads, and it only worked while an uncommitted
 * 1.7MB HTML file happened to be sitting in vendor/. The database is now a
 * single committed JSON file that is already the finished article, so the
 * data can be rebuilt on any machine with a checkout and nothing else.
 *
 * Two modules come out of it:
 *
 *   src/data/squads.ts    712 club-seasons, the draft's whole world
 *   src/data/dynasty.ts   birth years, ageing curves, capacities, derbies
 *
 * Both are emitted as one JSON string parsed at load rather than as object
 * literals. A megabyte of literal would make tsc infer a type for every
 * one of eleven thousand rows and the typecheck would take minutes.
 *
 * The formations in the database are checked against the engine's own
 * rather than written over them. Those multipliers are balanced against
 * the match engine and are not something a data import gets to change
 * quietly: if they ever differ, this stops and says so.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(root, 'data', 'perfectxi-database.json');

const POSITIONS = new Set(['GK', 'DEF', 'MID', 'ATT']);

function die(message) {
  console.error('IMPORT FAILED: ' + message);
  process.exit(1);
}

const db = JSON.parse(readFileSync(SOURCE, 'utf8'));
for (const key of ['SQUADS', 'PXDOB', 'FM', 'DY_POS', 'DY_CAP', 'DY_RIVALS']) {
  if (!db[key]) die(`the database has no ${key} section`);
}

/* ---------- check every row before anything is written ---------- */

const clubs = new Set();
const seasons = new Set();
const names = new Set();
let rows = 0;

for (const [key, squad] of Object.entries(db.SQUADS)) {
  const [club, year] = key.split('|');
  if (!club || !/^\d{4}$/.test(year ?? '')) die(`"${key}" is not a Club|Year key`);
  if (!Array.isArray(squad) || squad.length < 11) {
    die(`${key} has ${Array.isArray(squad) ? squad.length : 'no'} players, and a squad cannot field an XI under eleven`);
  }
  clubs.add(club);
  seasons.add(year);
  for (const p of squad) {
    rows++;
    names.add(p.n);
    if (typeof p.n !== 'string' || !p.n) die(`${key} has a player with no name`);
    if (!Array.isArray(p.pos) || !p.pos.length || p.pos.some((x) => !POSITIONS.has(x))) {
      die(`${key}: ${p.n} has positions ${JSON.stringify(p.pos)}`);
    }
    for (const r of [p.rtg, p.prime]) {
      if (typeof r !== 'number' || r < 1 || r > 99) die(`${key}: ${p.n} is rated ${r}`);
    }
  }
}

/* ---------- the formations must still agree with the engine ---------- */

const engine = readFileSync(join(root, 'src', 'engine', 'formations.ts'), 'utf8');
for (const [name, fm] of Object.entries(db.FM)) {
  const line = engine.split('\n').find((l) => l.includes(`'${name}': {`));
  if (!line) die(`the engine has no formation ${name}`);
  const att = Number(/att:\s*([\d.]+)/.exec(line)?.[1]);
  const def = Number(/def:\s*([\d.]+)/.exec(line)?.[1]);
  if (att !== fm.att || def !== fm.def) {
    die(
      `${name} is ${fm.att}/${fm.def} in the database and ${att}/${def} in the engine. ` +
        'These multipliers are balanced against the match engine, so decide which is right ' +
        'and change it deliberately rather than letting an import do it.',
    );
  }
}

/* ---------- write the modules ---------- */

/**
 * Sorted by club, then by season, always.
 *
 * The draft walks this world to pick a club and a season, so the order of
 * these keys is part of what a seed means. Taking whatever order the JSON
 * happened to be written in would silently change where every existing
 * seed lands. Sorting makes the order a property of the data rather than
 * of the file.
 */
const SQUADS = {};
for (const key of Object.keys(db.SQUADS).sort((x, y) => {
  const [cx, yx] = x.split("|");
  const [cy, yy] = y.split("|");
  return cx.localeCompare(cy, "en") || Number(yx) - Number(yy);
})) {
  SQUADS[key] = db.SQUADS[key];
}

function moduleFor(header, body) {
  return `${header}\n\nconst RAW =\n  ${JSON.stringify(JSON.stringify(body))};\n\n`;
}

const squadsHeader = `/**
 * GENERATED FILE. Do not edit by hand.
 *
 * Written by scripts/import-db.mjs from data/perfectxi-database.json,
 * which is the finished database: the corrections are already applied and
 * this is exactly what the game should see.
 *
 * ${db.SQUADS && Object.keys(db.SQUADS).length} club-seasons, ${clubs.size} clubs, ${seasons.size} seasons, ${rows} player rows, ${names.size} distinct players.
 */
import type { DbPlayer } from '../engine/types';`;

writeFileSync(
  join(root, 'src', 'data', 'squads.ts'),
  moduleFor(squadsHeader, SQUADS) +
    'export const SQUADS: Record<string, DbPlayer[]> = JSON.parse(RAW);\n',
);

const dynastyHeader = `/**
 * GENERATED FILE. Do not edit by hand.
 *
 * Written by scripts/import-db.mjs from data/perfectxi-database.json.
 * Everything Dynasty needs that the draft does not: how old a player is,
 * how his position ages, how many seats his club has, and who he hates.
 *
 * ${Object.keys(db.PXDOB).length} dated players, ${Object.keys(db.DY_CAP).length} stadium capacities, ${Object.keys(db.DY_RIVALS).length} derby pairings.
 */

/**
 * name to [birth year, born after 1 August, peak season, date disputed].
 *
 * Age in a season is seasonYear - birthYear - bornAfterAug1, which is the
 * 1 August convention FBref uses and the one the ratings were built on.
 */
export type Dob = [number, number, number, number];

/**
 * How a position ages. phys, tech and ment are the peak ages of the three
 * attribute tracks, w weights them, dec scales the physical decline and
 * ret shifts the retirement curve.
 *
 * These are the tuned Dynasty curves. Do not adjust them here.
 */
export type AgeCurve = {
  phys: number;
  tech: number;
  ment: number;
  w: [number, number, number];
  dec: number;
  ret: number;
};`;

const dynasty = {
  PXDOB: db.PXDOB,
  DY_POS: db.DY_POS,
  DY_CAP: db.DY_CAP,
  DY_RIVALS: db.DY_RIVALS,
};

writeFileSync(
  join(root, 'src', 'data', 'dynasty.ts'),
  moduleFor(dynastyHeader, dynasty) +
    `const DATA = JSON.parse(RAW) as {
  PXDOB: Record<string, Dob>;
  DY_POS: Record<string, AgeCurve>;
  DY_CAP: Record<string, number>;
  DY_RIVALS: Record<string, string>;
};

export const DOB = DATA.PXDOB;
export const AGE_CURVES = DATA.DY_POS;
export const CAPACITY = DATA.DY_CAP;
export const RIVALS = DATA.DY_RIVALS;
`,
);

const years = [...seasons].map(Number).sort((a, b) => a - b);
console.log(`Imported ${db._meta?.generated ?? 'the database'}`);
console.log(`  ${Object.keys(db.SQUADS).length} club-seasons, ${clubs.size} clubs, ${seasons.size} seasons (${years[0]} to ${years[years.length - 1]})`);
console.log(`  ${rows} player rows, ${names.size} distinct players`);
console.log(`  ${Object.keys(db.PXDOB).length} dated players, ${Object.keys(db.DY_CAP).length} capacities, ${Object.keys(db.DY_RIVALS).length} derbies`);
console.log('  formations agree with the engine');
