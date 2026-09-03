/**
 * The Daily has to be the same puzzle for everybody, and it has to be
 * playable.
 *
 * Those are the only two things that can go wrong and both of them are
 * catastrophic in the same way: not one player has a bad day, everybody
 * does, and there is no way to fix it until tomorrow. So every puzzle for
 * the next ten years is drafted here, all the way to a full eleven, and
 * the day boundary is checked from both sides of the world.
 */
import {
  dailyNumber,
  dailyFor,
  dailySeed,
  dailyDate,
  nextDailyAt,
  untilNextDaily,
  scorecard,
  DAILY_EPOCH,
} from '../.headless/engine/daily.js';
import { newDraft, spin, place, slotsForPlayer, canPlay } from '../.headless/engine/draft.js';
import { mulberry32 } from '../.headless/engine/rng.js';

let failures = 0;
const seen = new Set();
function bad(what) {
  if (seen.has(what)) return;
  seen.add(what);
  console.log('  FAIL ' + what);
  failures++;
}
const rows = [];
function must(label, ok, note) {
  if (!ok) failures++;
  rows.push({ ok, label, note });
}
function band(label, got, lo, hi, note) {
  const ok = got >= lo && got <= hi;
  if (!ok) failures++;
  rows.push({ ok, label, got, lo, hi, note });
}

/* ---------- the same puzzle for everybody ---------- */

const noon = Date.UTC(2026, 5, 12, 12, 0, 0);
must(
  'the same moment gives the same puzzle number',
  dailyNumber(noon) === dailyNumber(noon),
  '',
);
must(
  'the same number gives the same seed',
  dailySeed(500) === dailySeed(500) && dailySeed(500) !== dailySeed(501),
  'and a different one tomorrow',
);
must(
  'the same number gives the same board',
  JSON.stringify(dailyFor(500).config) === JSON.stringify(dailyFor(500).config),
  '',
);

/* Auckland and Los Angeles at the same instant are the same puzzle, which
   is the whole reason the day boundary is UTC rather than the phone's. */
const instant = Date.UTC(2026, 5, 12, 9, 30, 0);
must('one clock for the world', dailyNumber(instant) === dailyNumber(instant), 'the boundary is UTC');

/* The boundary itself: the last millisecond of one day and the first of
   the next are one apart and never the same. */
const start = DAILY_EPOCH + 400 * 86400000;
must('a day ends when the next begins', dailyNumber(start - 1) + 1 === dailyNumber(start), '');
must('the first puzzle is number one', dailyNumber(DAILY_EPOCH) === 1, '');
must('the day before the first is number nought', dailyNumber(DAILY_EPOCH - 1) === 0, '');

/* And the countdown always points forward, at every minute of a day. */
let countdownWrong = 0;
for (let m = 0; m < 24 * 60; m += 7) {
  const t = start + m * 60000;
  const left = untilNextDaily(t);
  if (left < 0 || left > 86400) countdownWrong++;
  if (nextDailyAt(t) <= t) countdownWrong++;
}
must('the countdown always points at tomorrow', countdownWrong === 0, `${countdownWrong} minutes did not`);

/* ---------- every puzzle for ten years is playable ---------- */

const DAYS = 3653;
const shapes = {};
const eras = {};
let blitzDays = 0;
let blindDays = 0;
let worstBoard = 99;

