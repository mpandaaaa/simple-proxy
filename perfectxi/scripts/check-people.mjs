/**
 * The people layer, against what people actually do.
 *
 * Bookings and suspensions have published rates. Morale, offers and
 * loans do not, so what is checked there is that they behave: that they
 * move in the right direction, that they cannot run away, and that they
 * never produce a number the screen would have to apologise for.
 */
import {
  startCareer,
  clubOptions,
  boardTarget,
  stature,
  statureFloor,
} from '../.headless/engine/career.js';
import {
  seasonCards,
  moraleAfterSeason,
  moraleFit,
  offersFor,
  acceptOffer,
  rejectOffer,
  loanSeason,
  loanClubFor,
  autoLoanPicks,
  reputation,
  jobOffers,
  MORALE_BASE,
} from '../.headless/engine/dynastyPeople.js';
import { styleOf, styleFit } from '../.headless/engine/dynastyStyles.js';
import { startingLeague } from '../.headless/engine/pyramid.js';
import { mulberry32 } from '../.headless/engine/rng.js';

let failures = 0;
const rows = [];
function band(label, got, lo, hi, real) {
  const ok = got >= lo && got <= hi;
  if (!ok) failures++;
  rows.push({ ok, label, got, lo, hi, real });
}
function must(label, ok, real) {
  if (!ok) failures++;
  rows.push({ ok, label, got: ok ? 'yes' : 'NO', lo: 'yes', hi: 'yes', real });
}

const base = startCareer({
  clubKey: clubOptions(2026).find((o) => o.club === 'Arsenal').key,
  scenario: 'giant',
  mode: 'simple',
  formation: '4-3-3',
  seed: 8080,
});
const league = startingLeague('Arsenal');

/* ---------- cards ---------- */
const rnd = mulberry32(1234);
const N = 4000;
let yellows = 0;
let reds = 0;
let banned = 0;
let anyBan = 0;
let midYellows = 0;
let attYellows = 0;
for (let i = 0; i < N; i++) {
  for (const p of base.roster.filter(Boolean)) {
    const d = seasonCards(p, 34, rnd);
    yellows += d.yellows;
    reds += d.reds;
    banned += d.banned;
    if (d.banned > 0) anyBan++;
    if (p.pos === 'MID') midYellows += d.yellows;
    if (p.pos === 'ATT') attYellows += d.yellows;
  }
}
const players = N * base.roster.filter(Boolean).length;
band('bookings per player, a full season', round(yellows / players), 3.5, 6.5, 'a regular starter is booked four to six times');
band('red cards per player, per season', round(reds / players), 0.02, 0.09, 'about fifty a season across the division');
band('players suspended at least once, %', round((anyBan / players) * 100), 25, 60, 'roughly half a squad misses a game for it');
band('games missed per player', round(banned / players), 0.4, 1.6, 'one or two, most seasons');
must('midfielders are booked more than attackers', midYellows > attYellows, 'the men who do the running');

/* zero appearances is zero bookings */
const none = seasonCards(base.roster.find(Boolean), 0, rnd);
must('a man who never plays is never booked', none.yellows === 0 && none.banned === 0, '');

/* ---------- morale ---------- */
const p = { ...base.roster.find(Boolean), morale: MORALE_BASE };
const played = moraleAfterSeason(base, { ...p, apps: 34 }, { finish: 2, trophies: 1, squadWage: 120 }, rnd);
const benched = moraleAfterSeason(base, { ...p, apps: 4 }, { finish: 14, trophies: 0, squadWage: 120 }, rnd);
must('playing and winning makes him happier', played > MORALE_BASE, '');
must('sitting out at a bad club makes him unhappy', benched < MORALE_BASE, '');
band('morale stays on its scale', Math.min(played, benched), 0, 100, '0 to 100');
band('the worst morale costs about three percent', round((1 - moraleFit({ morale: 0 })) * 100), 2, 4, 'never the thing that decides a season');
must('a content player costs nothing', moraleFit({ morale: 70 }) === 1, '');

/* it settles rather than spiralling */
let m = 10;
for (let i = 0; i < 8; i++) {
  m = moraleAfterSeason(base, { ...p, morale: m, apps: 30 }, { finish: 4, trophies: 0, squadWage: 120 }, rnd);
}
band('an unhappy player who plays comes back round', m, 55, 100, 'nothing is permanent');

