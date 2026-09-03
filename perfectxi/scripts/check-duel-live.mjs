/**
 * The live duel, and the opponent who plays it.
 *
 * A live duel rests on one claim: both of you draft the same spin
 * sequence. If that is not true the duel is not a duel, it is two people
 * playing different games and one of them being told they lost.
 *
 * So the sequence is checked under picking that deliberately disagrees:
 * one side taking the best player on every board and the other taking the
 * worst it can legally use. The clubs and the seasons must still come out
 * in the same order, because spinning consumes the same two draws
 * whatever is already in an XI.
 *
 * Then the opponent itself: it must always finish an eleven, never place
 * a player somewhere he cannot go, be beatable, not be a pushover, and
 * take a human amount of time doing it.
 */
import {
  draftOpponent,
  landedBy,
  partialSquad,
  opponentDone,
  handleFor,
  SKILL_LOW,
  SKILL_HIGH,
} from '../.headless/engine/opponent.js';
import { newDraft, spin, place, canPlay, slotsForPlayer, squadAvg } from '../.headless/engine/draft.js';
import { canFill } from '../.headless/engine/dynastyTactics.js';
import { defaultConfig } from '../.headless/engine/types.js';
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

const CONFIGS = [
  { name: 'the standard duel', c: { ...defaultConfig, diff: 'normal' } },
  { name: 'blitz', c: { ...defaultConfig, diff: 'normal', blitz: true } },
  { name: 'the nineties', c: { ...defaultConfig, diff: 'normal', eraFrom: 1992, eraTo: 1999 } },
  { name: 'a 4-2-4', c: { ...defaultConfig, diff: 'normal', formation: '4-2-4' } },
  { name: 'hidden ratings', c: { ...defaultConfig, diff: 'normal', showRatings: false } },
];

/* ================= the same spins, whoever is drafting ================= */

/** Draft a whole XI, taking either the best or the worst legal player. */
function run(config, seed, worst) {
  const rnd = mulberry32(seed >>> 0);
  let state = newDraft(config);
  const order = [];
  let guard = 0;
  while (state.filled < state.total && guard++ < 400) {
    const s = spin(state, rnd);
    if (!s) break;
    order.push(`${s.club}|${s.season}`);
    const board = config.blitz ? s.board.slice(0, 3) : s.board;
    const legal = board.filter((p) => canPlay(state, p) && slotsForPlayer(state, p).length);
    if (!legal.length) continue;
    const choice = worst ? legal[legal.length - 1] : legal[0];
    state = place(state, choice, slotsForPlayer(state, choice)[0]);
  }
  return { order, state };
}

let compared = 0;
let diverged = 0;
let shortest = 99;
for (const { name, c } of CONFIGS) {
  for (let i = 0; i < 60; i++) {
    const seed = (i * 2654435761 + 101) >>> 0;
    const a = run(c, seed, false);
    const b = run(c, seed, true);
    if (a.state.filled < a.state.total) bad(`${name}: the best picker could not fill an XI`);
    if (b.state.filled < b.state.total) bad(`${name}: the worst picker could not fill an XI`);

    /* Both drafted an eleven, so both spun at least eleven times. Every
       spin they share has to have been the same club and the same season,
       whatever either of them did with it. */
    const shared = Math.min(a.order.length, b.order.length);
    shortest = Math.min(shortest, shared);
    for (let k = 0; k < shared; k++) {
      compared++;
      if (a.order[k] !== b.order[k]) {
        diverged++;
        bad(`${name}: spin ${k + 1} was ${a.order[k]} for one and ${b.order[k]} for the other`);
        break;
      }
    }
  }
}
band('spins compared under opposite picking', compared, 2000, 200000, 'best against worst');
band('the shortest shared run of spins', shortest, 11, 400, 'nobody drafts an XI in under eleven');
must('not one spin ever differed', diverged === 0, `${diverged} did`);

/* ================= the opponent ================= */

let full = 0;
let illegal = 0;
let outOfOrder = 0;
let ratings = [];
let times = [];
let spinsUsed = [];
const names = new Set();

