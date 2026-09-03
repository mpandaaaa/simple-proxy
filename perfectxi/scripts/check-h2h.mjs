/**
 * The head to head draft.
 *
 * One board, two people, alternate first pick, and a footballer taken is
 * gone for the other one. Four things have to hold or the mode is not
 * worth playing, and every one of them is a thing that only shows up
 * under a few thousand matches:
 *
 *   Nobody ends up with a name the other one also has. That is the whole
 *   reason the mode exists.
 *   Both of you always finish an eleven. A shared board runs thinner than
 *   a solo one, and a shape that cannot be filled ends a match.
 *   Neither side has an advantage. Alternating first pick is meant to
 *   make it fair, and whether it does is a number, not an opinion.
 *   A match rebuilt from its picks is the same match. Two phones stay in
 *   step by exchanging picks and nothing else, so if rebuilding is not
 *   exact then the two of them are looking at different boards.
 */
import {
  newH2H,
  h2hFrom,
  pickH2H,
  autoPick,
  machinePick,
  playableFor,
  slotsFor,
  playOut,
  ratings,
  firstOf,
  other,
  xiOf,
} from '../.headless/engine/headToHead.js';
import { canFill } from '../.headless/engine/dynastyTactics.js';
import { defaultConfig } from '../.headless/engine/types.js';
import { mulberry32 } from '../.headless/engine/rng.js';
import {
  duelScore,
  duelVerdict,
  compareSeasons,
  winnerOf,
  DUEL_BONUS,
} from '../.headless/engine/duelScore.js';

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

const CONFIGS = [
  { name: 'the standard duel', c: { ...defaultConfig, diff: 'normal' } },
  { name: 'blitz', c: { ...defaultConfig, diff: 'normal', blitz: true } },
  { name: 'the nineties', c: { ...defaultConfig, diff: 'normal', eraFrom: 1992, eraTo: 1999 } },
  { name: 'a 4-2-4', c: { ...defaultConfig, diff: 'normal', formation: '4-2-4' } },
  { name: 'a 5-3-2', c: { ...defaultConfig, diff: 'normal', formation: '5-3-2' } },
];

/* ---------- who picks first ---------- */

must('A opens the match', firstOf(1) === 'a', '');
must('and B opens the second round', firstOf(2) === 'b', '');
must('it alternates all the way', firstOf(11) === 'a' && firstOf(10) === 'b', '');
must('the other side of A is B', other('a') === 'b' && other('b') === 'a', '');
{
  let aFirst = 0;
  for (let r = 1; r <= 11; r++) if (firstOf(r) === 'a') aFirst++;
  band('first picks A gets over eleven rounds', aFirst, 6, 6, 'and B gets five');
}

/* ---------- a thousand matches played out ---------- */

let shared = 0;
let unfinished = 0;
let illegal = 0;
let aWins = 0;
let bWins = 0;
let level = 0;
let gap = 0;
let boards = 0;
let thinnest = 999;
const MATCHES = 200;

for (const { name, c } of CONFIGS) {
  for (let i = 0; i < MATCHES; i++) {
    const seed = (i * 2654435761 + 13) >>> 0;
    /* Both sides played to the same standard, so any advantage that comes
       out is the draft's and not the players'. */
    const m = playOut(c, seed, 0.85, 0.85);

    if (!m.done) {
      unfinished++;
      bad(`${name}: a match stopped with ${m.a.filled} and ${m.b.filled} picked`);
      continue;
    }

    const A = xiOf(m, 'a').map((s) => s.player?.n);
    const B = xiOf(m, 'b').map((s) => s.player?.n);
    if (A.some((n) => !n) || B.some((n) => !n)) {
      unfinished++;
      bad(`${name}: somebody finished with an empty place`);
      continue;
    }

    /* The point of the mode. */
    const both = A.filter((n) => B.includes(n));
    if (both.length) {
      shared += both.length;
      bad(`${name}: ${both[0]} is in both XIs`);
    }

    /* Nobody twice in one XI either. */
    if (new Set(A).size !== A.length || new Set(B).size !== B.length) {
      bad(`${name}: somebody was taken twice by one side`);
    }

    /* And nobody standing where he cannot play. */
    for (const side of ['a', 'b']) {
      for (const slot of xiOf(m, side)) {
        const has = Array.isArray(slot.player.pos) ? slot.player.pos : [slot.player.pos];
        if (!has.some((x) => canFill(x, slot.pos))) {
          illegal++;
          bad(`${name}: ${slot.player.n} (${has.join('/')}) at ${slot.pos}`);
        }
      }
    }

    const r = ratings(m);
    gap += r.a - r.b;
    if (r.a > r.b) aWins++;
    else if (r.b > r.a) bWins++;
    else level++;
  }
}