/* ---------- offers ---------- */
let made = 0;
let over = 0;
let count = 0;
for (let i = 0; i < 600; i++) {
  const offers = offersFor(base, league, mulberry32(500 + i));
  made += offers.length;
  for (const o of offers) {
    count++;
    over += o.fee / o.worth;
    if (o.club === base.club) {
      failures++;
      rows.push({ ok: false, label: 'your own club bid for your player', got: 'yes', lo: 'no', hi: 'no', real: '' });
    }
  }
}
band('offers a summer', round(made / 600), 0.5, 4, 'a good squad is asked about every year');
band('a bid is worth his value times', round(over / Math.max(1, count)), 1.1, 1.6, 'a player who is not for sale costs more');

const one = offersFor(base, league, mulberry32(7)).find(Boolean);
if (one) {
  const took = acceptOffer(base, one);
  must('accepting sells him and banks the fee', !!took && took.roster[one.slot] === null && took.budget === base.budget + one.fee, '');
  const kept = rejectOffer(base, one);
  const before = base.roster[one.slot].morale ?? MORALE_BASE;
  const after = kept.roster[one.slot].morale;
  must('refusing costs him some morale', after < before, 'he knows');
  must('refusing clears the offer', kept.offers.length === 0, '');
}

/* ---------- loans ---------- */
let gained = 0;
let apps = 0;
for (let i = 0; i < 2000; i++) {
  const kid = { rtg: 58, pot: 80, pos: 'MID', n: 'A Kid', age: 18 };
  const club = loanClubFor(kid.rtg, rnd);
  const spell = loanSeason(kid, club, rnd);
  gained += spell.gained;
  apps += spell.apps;
}
band('a season on loan is worth', round(gained / 2000), 3, 10, 'a full season of games makes a footballer');
/* A loan can never make a player worse. It used to: a player whose
   ceiling had fallen below his rating was pulled down to it by the very
   act of sending him out, and the summer reported it as minus one. */
{
  let worst = 99;
  let zeros = 0;
  const cases = [
    { rtg: 78, pot: 76, pos: 'MID', n: 'Past His Ceiling', age: 21 },
    { rtg: 66, pot: 66, pos: 'DEF', n: 'At His Ceiling', age: 19 },
    { rtg: 52, pot: 90, pos: 'ATT', n: 'A Long Way To Go', age: 17 },
  ];
  for (const kid of cases) {
    for (let i = 0; i < 400; i++) {
      const spell = loanSeason(kid, loanClubFor(kid.rtg, mulberry32(i + 9)), mulberry32(i + 70));
      worst = Math.min(worst, spell.gained);
      const ceiling = Math.min(97, kid.pot + spell.lift);
      const after = Math.max(kid.rtg, Math.min(ceiling, Math.round(kid.rtg + spell.gained)));
      if (after < kid.rtg) {
        failures++;
        rows.push({ ok: false, label: 'a loan made ' + kid.n + ' worse', got: after, lo: kid.rtg, hi: 99, real: '' });
      }
      if (spell.apps >= 30 && spell.gained === 0) zeros++;
    }
  }
  must('a loan never costs a player anything', worst >= 0, 'not even one at his ceiling');
  band('full seasons that taught him nothing', zeros, 0, 60, 'a season of games is worth something');
}
/* A loan used to be capped at half the distance to the ceiling, so a
   player already near it gained nothing and the summer reported nought
   for most of a squad. A season of men's football is now allowed to prove
   a scout's ceiling wrong, so there is always something in it. What is
   still true is that a boy with a long way to go gains far more than one
   who has nearly arrived. */
{
  const nearly = { rtg: 78, pot: 80, pos: 'MID', n: 'Nearly There', age: 20 };
  const early = { rtg: 54, pot: 88, pos: 'MID', n: 'A Long Way To Go', age: 18 };
  let tight = 0;
  let loose = 0;
  for (let i = 0; i < 500; i++) {
    tight += loanSeason(nearly, loanClubFor(nearly.rtg, mulberry32(i + 1)), mulberry32(i + 40)).gained;
    loose += loanSeason(early, loanClubFor(early.rtg, mulberry32(i + 1)), mulberry32(i + 40)).gained;
  }
  band('a player near his ceiling gains', round(tight / 500), 1, 5, 'something, but not a lot');
  band('a boy with a long way to go gains', round(loose / 500), 4, 11, 'this is what a loan is for');
  must('the further he has to go the more he gains', loose > tight, '');
}

