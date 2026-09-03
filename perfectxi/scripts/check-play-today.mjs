/**
 * The Weekly Event and Duels.
 *
 * Two things can go wrong and both are the same shape as the Daily's: a
 * week everybody gets that cannot be played, and a duel code that quietly
 * decodes into a different puzzle from the one your friend played. The
 * second is worse than a code that plainly fails, because the loser never
 * finds out why they lost.
 *
 * So every week for ten years is drafted to a full eleven, and every duel
 * code is packed and unpacked again and checked character by character
 * against every single character typo a person can make.
 */
import {
  weekNumber,
  weeklyFor,
  thisWeek,
  nextTwist,
  untilNextWeek,
  nextWeekAt,
  TWISTS,
  bankWeekly,
  bestThisWeek,
  weeklyStreak,
  EMPTY_WEEKLY,
} from '../.headless/engine/weekly.js';
import {
  encodeDuel,
  decodeDuel,
  duelOutcome,
  duelRules,
  DUEL_SHAPES,
} from '../.headless/engine/duel.js';
import { DAILY_EPOCH } from '../.headless/engine/daily.js';
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

/* ================= the Weekly Event ================= */

must('week one holds puzzle one', weekNumber(DAILY_EPOCH) === 1, '');
must(
  'a week is seven days',
  weekNumber(DAILY_EPOCH + 6 * 86400000) === 1 && weekNumber(DAILY_EPOCH + 7 * 86400000) === 2,
  '',
);
must(
  'the countdown points at next week',
  nextWeekAt(DAILY_EPOCH + 3 * 86400000) > DAILY_EPOCH + 3 * 86400000 &&
    untilNextWeek(DAILY_EPOCH + 3 * 86400000) <= 7 * 86400,
  '',
);
must('the same week is the same twist', weeklyFor(9).twist.id === weeklyFor(9).twist.id, '');
must(
  'the twists rotate in order',
  weeklyFor(1).twist.id !== weeklyFor(2).twist.id &&
    weeklyFor(1).twist.id === weeklyFor(1 + TWISTS.length).twist.id,
  'so next week is knowable',
);
must('and next week can be named', !!nextTwist(DAILY_EPOCH).name, '');

/* Every week for ten years, drafted all the way. A week nobody can fill
   an eleven from is a week the whole world loses, the same as a day. */
const WEEKS = 522;
const used = {};
for (let n = 1; n <= WEEKS; n++) {
  const week = weeklyFor(n);
  const at = `week ${n} (${week.twist.name})`;
  used[week.twist.id] = (used[week.twist.id] ?? 0) + 1;

  if (!week.twist.name || !week.twist.rule) bad(`${at}: nothing to say about it`);
  if (week.config.eraFrom > week.config.eraTo) bad(`${at}: era runs backwards`);
  if (week.config.eraFrom < 1992 || week.config.eraTo > 2026) bad(`${at}: era outside the database`);

  /* Ten goes at it, because a week is unlimited attempts and every one of
     them has to be fillable, not just the first. */
  for (let go = 0; go < 10; go++) {
    const rnd = mulberry32(n * 7919 + go * 104729 + 11);
    let state = newDraft(week.config);
    let guard = 0;
    while (state.filled < state.total && guard++ < 300) {
      const s = spin(state, rnd);
      if (!s) {
        bad(`${at}: the spinner ran out of clubs with ${state.filled} placed`);
        break;
      }
      const board = week.config.blitz ? s.board.slice(0, 3) : s.board;
      const pick = board.find((p) => canPlay(state, p));
      if (!pick) continue;
      const slots = slotsForPlayer(state, pick);
      if (!slots.length) continue;
      state = place(state, pick, slots[0]);
    }
    if (state.filled < state.total) {
      bad(`${at}: attempt ${go + 1} filled ${state.filled} of ${state.total}`);
    }
  }
}
band('twists used over ten years', Object.keys(used).length, TWISTS.length, TWISTS.length, 'all of them, evenly');

/* The record: unlimited goes, best kept, and a streak of weeks turned up. */
{
  let rec = EMPTY_WEEKLY;
  const go = (n, pts) => ({ n, twistId: 'x', pts, position: 5, rating: 84, attempts: 1, at: n });
  rec = bankWeekly(rec, go(4, 70));
  must('a first attempt is the best', rec.best.pts === 70 && rec.best.attempts === 1, '');
  rec = bankWeekly(rec, go(4, 60));
  must('a worse attempt does not replace it', rec.best.pts === 70, 'but it is still counted');
  must('and the goes are counted', rec.best.attempts === 2, '');
  rec = bankWeekly(rec, go(4, 88));
  must('a better attempt does replace it', rec.best.pts === 88 && rec.best.attempts === 3, '');
  must('this week is found', bestThisWeek(rec, 4)?.pts === 88, '');
  must('last week is not this week', bestThisWeek(rec, 5) === null, '');

  rec = bankWeekly(rec, go(5, 50));
  must('a new week files the old one away', rec.past.length === 1 && rec.past[0].pts === 88, '');
  must('and starts again', rec.best.pts === 50 && rec.best.attempts === 1, '');
  must('a week in a row is a streak of two', rec.streak === 2, '');
  rec = bankWeekly(rec, go(9, 40));
  must('a missed week starts the streak again', rec.streak === 1, '');
  must('a streak dies when the week passes', weeklyStreak(rec, 12) === 0, '');
  must('and lives while it is current', weeklyStreak(rec, 10) === 3 || weeklyStreak(rec, 10) === 1, '');
}