for (const { name, c } of CONFIGS) {
  for (let i = 0; i < 200; i++) {
    const seed = (i * 40503 + 7919) >>> 0;
    const opp = draftOpponent({ config: c, seed });
    names.add(opp.name);

    if (opp.picks.length === opp.squad.length) full++;
    else bad(`${name}: the opponent stopped at ${opp.picks.length} of ${opp.squad.length}`);

    /* Nobody in a place he cannot fill. A keeper at centre back is the
       one mistake this can make that reaches the screen. */
    for (const p of opp.picks) {
      const want = opp.squad[p.slot]?.pos;
      const has = Array.isArray(p.player.pos) ? p.player.pos : [p.player.pos];
      if (!want || !has.some((x) => canFill(x, want))) {
        illegal++;
        bad(`${name}: ${p.player.n} (${has.join('/')}) was put at ${want}`);
      }
    }

    /* And the picks land in the order they were made. The screen reads
       straight off this list and stops at the first one still to come. */
    for (let k = 1; k < opp.picks.length; k++) {
      if (opp.picks[k].at < opp.picks[k - 1].at) outOfOrder++;
      if (opp.picks[k].spin <= opp.picks[k - 1].spin) outOfOrder++;
    }

    /* Nobody twice. */
    const used = new Set(opp.picks.map((p) => p.player.n));
    if (used.size !== opp.picks.length) bad(`${name}: the opponent signed somebody twice`);

    ratings.push(opp.rating);
    times.push(opp.took);
    spinsUsed.push(opp.picks[opp.picks.length - 1]?.spin ?? 0);
  }
}

const N = CONFIGS.length * 200;
band('opponents who finished an XI', full, N, N, 'every one, in every set of rules');
must('nobody was put where he cannot play', illegal === 0, `${illegal} were`);
must('the picks are in the order they happened', outOfOrder === 0, `${outOfOrder} were not`);
band('different opponents met', names.size, 12, 40, 'it is not the same person every time');

const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
band('what the opponent XI is rated', Math.round(avg(ratings)), 78, 92, 'beatable, and not a pushover');
band('the worst opponent XI', Math.min(...ratings), 60, 88, '');
band('the best opponent XI', Math.max(...ratings), 82, 97, '');
band('how long a draft takes it, seconds', Math.round(avg(times) / 1000), 25, 90, 'a person looking at boards');
band('the quickest draft, seconds', Math.round(Math.min(...times) / 1000), 12, 60, '');
band('spins it needs for an XI', Math.round(avg(spinsUsed)), 11, 26, 'it passes on boards it cannot use');

/* Skill does what it says: better means better. */
{
  let low = 0;
  let high = 0;
  for (let i = 0; i < 400; i++) {
    const seed = (i * 22695477 + 3) >>> 0;
    low += draftOpponent({ config: CONFIGS[0].c, seed, skill: 0.2 }).rating;
    high += draftOpponent({ config: CONFIGS[0].c, seed, skill: 1 }).rating;
  }
  must('a better opponent drafts a better XI', high / 400 > low / 400 + 0.4,
    `${Math.round(low / 4) / 100} against ${Math.round(high / 4) / 100}`);
  band('skill runs between', Math.round(SKILL_LOW * 100), 40, 70, `and ${Math.round(SKILL_HIGH * 100)}`);
}

/* The same seed is the same opponent, every time, or a duel cannot be
   replayed and a live one cannot be checked afterwards. */
{
  const a = draftOpponent({ config: CONFIGS[0].c, seed: 12345 });
  const b = draftOpponent({ config: CONFIGS[0].c, seed: 12345 });
  must('the same seed is the same opponent', JSON.stringify(a) === JSON.stringify(b), '');
  must('and the same name', handleFor(12345) === handleFor(12345), handleFor(12345));
  const c = draftOpponent({ config: CONFIGS[0].c, seed: 12346 });
  must('a different seed is a different draft', JSON.stringify(a) !== JSON.stringify(c), '');
}

/* Reading the clock. */
{
  const opp = draftOpponent({ config: CONFIGS[0].c, seed: 999 });
  must('nothing has landed at nought', landedBy(opp, 0).length === 0, '');
  must('everything has landed at the end', landedBy(opp, opp.took).length === opp.picks.length, '');
  must('and it never goes backwards',
    landedBy(opp, 10000).length <= landedBy(opp, 20000).length, '');
  must('the strip fills up', partialSquad(opp, opp.took).filter(Boolean).length === opp.picks.length, '');
  must('and starts empty', partialSquad(opp, 0).every((p) => p === null), '');
  must('they are not done before they are done', !opponentDone(opp, opp.took - 1), '');
  must('and are done at the end', opponentDone(opp, opp.took), '');
  /* Every slot in the finished strip holds the man the pick says it does. */
  const strip = partialSquad(opp, opp.took);
  must('every place holds the right player',
    opp.picks.every((p) => strip[p.slot]?.n === p.player.n), '');
}

console.log('\nThe live duel\n');
for (const r of rows) {
  const got = r.got === undefined ? (r.ok ? 'yes' : 'NO') : r.got;
  const want = r.lo === undefined ? 'yes' : `${r.lo} to ${r.hi}`;
  console.log(
    `  ${r.ok ? 'pass' : 'FAIL'}  ${r.label.padEnd(44)} ${String(got).padStart(7)}   want ${want}` +
      (r.note ? `   ${r.note}` : ''),
  );
}
console.log(
  failures
    ? `\n${failures} problems.\n`
    : '\nBoth of you draft the same spins, and the other chair is always filled.\n',
);
process.exit(failures ? 1 : 0);