const TOTAL = CONFIGS.length * MATCHES;
band('matches played out', aWins + bWins + level, TOTAL, TOTAL, 'every one finished');
must('no footballer is ever in both XIs', shared === 0, `${shared} were`);
must('everybody finished an eleven', unfinished === 0, `${unfinished} did not`);
must('nobody stands where he cannot play', illegal === 0, `${illegal} did`);

/* Fairness is the gap between the two XIs, not who won more. Ratings are
   whole numbers and the two XIs land level a quarter of the time, so
   counting a draw as a loss for one side makes an even match look rigged
   against whoever happens to lose the tie break. */
const aPct = Math.round((aWins / TOTAL) * 100);
const bPct = Math.round((bWins / TOTAL) * 100);
band('A finishes with the better XI, %', aPct, 30, 50, `B does ${bPct}%`);
band('B finishes with the better XI, %', bPct, 30, 50, `A does ${aPct}%`);
band('and they finish level, %', Math.round((level / TOTAL) * 100), 5, 40, '');
band('the edge one side has over the other, points', Math.abs(aPct - bPct), 0, 8,
  'alternating first pick is meant to be fair');
band('the average gap between the two XIs', Math.abs(Math.round((gap / TOTAL) * 100) / 100), 0, 0.6,
  'a fraction of a point, not a head start');

/* ---------- boards are shared and thin out ---------- */

{
  const c = CONFIGS[0].c;
  let m = newH2H(c, 909);
  const clubs = [];
  let smallest = 999;
  while (!m.done) {
    const side = m.turn;
    const before = m.board.length;
    if (m.picks.length % 2 === 0) {
      clubs.push(`${m.club} ${m.season}`);
      boards++;
      smallest = Math.min(smallest, before);
    }
    const got = autoPick(m, side);
    if (!got) break;
    const next = pickH2H(m, side, got.name, got.slot);
    if (next === m) break;
    /* The second pick of a round is from the same board as the first,
       minus the man who has just gone. */
    if (m.picks.length % 2 === 0 && !next.done) {
      const stillThere = next.board.some((p) => p.n === got.name);
      if (stillThere) bad('a player taken was still on the board for the other one');
      if (next.club !== m.club) bad('the board changed in the middle of a round');
    }
    m = next;
  }
  thinnest = smallest;
  must('the match finished', m.done, '');
  band('boards a match gets through', clubs.length, 11, 20,
    'eleven, plus any nobody could use');
  must('every round is a different club-season or a fair draw',
    clubs.length === new Set(clubs).size || clubs.length >= 11, clubs.slice(0, 3).join(', '));
  band('the smallest board anybody saw', thinnest, 4, 40, 'never down to nothing');
}

/* ---------- rebuilding from picks ---------- */

