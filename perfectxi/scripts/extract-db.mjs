/**
 * Builds src/data/*.json from the web game snapshot in source/web/.
 *
 * Run:  node scripts/extract-db.mjs
 *
 * The web game assembles its database at startup in three layers: the base
 * SQUADS line, the hand written 2025/26 and 2026/27 blocks, then a
 * correction pass. Rather than re-implement any of that, this runs the
 * original script in a sandbox and reads the finished tables back out, so
 * the app ships exactly what the web game ends up with, already corrected.
 *
 * Output is deterministic: key order is preserved, because the draft picks
 * club-seasons by index and a reorder would change every seeded run.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadWebGame, WEB_DIR } from './lib/web-sandbox.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../src/data');

const silent = console.log;
console.log = () => {}; // the web script logs a build banner on load
const g = loadWebGame();
console.log = silent;

/** JSON clone that refuses to silently drop a function. */
function plain(name) {
  const v = g[name];
  if (v === undefined) throw new Error(`web game has no global ${name}`);
  let fns = 0;
  (function walk(o) {
    if (typeof o === 'function') { fns++; return; }
    if (o && typeof o === 'object') for (const k in o) walk(o[k]);
  })(v);
  if (fns) throw new Error(`${name} contains ${fns} function(s); it is code, not data`);
  return JSON.parse(JSON.stringify(v));
}

function pick(names) {
  const o = {};
  for (const n of names) o[n] = plain(n);
  return o;
}

const files = {
  'squads.json': plain('SQUADS'),
  'dob.json': plain('PXDOB'),
  'league.json': pick(['FM', 'PLBL', 'PL_SEASONS', 'SIM_LEAGUE', 'AT20_CLUBS', 'CLUB_COLOURS', 'DC']),
  'progression.json': pick(['PX_EVENTS', 'ACHIEVEMENTS', 'PXP_MILES', 'PXP_DAILY', 'PXP_WEEKLY', 'PXP_ASC', 'PXP_SHOP']),
  'dynasty.json': pick([
    'DY_POS', 'DY_INJ', 'DY_FIRST', 'DY_LAST', 'DYR', 'DY_POSVAL', 'DY_STAFF', 'DY_STAR',
    'DY_INFRA', 'DY_STYLE', 'DY_MENT', 'DY_FIT', 'DY_SCEN', 'DY_CAP', 'DY_RIVALS',
  ]),
  'cups.json': pick(['CONTINENTAL_CLUBS', 'NATIONAL_CLUBS']),
  'worldcup.json': pick(['WC_SQUADS', 'WC_TEAMS', 'WC_KO']),
};

const sq = files['squads.json'];
const keys = Object.keys(sq);
const names = new Set();
const clubs = new Set();
const seasons = new Set();
let rows = 0;
for (const k of keys) {
  const [club, yr] = k.split('|');
  clubs.add(club);
  seasons.add(+yr);
  for (const p of sq[k]) { names.add(p.n); rows++; }
}

const html = fs.readFileSync(path.join(WEB_DIR, 'index.html'));
const meta = {
  sourceBuild: g.PX_BUILD,
  sourceSha256: crypto.createHash('sha256').update(html).digest('hex'),
  counts: {
    clubSeasons: keys.length,
    players: names.size,
    playerRows: rows,
    clubs: clubs.size,
    seasons: seasons.size,
    firstSeason: Math.min(...seasons),
    lastSeason: Math.max(...seasons),
    datesOfBirth: Object.keys(files['dob.json']).length,
  },
  correctionPass: g._pxdbFix,
};

fs.mkdirSync(OUT, { recursive: true });
for (const [f, data] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, f), JSON.stringify(data));
}
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

console.log(`Extracted from web build ${meta.sourceBuild}`);
console.log(JSON.stringify(meta.counts, null, 2));
for (const f of [...Object.keys(files), 'meta.json']) {
  const kb = (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1);
  console.log(`  src/data/${f}  ${kb}KB`);
}
