/**
 * The division has to move, and it has to stay a division.
 *
 * Three down and three up every May, promoted clubs weak, the odd
 * takeover, and never fewer or more than nineteen opponents. Over twenty
 * seasons the league should look different from how it started without
 * turning into nonsense.
 */
import { endOfSeason, startingLeague, startingChampionship } from '../.headless/engine/pyramid.js';
import { PREMIER_LEAGUE, CHAMPIONSHIP } from '../.headless/engine/sim.js';
import { mulberry32 } from '../.headless/engine/rng.js';

let failures = 0;
const rows = [];
function band(label, got, lo, hi, note) {
  const ok = got >= lo && got <= hi;
  if (!ok) failures++;
  rows.push({ ok, label, got, lo, hi, note });
}
function must(label, ok, note) {
  if (!ok) failures++;
  rows.push({ ok, label, got: ok ? 'yes' : 'NO', lo: 'yes', hi: 'yes', note });
}

const CLUB = 'Arsenal';
const RUNS = 300;
const SEASONS = 20;

let sizeWrong = 0;
let dupes = 0;
let outOfRange = 0;
let churnTotal = 0;
let promotedStrTotal = 0;
let promotedCount = 0;
let everRelegatedMe = 0;
let survivedBack = 0;

for (let r = 0; r < RUNS; r++) {
  const rnd = mulberry32(4242 + r * 7919);
  let league = startingLeague(CLUB);
  let below = CHAMPIONSHIP.map((c) => ({ ...c }));
  let division = 1;
  const first = new Set(league.map((c) => c.name));

  for (let s = 0; s < SEASONS; s++) {
    // A finishing order: the league by strength with the club dropped in.
    const order = [...league]
      .map((c) => ({ name: c.name, key: c.str + (rnd() - 0.5) * 0.3, isYou: false }))
      .concat([{ name: CLUB, key: 0.45 + (rnd() - 0.5) * 0.5, isYou: true }])
      .sort((a, b) => b.key - a.key);

    const out = endOfSeason({ division, league, table: order, club: CLUB, below, rnd });

    if (out.league.length !== 19) sizeWrong++;
    if (new Set(out.league.map((c) => c.name)).size !== out.league.length) dupes++;
    for (const c of out.league) if (c.str < 0.15 || c.str > 0.97) outOfRange++;
    if (out.league.some((c) => c.name === CLUB)) {
      failures++;
      rows.push({ ok: false, label: 'your own club is in your league', got: 'yes', lo: 'no', hi: 'no', note: '' });
    }

    for (const n of out.promoted) {
      const club = out.league.find((c) => c.name === n);
      if (club) {
        promotedStrTotal += club.str;
        promotedCount++;
      }
    }

    if (out.youWentDown) {
      everRelegatedMe++;
      division = 2;
    } else if (out.youWentUp) {
      division = 1;
      survivedBack++;
    }
    league = out.league;
    below = out.below;
  }

  // How much of the division you started against is still there.
  const still = league.filter((c) => first.has(c.name)).length;
  churnTotal += 19 - still;
}

must('every season leaves nineteen opponents', sizeWrong === 0, `${sizeWrong} seasons were not`);
must('nobody appears twice', dupes === 0, `${dupes} seasons had a duplicate`);
must('every strength stays on the scale', outOfRange === 0, `${outOfRange} clubs went off it`);
band(
  'clubs changed over twenty seasons',
  Math.round((churnTotal / RUNS) * 10) / 10,
  4,
  16,
  'three go down every May, so a fair few but not all of them',
);
band(
  'a promoted club arrives rated',
  Math.round((promotedStrTotal / Math.max(1, promotedCount)) * 1000) / 1000,
  0.2,
  0.45,
  'nobody comes up strong',
);
band(
  'careers relegated at least once, %',
  Math.round((everRelegatedMe / RUNS) * 100) / 1,
  1,
  400,
  'it has to be possible and it has to not be constant',
);

/* And the second tier is a real division too. */
const champ = startingChampionship(CLUB);
must('the Championship fields nineteen', champ.length === 19, '');
must(
  'the Championship is weaker than the top flight',
  champ.reduce((a, c) => a + c.str, 0) / champ.length <
    PREMIER_LEAGUE.reduce((a, c) => a + c.str, 0) / PREMIER_LEAGUE.length,
  '',
);

/* The real 2026/27 division. */
const names = PREMIER_LEAGUE.map((c) => c.name);
must('twenty clubs in the top flight', names.length === 20, '');
for (const up of ['Coventry', 'Ipswich', 'Hull']) {
  must(`${up} came up`, names.includes(up), 'promoted for 2026/27');
}
for (const down of ['Wolves', 'Burnley', 'West Ham']) {
  must(`${down} went down`, !names.includes(down), 'relegated after 2025/26');
}

/* And the same seed still gives the same twenty seasons. */
const once = JSON.stringify(
  endOfSeason({
    division: 1,
    league: startingLeague(CLUB),
    table: startingLeague(CLUB)
      .map((c) => ({ name: c.name, isYou: false }))
      .concat([{ name: CLUB, isYou: true }]),
    club: CLUB,
    below: CHAMPIONSHIP.map((c) => ({ ...c })),
    rnd: mulberry32(99),
  }),
);
const twice = JSON.stringify(
  endOfSeason({
    division: 1,
    league: startingLeague(CLUB),
    table: startingLeague(CLUB)
      .map((c) => ({ name: c.name, isYou: false }))
      .concat([{ name: CLUB, isYou: true }]),
    club: CLUB,
    below: CHAMPIONSHIP.map((c) => ({ ...c })),
    rnd: mulberry32(99),
  }),
);
must('the same seed gives the same May', once === twice, '');

console.log('\nPromotion and relegation, over ' + RUNS + ' careers of ' + SEASONS + ' seasons\n');
for (const r of rows) {
  console.log(
    `  ${r.ok ? 'pass' : 'FAIL'}  ${r.label.padEnd(40)} ${String(r.got).padStart(7)}   ` +
      `want ${r.lo} to ${r.hi}${r.note ? '   ' + r.note : ''}`,
  );
}
console.log(
  failures ? `\n${failures} problems with the pyramid.\n` : '\nThe division moves and stays a division.\n',
);
process.exit(failures ? 1 : 0);