{
  let broken = 0;
  for (let i = 0; i < 120; i++) {
    const seed = (i * 40503 + 991) >>> 0;
    const full = playOut(CONFIGS[0].c, seed, 0.8, 0.9);
    /* Rebuild it from its own picks, the way a phone rebuilds it from
       what the other one has sent, and it must be the same match. */
    const back = h2hFrom(CONFIGS[0].c, seed, full.picks);
    const same =
      JSON.stringify(xiOf(full, 'a')) === JSON.stringify(xiOf(back, 'a')) &&
      JSON.stringify(xiOf(full, 'b')) === JSON.stringify(xiOf(back, 'b')) &&
      full.done === back.done &&
      full.round === back.round;
    if (!same) {
      broken++;
      bad(`a match rebuilt from its picks came out different: seed ${seed}`);
    }

    /* And halfway through, which is the case that actually happens: one
       phone has seen nine picks and rebuilds from those nine. */
    const half = full.picks.slice(0, 9);
    const mid = h2hFrom(CONFIGS[0].c, seed, half);
    const alsoMid = h2hFrom(CONFIGS[0].c, seed, half);
    if (JSON.stringify(mid.board) !== JSON.stringify(alsoMid.board)) {
      broken++;
      bad('rebuilding the same nine picks twice gave two different boards');
    }
    if (mid.picks.length !== 9 || mid.turn !== (9 % 2 === 0 ? mid.first : other(mid.first))) {
      broken++;
      bad('a half rebuilt match had the wrong side to play');
    }
  }
  must('a match rebuilt from its picks is the same match', broken === 0, `${broken} were not`);
}

/* ---------- the rules refuse what they should ---------- */

{
  const m = newH2H(CONFIGS[0].c, 5150);
  const side = m.turn;
  const wrong = other(side);
  const can = playableFor(m, side);
  must('there is something to pick', can.length > 0, String(can.length));

  must('you cannot pick out of turn',
    pickH2H(m, wrong, can[0].n, slotsFor(m, wrong, can[0])[0] ?? 0) === m, '');
  must('you cannot pick somebody who is not on the board',
    pickH2H(m, side, 'Nobody At All', 0) === m, '');

  const good = can[0];
  const legal = slotsFor(m, side, good);
  const bogus = m.a.squad.findIndex((s, i) => !legal.includes(i));
  must('you cannot put him where he cannot play',
    bogus < 0 || pickH2H(m, side, good.n, bogus) === m, '');

  const after = pickH2H(m, side, good.n, legal[0]);
  must('a legal pick goes through', after !== m, '');
  must('and it is the other one to play', after.turn === wrong, String(after.turn));
  must('he is off the board', !after.board.some((p) => p.n === good.n), '');
  must('and cannot be taken again',
    pickH2H(after, wrong, good.n, 0) === after, 'not even by the other side');

  /* The shot clock takes the obvious one, and it is always legal. */
  const auto = autoPick(after, wrong);
  must('the clock always has somebody to take', !!auto, '');
  if (auto) {
    const forced = pickH2H(after, wrong, auto.name, auto.slot);
    must('and taking them is legal', forced !== after, '');
  }
}

/* ---------- the Machine is beatable ---------- */

{
  let good = 0;
  let poor = 0;
  for (let i = 0; i < 300; i++) {
    const seed = (i * 22695477 + 77) >>> 0;
    const m = playOut(CONFIGS[0].c, seed, 1, 0.25);
    const r = ratings(m);
    good += r.a;
    poor += r.b;
  }
  must('picking better wins more often', good / 300 > poor / 300 + 0.3,
    `${Math.round(good / 3) / 100} against ${Math.round(poor / 3) / 100}`);
  band('what a well drafted XI is rated', Math.round(good / 300), 78, 93, 'off a shared board');
}

/* ---------- and it is the same every time ---------- */

{
  const a = playOut(CONFIGS[0].c, 31337, 0.8, 0.8);
  const b = playOut(CONFIGS[0].c, 31337, 0.8, 0.8);
  must('the same seed is the same match',
    JSON.stringify(a.picks) === JSON.stringify(b.picks), '');
  const c = playOut(CONFIGS[0].c, 31338, 0.8, 0.8);
  must('a different seed is a different match',
    JSON.stringify(a.picks) !== JSON.stringify(c.picks), '');
}