band('games out on loan', round(apps / 2000), 12, 40, 'he goes where he will play');
must(
  'a good young player gets a better loan than a poor one',
  loanClubFor(66, mulberry32(1)).level < loanClubFor(50, mulberry32(1)).level,
  'level 2 is the Championship',
);
must('the club only sends academy players', autoLoanPicks(base).every((i) => base.youth[i]), '');

/* ---------- what kind of player ---------- */
must('the same name is always the same kind of player', styleOf('Bukayo Saka', 'ATT').id === styleOf('Bukayo Saka', 'ATT').id, '');
must('a keeper is never a poacher', styleOf('Any Keeper', 'GK').id !== 'poacher', '');
const poacher = { n: 'A Poacher', pos: 'ATT' };
const styles = ['possession', 'balanced', 'direct'];
const fits = styles.map((s) => styleFit(poacher, s));
band('a style is worth at most', round((Math.max(...fits) - 1) * 100), 0, 2.6, 'two and a half percent, never more');
band('and costs at most', round((1 - Math.min(...fits)) * 100), 0, 2.6, 'the same the other way');

/* ---------- what the board asks for ---------- */
/* The objective used to come from the squad rating alone, so Arsenal with
   seven titles, twelve million supporters and a squad that had slid were
   asked to avoid relegation and were then pleased with ninth. A club's
   size now sets a floor its own bad season cannot push through, and that
   floor rises on its own as a small club grows. */
{
  const club = (o) => ({
    fans: 2.5,
    titles: 0,
    honours: {},
    infra: { capacity: 30000 },
    seasons: [],
    ...o,
  });

  const arsenal = club({
    fans: 12,
    titles: 7,
    honours: { fa: 2 },
    infra: { capacity: 62000 },
    seasons: [{ fin: 9 }, { fin: 8 }, { fin: 9 }],
  });
  const minnow = club({ fans: 1.6, infra: { capacity: 22000 } });
  const risen = club({
    fans: 4.2,
    honours: { efl: 1 },
    infra: { capacity: 32000 },
    seasons: [{ fin: 12 }, { fin: 10 }, { fin: 8 }, { fin: 7 }, { fin: 6 }],
  });

  band('a giant is rated', stature(arsenal), 85, 100, 'stature, not this season');
  band('a minnow is rated', stature(minnow), 0, 30, '');
  must(
    'a giant is never asked merely to survive',
    boardTarget(arsenal, 75, 0) <= 7,
    'even with a squad that has slid to 75',
  );
  must('a minnow is asked to survive', boardTarget(minnow, 72, 0) >= 15, '');
  must(
    'and is asked for more once it has grown',
    boardTarget(risen, 79, 0) < boardTarget(minnow, 72, 0),
    'the standard rises with the club',
  );
  must(
    'winning raises what is expected of you',
    statureFloor(stature(risen)) <= statureFloor(stature(minnow)),
    '',
  );
}

/* ---------- who wants you ---------- */
const nobody = reputation({ ...base, seasons: [], honours: {}, titles: 0, mgr: 40 });
const somebody = reputation({
  ...base,
  seasons: Array.from({ length: 8 }, () => ({ fin: 2 })),
  honours: { fa: 2, ucl: 1 },
  titles: 3,
  mgr: 90,
});
band('a manager with nothing', nobody, 0, 40, 'nobody is calling');
band('a manager with everything', somebody, 80, 100, 'everybody is');
must('a nobody gets no offers', jobOffers({ ...base, seasons: [], honours: {}, titles: 0, mgr: 30 }, league, mulberry32(3)).length === 0, '');
let jobs = 0;
for (let i = 0; i < 800; i++) {
  jobs += jobOffers(
    { ...base, seasons: Array.from({ length: 6 }, () => ({ fin: 3 })), honours: { fa: 1 }, titles: 1, mgr: 85 },
    league,
    mulberry32(900 + i),
  ).length;
}
band('offers a summer for a good manager', round(jobs / 800), 0.2, 2, 'a phone call, not a queue');

function round(n) {
  return Math.round(n * 100) / 100;
}

console.log('\nThe people, and how they behave\n');
for (const r of rows) {
  console.log(
    `  ${r.ok ? 'pass' : 'FAIL'}  ${r.label.padEnd(44)} ${String(r.got).padStart(6)}   ` +
      `want ${r.lo} to ${r.hi}${r.real ? '   ' + r.real : ''}`,
  );
}
console.log(
  failures ? `\n${failures} of them do not behave.\n` : '\nEverybody behaves.\n',
);
process.exit(failures ? 1 : 0);
