/**
 * The app against real football.
 *
 * Every band in here is a published figure from the real game, listed in
 * docs/perfect-xi/REALISM.md with its source. This measures what the
 * engine actually produces and fails when it drifts outside what the
 * sport does, which is the only way "realistic" means anything.
 */
import { startCareer, clubOptions } from '../.headless/engine/career.js';
import { seasonInjuries } from '../.headless/engine/dynastySquad.js';
import { simulateSeason, SIM_LEAGUE } from '../.headless/engine/sim.js';
import { asSquad, starters, value, wage } from '../.headless/engine/dynasty.js';
import { chemBonus } from '../.headless/engine/draft.js';
import { mulberry32 } from '../.headless/engine/rng.js';

let failures = 0;
const rows = [];
function band(label, got, lo, hi, real) {
  const ok = got >= lo && got <= hi;
  if (!ok) failures++;
  rows.push({ ok, label, got, lo, hi, real });
}

/* ---------- injuries ---------- */
const base = startCareer({
  clubKey: clubOptions(2026)[0].key,
  scenario: 'elite',
  mode: 'simple',
  formation: '4-3-3',
  seed: 77,
});
const squad = starters(base).concat(base.roster.slice(11).filter(Boolean));
const RUNS = 600;
let inj = 0;
let days = 0;
let players = 0;
let acl = 0;
let over90 = 0;
const rnd = mulberry32(9001);
for (let r = 0; r < RUNS; r++) {
  for (const p of squad) {
    const q = { ...p };
    const out = seasonInjuries(q, 1, 1, rnd);
    inj += out.count;
    days += out.days;
    players++;
    if (out.days >= 150) acl++;
    if (out.days >= 90) over90++;
  }
}
band('injuries per player per season', round(inj / players), 0.9, 1.6, '1.2 (593 across 20 PL clubs)');
band('days out per player per season', round(days / players), 25, 55, '43 (1,073 per club, 25 man squad)');
band('days per injury', round(days / inj), 25, 45, '36 (Premier Injuries, 2024/25)');
band('players over 90 days out, %', round((over90 / players) * 100), 2, 9, 'about 5');
band('season ending injuries, %', round((acl / players) * 100), 0.4, 2.5, '1 to 2 (4 to 11 ACLs a season)');

/* ---------- the league table ---------- */
let champ = 0;
let second = 0;
let eighteenth = 0;
let bottom = 0;
let goals = 0;
const TABLES = 200;
for (let i = 0; i < TABLES; i++) {
  const r = simulateSeason(
    asSquad(starters(base)),
    base.tactic.form,
    chemBonus(asSquad(starters(base))),
    mulberry32(5000 + i),
    base.club,
  );
  /* The nineteen other clubs only. Whether a stacked squad wins the
     league is a different question from whether the league itself looks
     like a league. */
  const t = r.table.filter((x) => !x.isYou);
  champ += t[0].pts;
  second += t[1].pts;
  eighteenth += t[16].pts;
  bottom += t[18].pts;
  goals += t.reduce((a, x) => a + x.gf, 0) / (19 * 19);
}
band('champion points, the AI league', round(champ / TABLES), 80, 96, '84 to 93 in the last five seasons');
band('runner up points', round(second / TABLES), 71, 88, '74 to 89');
band('eighteenth, the first one down', round(eighteenth / TABLES), 18, 34, '25, 26, 26 last three');
band('bottom club points', round(bottom / TABLES), 11, 28, '12 is the worst since Derby on 11');
band('goals per game, whole league', round(goals / TABLES), 2.6, 3.2, '2.93 in 2024/25');

/* ---------- money ---------- */
band('a 92 rated 23 year old, £m', value(92, 23, 'ATT', 4), 100, 160, 'about £125m');
band('a 78 rated 29 year old, £m', value(78, 29, 'MID', 2), 8, 40, 'a squad player, £10m to £35m');
/* A young star is not paid what a proven one is. Saka was on £195k at
   23, Foden £225k, while Haaland is on £525k and Salah £400k. */
band('a 92 rated 23 year old, £k a week', wage(92, 23), 150, 320, 'Saka £195k, Foden £225k');
band('a 92 rated 28 year old, £k a week', wage(92, 28), 300, 560, 'Salah £400k, Haaland £525k');
band('an 84 rated starter, £k a week', wage(84, 27), 110, 200, 'a Premier League regular');
band('a 70 rated squad player, £k a week', wage(70, 25), 30, 90, 'the bottom of a squad');

function round(n) {
  return Math.round(n * 100) / 100;
}

console.log('\nThe app against real football\n');
for (const r of rows) {
  console.log(
    `  ${r.ok ? 'pass' : 'FAIL'}  ${r.label.padEnd(36)} ${String(r.got).padStart(7)}   ` +
      `want ${r.lo} to ${r.hi}   real: ${r.real}`,
  );
}
console.log(
  failures
    ? `\n${failures} of ${rows.length} are not what football does.\n`
    : `\nAll ${rows.length} measurements sit inside what the real game does.\n`,
);
process.exit(failures ? 1 : 0);
