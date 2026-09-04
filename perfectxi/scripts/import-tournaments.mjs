/**
 * The two tournament databases, turned into modules.
 *
 * Same rule as the league: `data/` holds files a person can open and
 * `src/data/` holds generated code nobody hand edits. This refuses to
 * write if anything is wrong, so a broken database cannot reach the app
 * by way of a half written module.
 *
 * The five English clubs in the Champions League are deliberately not in
 * the file Mo supplied, because their full squads already exist in the
 * league database under the same key. They are merged at runtime rather
 * than copied, so there is one copy of Arsenal and it cannot drift.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HEAD = `/**
 * GENERATED. Do not hand edit.
 *
 * Written by scripts/import-tournaments.mjs from the files in data/.
 * Change those and run \`npm run import-tournaments\`.
 */
`;

let problems = 0;
const bad = (m) => {
  console.log('  ' + m);
  problems++;
};

/* ================= the World Cup ================= */

const wc = JSON.parse(readFileSync(join('data', 'worldcup-database.json'), 'utf8'));

const codes = Object.keys(wc.TEAMS).sort();
if (codes.length !== 48) bad(`${codes.length} nations rather than forty eight`);

const groups = {};
for (const c of codes) groups[wc.TEAMS[c].g] = (groups[wc.TEAMS[c].g] ?? 0) + 1;
for (const g of Object.keys(groups)) {
  if (groups[g] !== 4) bad(`group ${g} holds ${groups[g]}`);
}

let wcPlayers = 0;
for (const c of codes) {
  const squad = wc.SQUADS[c] ?? [];
  wcPlayers += squad.length;
  if (squad.length < 14) bad(`${c} has only ${squad.length} players`);
  const by = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  for (const p of squad) for (const pos of p.pos) by[pos] = (by[pos] ?? 0) + 1;
  for (const pos of ['GK', 'DEF', 'MID', 'ATT']) {
    if (!by[pos]) bad(`${c} has no ${pos}`);
  }
}

const wcOut =
  HEAD +
  `
export type WcTeam = {
  /** the nation's name */
  n: string;
  /** its flag, as an emoji */
  f: string;
  /** squad rating, 0 to 99 */
  r: number;
  /** the group it was drawn into */
  g: string;
  /** which confederation it came through */
  c: string;
};

export type WcPlayer = {
  n: string;
  pos: string[];
  rtg: number;
};

/** The forty eight, by their three letter code. */
export const WC_TEAMS: Record<string, WcTeam> = ${JSON.stringify(
    Object.fromEntries(codes.map((c) => [c, wc.TEAMS[c]])),
  )};

/** Their squads, by the same code. */
export const WC_SQUADS: Record<string, WcPlayer[]> = ${JSON.stringify(
    Object.fromEntries(codes.map((c) => [c, wc.SQUADS[c] ?? []])),
  )};

/** Every group letter, in order. */
export const WC_GROUPS: readonly string[] = ${JSON.stringify(Object.keys(groups).sort())};
`;

/* ================= the Champions League ================= */

const ucl = JSON.parse(readFileSync(join('data', 'ucl-database.json'), 'utf8'));

const clubs = Object.keys(ucl.CLUBS).sort();
if (clubs.length !== 36) bad(`${clubs.length} clubs rather than thirty six`);

/* The English five carry their squads in the league database. Anything
   else without a squad here is a club nobody could ever field. */
const ENGLISH = ['Arsenal', 'Aston Villa', 'Liverpool', 'Man City', 'Man United'];
let uclPlayers = 0;
for (const name of clubs) {
  const squad = ucl.SQUADS[name + '|2026'];
  if (!squad) {
    if (!ENGLISH.includes(name)) bad(`${name} has no squad and is not one of the English five`);
    continue;
  }
  uclPlayers += squad.length;
  if (squad.length < 5) bad(`${name} has only ${squad.length} players`);
}

const uclOut =
  HEAD +
  `
export type UclClub = {
  country: string;
  /** the seeding pot, one to four */
  pot: number;
  /** the UEFA five year rank */
  coeff: number;
  /** how it qualified, in words */
  route: string;
  /** decimal odds to win the thing */
  odds: number;
  /** strength on the same 0 to 99 scale as everything else */
  tier: number;
  /** true when the file carries key players rather than a full squad */
  partial: boolean;
};

export type UclPlayer = {
  n: string;
  nat: string;
  pos: string[];
  rtg: number;
  prime: number;
  /** the rating was estimated rather than known */
  est?: number;
  /** whatever the source file wanted to say about him */
  note?: string;
};

/** The thirty six, by club name. */
export const UCL_CLUBS: Record<string, UclClub> = ${JSON.stringify(
    Object.fromEntries(
      clubs.map((n) => {
        const c = ucl.CLUBS[n];
        return [
          n,
          {
            country: c.country,
            pot: c.pot,
            coeff: c.coeff,
            route: c.route,
            odds: c.odds,
            tier: c.tier,
            partial: Boolean(c.partial),
          },
        ];
      }),
    ),
  )};

/**
 * Their squads, keyed the way the league database keys its own.
 *
 * The five English clubs are not in here. They are in the league
 * database already, under the identical key, and copying them would give
 * the game two Arsenals that could drift apart.
 */
export const UCL_SQUADS: Record<string, UclPlayer[]> = ${JSON.stringify(ucl.SQUADS ?? {})};

/** The clubs whose squads live in the league database instead. */
export const UCL_FROM_LEAGUE: readonly string[] = ${JSON.stringify(ENGLISH)};
`;

if (problems) {
  console.log(`\n${problems} problems. Nothing written.\n`);
  process.exit(1);
}

writeFileSync(join('src', 'data', 'worldcup.ts'), wcOut);
writeFileSync(join('src', 'data', 'ucl.ts'), uclOut);

console.log('\nWritten');
console.log(`  src/data/worldcup.ts  ${codes.length} nations, ${wcPlayers} players`);
console.log(`  src/data/ucl.ts       ${clubs.length} clubs, ${uclPlayers} players in the file`);
console.log('');
