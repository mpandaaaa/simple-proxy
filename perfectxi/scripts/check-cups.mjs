/**
 * The cups, against how often they are actually won.
 *
 * The Premier League's best club wins the FA Cup about one year in five,
 * the League Cup about the same, and the Champions League rather less
 * often than people remember: thirty six clubs enter it and the last ten
 * have been shared between seven different winners.
 *
 * The trebles are the real test. Two English clubs have ever done it,
 * United in 1999 and City in 2023, which across a hundred and thirty odd
 * seasons of English football is well under one percent.
 */
import { simulateSeasonCups, qualifyFor } from '../.headless/engine/cups.js';

const N = 4000;
let failures = 0;
const rows = [];
function band(label, got, lo, hi, real) {
  const ok = got >= lo && got <= hi;
  if (!ok) failures++;
  rows.push({ ok, label, got, lo, hi, real });
}
const pct = (n) => Math.round((n / N) * 1000) / 10;

function run(myAvg, position, europe, shield) {
  const out = { fa: 0, efl: 0, ucl: 0, uel: 0, uecl: 0, shield: 0, treble: 0, double: 0, money: 0 };
  for (let i = 0; i < N; i++) {
    const c = simulateSeasonCups({
      myAvg,
      leaguePosition: position,
      europe,
      shield,
      runSeed: i * 7919 + 3,
    });
    for (const t of c.trophies) out[t]++;
    if (c.double) out.double++;
    if (c.treble) out.treble++;
    out.money += c.money;
  }
  out.money = Math.round(out.money / N);
  return out;
}

/* ---- the best club in the country ---- */
const best = run(91, 1, 'ucl', true);
band('the champions win the FA Cup', pct(best.fa), 12, 26, 'City won 3 of the last 8');
band('the champions win the League Cup', pct(best.efl), 12, 30, 'City won 4 in a row to 2021');
band('the champions win the Champions League', pct(best.ucl), 6, 18, '36 clubs enter, 7 winners in 10 years');
/* Measured on a season the club won the league, so this is the FA Cup
   rate again rather than an independent number. What it is here to catch
   is the double coming out more likely than the cup on its own. */
band('champions who also take the FA Cup', pct(best.double), 12, 26, 'City 2019 and 2023, Arsenal 2002');
band('the treble', pct(best.treble), 0.1, 2.5, 'United 1999 and City 2023, and nobody else');

/* ---- a good side that is not the best ---- */
const good = run(84, 6, 'uel', false);
band('sixth wins the FA Cup', pct(good.fa), 2, 12, 'Palace 2025, Wigan 2013');
band('sixth wins the Europa League', pct(good.uel), 8, 30, 'Spurs 2025 finished 17th');

/* ---- a club on the way up ---- */
const rising = run(78, 8, 'uecl', false);
band('eighth wins the Conference', pct(rising.uecl), 8, 40, 'the one a rising club wins first');
band('eighth wins the FA Cup', pct(rising.fa), 0.5, 7, 'a real shock');

/* ---- and a club with nothing ---- */
const small = run(72, 14, null, false);
band('fourteenth wins the FA Cup', pct(small.fa), 0, 3, 'Wigan in 2013 is the whole list');

/* ---- what the cups are worth ---- */
band('a Champions League season, £m', best.money, 55, 130, 'City £65m out in the league phase, Arsenal £97m to a semi');
band('a Europa League season, £m', good.money, 4, 30, 'Spurs about £25m for winning it');
band('a Conference season, £m', rising.money, 2, 20, 'Chelsea about £16m for winning it');
band('no Europe at all, £m', small.money, 0, 4, 'the two domestic cups and nothing else');

/* ---- who goes where next season ---- */
const q = [
  ['champions', qualifyFor(1, false, false, false, false, false), 'ucl'],
  ['fifth', qualifyFor(5, false, false, false, false, false), 'ucl'],
  ['sixth', qualifyFor(6, false, false, false, false, false), 'uel'],
  ['seventh', qualifyFor(7, false, false, false, false, false), 'uecl'],
  ['eighth', qualifyFor(8, false, false, false, false, false), null],
  ['tenth with the FA Cup', qualifyFor(10, true, false, false, false, false), 'uel'],
  ['tenth with the League Cup', qualifyFor(10, false, true, false, false, false), 'uecl'],
  ['seventeenth, Europa winners', qualifyFor(17, false, false, false, true, false), 'ucl'],
];
for (const [who, got, want] of q) {
  if (got !== want) {
    failures++;
    rows.push({ ok: false, label: `${who} go to`, got: String(got), lo: want, hi: want, real: 'the real rule' });
  }
}

/* ---- and it still replays ---- */
const a = simulateSeasonCups({ myAvg: 89, leaguePosition: 2, europe: 'ucl', shield: false, runSeed: 12345 });
const b = simulateSeasonCups({ myAvg: 89, leaguePosition: 2, europe: 'ucl', shield: false, runSeed: 12345 });
if (JSON.stringify(a) !== JSON.stringify(b)) {
  failures++;
  rows.push({ ok: false, label: 'the same seed gives the same cups', got: 'no', lo: 'yes', hi: 'yes', real: '' });
}

console.log('\nThe cups, against how often they are really won\n');
for (const r of rows) {
  console.log(
    `  ${r.ok ? 'pass' : 'FAIL'}  ${r.label.padEnd(40)} ${String(r.got).padStart(7)}   ` +
      `want ${r.lo} to ${r.hi}${r.real ? '   real: ' + r.real : ''}`,
  );
}

/* ---- a season, printed, so the shape can be read ---- */
const sample = simulateSeasonCups({
  myAvg: 90,
  leaguePosition: 2,
  europe: 'ucl',
  shield: true,
  runSeed: 999,
});
console.log('\nOne season for a 90 rated squad in the Champions League');
for (const r of sample.runs) {
  if (!r.entered) continue;
  console.log(`  ${r.name}  £${r.money}m  ${r.won ? 'WINNERS' : 'out in the ' + r.elim}`);
  for (const t of r.ties) {
    const score = t.detail ?? `${t.gf}-${t.ga}${t.pens ? ' (' + t.pens + ')' : ''}`;
    console.log(
      `      md${String(t.md).padStart(2)}  ${t.round.padEnd(14)} ${(t.opp ?? '').padEnd(20)} ${score}`,
    );
  }
}
console.log(`  total £${sample.money}m, next season: ${sample.europeNext ?? 'no Europe'}`);

console.log(
  failures
    ? `\n${failures} of the cups are not won as often as they are in life.\n`
    : `\nEvery cup is won about as often as it is in life.\n`,
);
process.exit(failures ? 1 : 0);
