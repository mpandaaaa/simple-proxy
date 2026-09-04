/**
 * The two tournaments, mined out of the web build and the UCL file.
 *
 * The World Cup nations only exist inside `vendor/index.html`, the same
 * place the Premier League database came from, as three plain JavaScript
 * literals. They are lifted out by brace matching rather than by a
 * regular expression, because a regular expression that tries to match
 * balanced braces across fifty thousand characters is a bug waiting for
 * a squad with an object in it.
 *
 * The Champions League comes from the file Mo supplied, which is already
 * JSON and needs checking rather than parsing.
 *
 * Output is two files under `data/`, committed, and `import-tournaments`
 * turns those into the modules the app reads. Same shape as the league
 * database and for the same reason: the source of truth is a file a
 * person can open, and the generated code is never hand edited.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const VENDOR = join('vendor', 'index.html');
const UCL_IN = process.argv[2];

if (!existsSync(VENDOR)) {
  console.error('vendor/index.html is not here. It is the only copy of the nations.');
  process.exit(1);
}

const html = readFileSync(VENDOR, 'utf8');

/** The balanced literal that follows `NAME =`, whatever is inside it. */
function literal(name) {
  const at = html.search(new RegExp(name + '\\s*='));
  if (at < 0) throw new Error(name + ' is not in the web build');
  let i = html.indexOf('=', at) + 1;
  while (/\s/.test(html[i])) i++;
  const open = html[i];
  const close = open === '{' ? '}' : ']';
  if (open !== '{' && open !== '[') throw new Error(name + ' does not start with a literal');

  let depth = 0;
  let quote = null;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (quote) {
      if (c === '\\') j++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return html.slice(i, j + 1);
    }
  }
  throw new Error(name + ' never closes');
}

function evaluate(name) {
  // eslint-disable-next-line no-new-func
  return new Function('return ' + literal(name))();
}

/* ---------- the nations ---------- */

const teams = evaluate('WC_TEAMS');
const squads = evaluate('WC_SQUADS');

const codes = Object.keys(teams);
let problems = 0;
const say = (m) => {
  console.log('  ' + m);
  problems++;
};

const groups = {};
for (const code of codes) {
  const t = teams[code];
  if (!t.n || !t.g || typeof t.r !== 'number') say(`${code} is missing a name, a group or a rating`);
  if (t.r < 50 || t.r > 99) say(`${code} is rated ${t.r}`);
  groups[t.g] = (groups[t.g] ?? 0) + 1;
  const squad = squads[code];
  if (!Array.isArray(squad) || squad.length < 11) {
    say(`${code} has ${squad ? squad.length : 0} players and cannot field an XI`);
    continue;
  }
  const keepers = squad.filter((p) => (p.pos ?? []).includes('GK')).length;
  if (!keepers) say(`${code} has no goalkeeper`);
  for (const p of squad) {
    if (!p.n || typeof p.rtg !== 'number' || !Array.isArray(p.pos) || !p.pos.length) {
      say(`${code} has a player with no name, rating or position`);
      break;
    }
  }
}

const groupNames = Object.keys(groups).sort();
for (const g of groupNames) {
  if (groups[g] !== 4) say(`group ${g} has ${groups[g]} nations rather than four`);
}

const wc = {
  _meta: {
    generated: new Date().toISOString().slice(0, 10),
    competition: 'FIFA World Cup 2026',
    format:
      '48 nations, twelve groups of four. The top two of every group and the eight best third places go through, into a round of thirty two.',
    nations: codes.length,
    groups: groupNames.length,
    players: codes.reduce((a, c) => a + (squads[c]?.length ?? 0), 0),
    source: 'vendor/index.html, the web build',
  },
  TEAMS: teams,
  SQUADS: squads,
};

writeFileSync(join('data', 'worldcup-database.json'), JSON.stringify(wc, null, 1));

console.log('\nWorld Cup');
console.log(`  ${codes.length} nations in ${groupNames.length} groups`);
console.log(`  ${wc._meta.players} players`);
console.log(`  groups: ${groupNames.map((g) => g + ' ' + groups[g]).join(', ')}`);

/* ---------- the Champions League ---------- */

if (UCL_IN) {
  if (!existsSync(UCL_IN)) {
    console.error('\n' + UCL_IN + ' is not there.');
    process.exit(1);
  }
  const ucl = JSON.parse(readFileSync(UCL_IN, 'utf8'));
  const clubs = Object.keys(ucl.CLUBS ?? {});
  if (clubs.length !== 36) say(`the Champions League has ${clubs.length} clubs rather than thirty six`);

  let partial = 0;
  for (const name of clubs) {
    const c = ucl.CLUBS[name];
    if (!c.country || !c.pot || typeof c.tier !== 'number') say(`${name} is missing its country, pot or tier`);
    if (c.pot < 1 || c.pot > 4) say(`${name} is in pot ${c.pot}`);
    if (c.tier < 50 || c.tier > 99) say(`${name} is rated ${c.tier}`);
    if (c.partial) partial++;
  }
  const pots = [1, 2, 3, 4].map((p) => clubs.filter((n) => ucl.CLUBS[n].pot === p).length);
  for (let i = 0; i < 4; i++) {
    if (pots[i] !== 9) say(`pot ${i + 1} has ${pots[i]} clubs rather than nine`);
  }

  writeFileSync(join('data', 'ucl-database.json'), JSON.stringify(ucl, null, 1));
  console.log('\nChampions League');
  console.log(`  ${clubs.length} clubs, pots ${pots.join(' / ')}`);
  console.log(`  ${Object.keys(ucl.SQUADS ?? {}).length} squads in the file, ${partial} of the clubs partial`);
}

console.log(
  problems ? `\n${problems} problems with the source data.\n` : '\nBoth sources are sound.\n',
);
process.exit(problems ? 1 : 0);
