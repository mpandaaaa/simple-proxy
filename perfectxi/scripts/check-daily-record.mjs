/**
 * One attempt a day, and a streak that means what it says.
 *
 * The Daily's whole promise is that everybody gets one go at the same
 * puzzle. Every way that promise could be broken is a way somebody could
 * cheat their own streak, so all of them are checked: replaying a puzzle,
 * skipping back to an old one, a phone whose clock is wrong, and the
 * boundary between one day and the next.
 */
import { bankDaily, liveStreak, playedToday, resultFor } from '../.headless/engine/daily.js';

let failures = 0;
const rows = [];
function must(label, ok, note) {
  if (!ok) failures++;
  rows.push({ ok, label, note });
}

const empty = { last: 0, streak: 0, best: 0, played: 0, won: 0, results: [] };

function result(n, over = {}) {
  return {
    n,
    pts: 70,
    position: 4,
    grade: 'B',
    rating: 84,
    gf: 60,
    ga: 40,
    form: 'w'.repeat(20) + 'd'.repeat(9) + 'l'.repeat(9),
    at: 1000 * n,
    ...over,
  };
}

/* ---------- one attempt ---------- */
let r = bankDaily(empty, result(10));
must('a first puzzle is banked', r.last === 10 && r.played === 1, '');
must('and starts a streak of one', r.streak === 1, '');
must('and it counts as played', playedToday(r, 10), '');
must('and yesterday is not today', !playedToday(r, 11), '');

const again = bankDaily(r, result(10, { pts: 200 }));
must('playing the same puzzle twice changes nothing', again === r, 'one attempt');
must('and cannot inflate the best score', again.best === 70, '');

const older = bankDaily(r, result(3, { pts: 300 }));
must('an older puzzle cannot be banked', older === r, 'no going back for a better one');

/* ---------- the streak ---------- */
r = bankDaily(r, result(11));
must('the next day continues it', r.streak === 2, '');
r = bankDaily(r, result(12));
must('and again', r.streak === 3, '');

const skipped = bankDaily(r, result(20));
must('a gap starts again at one', skipped.streak === 1, 'missing a day is missing a day');

must('a live streak survives yesterday', liveStreak(r, 13) === 3, 'you can still play today');
must('a live streak survives today', liveStreak(r, 12) === 3, '');
must('a live streak is gone after a gap', liveStreak(r, 14) === 0, 'it has to say so before you play');
must('no streak without a puzzle', liveStreak(empty, 40) === 0, '');

/* ---------- the record ---------- */
let long = empty;
for (let n = 1; n <= 60; n++) long = bankDaily(long, result(n, { pts: n, position: n === 30 ? 1 : 6 }));
must('sixty puzzles is a streak of sixty', long.streak === 60, '');
must('the best is the best', long.best === 60, '');
must('a title is counted', long.won === 1, '');
must('every one is counted', long.played === 60, '');
must('only the last thirty are kept', long.results.length === 30, 'a year of playing stays small');
must('newest first', long.results[0].n === 60 && long.results[29].n === 31, '');
must('an old one is forgotten', resultFor(long, 1) === null, '');
must('a recent one is found', resultFor(long, 45)?.n === 45, '');

/* ---------- nothing is mutated ---------- */
const before = JSON.stringify(empty);
bankDaily(empty, result(5));
must('banking never changes what it was given', JSON.stringify(empty) === before, '');

console.log('\nOne attempt a day\n');
for (const r2 of rows) {
  console.log(
    `  ${r2.ok ? 'pass' : 'FAIL'}  ${r2.label.padEnd(46)}` + (r2.note ? `   ${r2.note}` : ''),
  );
}
console.log(
  failures
    ? `\n${failures} ways the promise breaks.\n`
    : '\nOne attempt a day, and a streak that means what it says.\n',
);
process.exit(failures ? 1 : 0);