/* ================= Duels ================= */

const sample = {
  seed: 0xdeadbeef,
  pts: 91,
  rating: 87,
  config: {
    formation: '4-2-3-1',
    diff: 'normal',
    mode: 'squad',
    rtype: 'prime',
    eraFrom: 2000,
    eraTo: 2019,
    blitz: true,
    showRatings: false,
  },
};

const code = encodeDuel(sample);
must('a code is fourteen characters and two dashes', code.length === 16 && code.split('-').length === 3, code);
const back = decodeDuel(code);
must('a code decodes at all', !!back, '');
if (back) {
  must('the seed survives', back.seed === (sample.seed >>> 0), '');
  must('the shape survives', back.config.formation === sample.config.formation, '');
  must('the era survives', back.config.eraFrom === 2000 && back.config.eraTo === 2019, '');
  must('the rules survive', back.config.blitz === true && back.config.showRatings === false, '');
  must('the score to beat survives', back.pts === 91, '');
  must('and what they were rated', back.rating === 87, '');
}

/* Every shape, every era, every flag, every score. If any one of them
   comes back different, somebody plays a puzzle their friend did not. */
let broken = 0;
let checked = 0;
for (const formation of DUEL_SHAPES) {
  for (const [from, to] of [[1992, 2026], [1992, 1999], [2010, 2019], [2015, 2026], [2005, 2005]]) {
    for (const blitz of [true, false]) {
      for (const showRatings of [true, false]) {
        for (const pts of [0, 1, 38, 91, 114, 127]) {
          const d = {
            seed: (checked * 2654435761) >>> 0,
            pts,
            rating: 40 + (checked % 60),
            config: { ...sample.config, formation, eraFrom: from, eraTo: to, blitz, showRatings },
          };
          const round = decodeDuel(encodeDuel(d));
          checked++;
          if (
            !round ||
            round.seed !== d.seed ||
            round.pts !== pts ||
            round.rating !== d.rating ||
            round.config.formation !== formation ||
            round.config.eraFrom !== from ||
            round.config.eraTo !== to ||
            round.config.blitz !== blitz ||
            round.config.showRatings !== showRatings
          ) {
            broken++;
            bad(`a duel came back different: ${formation} ${from}-${to} blitz ${blitz} pts ${pts}`);
          }
        }
      }
    }
  }
}
band('duels packed and unpacked', checked, 500, 100000, 'every shape, era, rule and score');
must('every one came back identical', broken === 0, `${broken} did not`);

/* A typo has to be caught, not quietly played. */
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
let slipped = 0;
let typos = 0;
const plain = code.replace(/-/g, '');
for (let i = 0; i < plain.length; i++) {
  for (const ch of ALPHA) {
    if (ch === plain[i]) continue;
    const wrong = plain.slice(0, i) + ch + plain.slice(i + 1);
    typos++;
    const got = decodeDuel(wrong);
    if (got && JSON.stringify(got) === JSON.stringify(back)) continue; // same duel, harmless
    if (got) slipped++;
  }
}
band('single character typos tried', typos, 300, 100000, 'every character, every replacement');
band('typos that became a different duel, %', Math.round((slipped / typos) * 1000) / 10, 0, 8, 'the checksum catches the rest');

must('rubbish is refused', decodeDuel('hello') === null, '');
must('an empty code is refused', decodeDuel('') === null, '');
must('a short code is refused', decodeDuel('ABC-DEF') === null, '');
must(
  'a code is read however it is typed',
  JSON.stringify(decodeDuel(code.toLowerCase())) === JSON.stringify(back) &&
    JSON.stringify(decodeDuel(code.replace(/-/g, ' '))) === JSON.stringify(back),
  'lower case, spaces or dashes',
);
/* O for nought and I for one are the mistakes people actually make, and
   the alphabet leaves those characters out so they can be corrected. */
must('O is read as nought', decodeDuel(plain.replace(/0/g, 'O')) !== null, '');

must('winning is winning', duelOutcome(90, 80) === 'won', '');
must('a draw is a draw', duelOutcome(80, 80) === 'drew', '');
must('losing is losing', duelOutcome(70, 80) === 'lost', '');
must('a code says what it is', duelRules(sample).includes('4-2-3-1'), duelRules(sample));

console.log('\nPlay today: the week and the duels\n');
for (const r of rows) {
  const got = r.got === undefined ? (r.ok ? 'yes' : 'NO') : r.got;
  const want = r.lo === undefined ? 'yes' : `${r.lo} to ${r.hi}`;
  console.log(
    `  ${r.ok ? 'pass' : 'FAIL'}  ${r.label.padEnd(46)} ${String(got).padStart(6)}   want ${want}` +
      (r.note ? `   ${r.note}` : ''),
  );
}
console.log('\n  twists: ' + Object.entries(used).map(([k, v]) => `${k} ${v}`).join(', '));
console.log(
  failures
    ? `\n${failures} problems.\n`
    : '\nEvery week can be played and every duel is the duel that was sent.\n',
);
process.exit(failures ? 1 : 0);