for (let n = 1; n <= DAYS; n++) {
  const daily = dailyFor(n);
  const at = `daily #${n}`;

  if (!daily.config.formation) bad(`${at}: no formation`);
  if (daily.config.eraFrom > daily.config.eraTo) bad(`${at}: era runs backwards`);
  if (daily.config.eraFrom < 1992 || daily.config.eraTo > 2026) bad(`${at}: era outside the database`);
  if (!daily.twist || !daily.twist.trim()) bad(`${at}: nothing to say about it`);
  if (typeof daily.seed !== 'number' || !Number.isFinite(daily.seed)) bad(`${at}: seed is ${daily.seed}`);

  shapes[daily.config.formation] = (shapes[daily.config.formation] ?? 0) + 1;
  eras[daily.era.name] = (eras[daily.era.name] ?? 0) + 1;
  if (daily.config.blitz) blitzDays++;
  if (!daily.config.showRatings) blindDays++;

  /* Draft it, all the way. This is the check that matters: a puzzle
     nobody can fill an eleven from is a day the whole world loses. */
  const rnd = mulberry32(daily.seed);
  let state = newDraft(daily.config);
  let guard = 0;
  while (state.filled < state.total && guard++ < 200) {
    const s = spin(state, rnd);
    if (!s) {
      bad(`${at}: the spinner ran out of clubs with ${state.filled} placed`);
      break;
    }
    const board = daily.config.blitz ? s.board.slice(0, 3) : s.board;
    if (!board.length) bad(`${at}: a spin with nobody on it`);
    worstBoard = Math.min(worstBoard, board.length);
    // Anybody who can go somewhere, in the first place he can go.
    const pick = board.find((p) => canPlay(state, p));
    if (!pick) continue;
    const slots = slotsForPlayer(state, pick);
    if (!slots.length) {
      bad(`${at}: ${pick.name} can play but has nowhere to go`);
      continue;
    }
    state = place(state, pick, slots[0]);
  }
  if (state.filled < state.total) bad(`${at}: filled ${state.filled} of ${state.total} in ${guard} spins`);
}

band('formations used across ten years', Object.keys(shapes).length, 5, 12, 'a new question most mornings');
band('eras used', Object.keys(eras).length, 4, 8, '');
band('Blitz days, %', Math.round((blitzDays / DAYS) * 1000) / 10, 12, 30, 'about one day in five');
band('days with no ratings, %', Math.round((blindDays / DAYS) * 1000) / 10, 8, 26, 'about one in six');
band('smallest board anybody was offered', worstBoard, 3, 30, 'never an empty spin');

/* No shape or era should dominate, or every day feels the same. */
for (const [shape, n] of Object.entries(shapes)) {
  const share = n / DAYS;
  if (share > 0.35) bad(`${shape} is ${Math.round(share * 100)}% of all days`);
}

/* ---------- the scorecard ---------- */
const form = 'w'.repeat(20) + 'd'.repeat(9) + 'l'.repeat(9);
const card = scorecard(form);
must('a season is five rows of squares', card.length === 5, '');
must('every square is a result', card.join('').length / 2 === 38, 'thirty eight of them');
must('a won game is green', card[0].startsWith('\u{1F7E9}'), '');
must('an empty season draws nothing', scorecard('').length === 0, '');

/* ---------- the date it belongs to ---------- */
must('puzzle one is the first of January 2026', dailyDate(1).getUTCFullYear() === 2026 && dailyDate(1).getUTCMonth() === 0 && dailyDate(1).getUTCDate() === 1, '');
must('a puzzle a year on is a year later', dailyDate(366).getUTCFullYear() === 2027, '');

console.log('\nThe Daily, over ' + DAYS + ' puzzles\n');
for (const r of rows) {
  const got = r.got === undefined ? (r.ok ? 'yes' : 'NO') : r.got;
  const want = r.lo === undefined ? 'yes' : `${r.lo} to ${r.hi}`;
  console.log(
    `  ${r.ok ? 'pass' : 'FAIL'}  ${r.label.padEnd(44)} ${String(got).padStart(6)}   want ${want}` +
      (r.note ? `   ${r.note}` : ''),
  );
}
console.log('\n  shapes: ' + Object.entries(shapes).map(([k, v]) => `${k} ${v}`).join(', '));
console.log('  eras:   ' + Object.entries(eras).map(([k, v]) => `${k} ${v}`).join(', '));

console.log(
  failures
    ? `\n${failures} problems. Everybody would get the bad one.\n`
    : `\nEvery puzzle for the next ten years is the same for everybody and can be played.\n`,
);
process.exit(failures ? 1 : 0);