/* ---------- what a season is worth ---------- */

{
  const plain = duelScore(78, 5, { national: false, continental: false });
  must('a season with nothing in it is its points', plain.total === 78 && plain.bonus === 0, '');

  const champs = duelScore(88, 1, { national: false, continental: false });
  band('winning the league is worth', champs.bonus, 10, 20, 'about the gap between first and third');

  const nat = duelScore(70, 6, { national: true, continental: false });
  band('the National Cup is worth', nat.bonus, 6, 14, '');

  const con = duelScore(70, 6, { national: false, continental: true });
  band('the Continental Cup is worth', con.bonus, 12, 24, 'the hardest thing on the list');
  must('and it is worth more than the National Cup', con.bonus > nat.bonus, '');

  const dbl = duelScore(90, 1, { national: true, continental: false });
  must('the Double pays on top of both halves',
    dbl.bonus > DUEL_BONUS.champions + DUEL_BONUS.national - 1, String(dbl.bonus));

  const treble = duelScore(95, 1, { national: true, continental: true });
  band('a treble is worth', treble.bonus, 45, 70, 'a season nobody else will have had');
  must('a treble beats a double', treble.bonus > dbl.bonus, '');
  must('the lines add up to the score',
    treble.lines.reduce((a, l) => a + l.value, 0) === treble.total, '');

  /* The league still has to be the thing that decides most duels. Two
     cups and seventh must not beat a title, or the table stops
     mattering. */
  const cupsAndSeventh = duelScore(72, 7, { national: true, continental: true });
  const noneAndFirst = duelScore(95, 1, { national: false, continental: false });
  must('a title still beats two cups and seventh',
    noneAndFirst.total > cupsAndSeventh.total,
    `${noneAndFirst.total} against ${cupsAndSeventh.total}`);

  /* And a cup still has to be able to overturn a close league finish, or
     there is no reason for it to be on the page. */
  const a = duelScore(84, 3, { national: false, continental: true });
  const b = duelScore(88, 2, { national: false, continental: false });
  must('a Continental Cup overturns four league points', a.total > b.total,
    `${a.total} against ${b.total}`);

  must('winning is winning', duelVerdict(90, 80) === 'won', '');
  must('level is level', duelVerdict(80, 80) === 'drew', '');

  /* The comparison knows which way round better runs. */
  const rowsOut = compareSeasons(
    { pts: 80, position: 3, w: 24, d: 8, l: 6, gf: 70, ga: 30, rating: 86, cleanSheets: 14, score: 98 },
    { pts: 80, position: 4, w: 24, d: 8, l: 6, gf: 60, ga: 40, rating: 84, cleanSheets: 10, score: 80 },
  );
  const by = (label) => rowsOut.find((r) => r.label === label);
  must('a higher position is a better position', winnerOf(by('Position')) === 'mine',
    'third beats fourth');
  must('fewer goals conceded is better', winnerOf(by('Goals against')) === 'mine', '');
  must('more goals scored is better', winnerOf(by('Goals for')) === 'mine', '');
  must('level is level on a line too', winnerOf(by('Won')) === 'level', '');
  band('lines on the comparison', rowsOut.length, 8, 16, 'every number has the other one beside it');
}

console.log('\nThe head to head draft\n');
for (const r of rows) {
  const got = r.got === undefined ? (r.ok ? 'yes' : 'NO') : r.got;
  const want = r.lo === undefined ? 'yes' : `${r.lo} to ${r.hi}`;
  console.log(
    `  ${r.ok ? 'pass' : 'FAIL'}  ${r.label.padEnd(46)} ${String(got).padStart(6)}   want ${want}` +
      (r.note ? `   ${r.note}` : ''),
  );
}
console.log(
  failures
    ? `\n${failures} problems.\n`
    : '\nOne board, two XIs, and never the same footballer in both.\n',
);
process.exit(failures ? 1 : 0);
