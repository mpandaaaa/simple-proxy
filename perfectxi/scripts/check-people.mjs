/**
 * The people layer, against what people actually do.
 *
 * Bookings and suspensions have published rates. Morale, offers and
 * loans do not, so what is checked there is that they behave: that they
 * move in the right direction, that they cannot run away, and that they
 * never produce a number the screen would have to apologise for.
 */
import { startCareer, clubOptions } from '../.headless/engine/career.js';
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
band('a season on loan is worth', round(gained / 2000), 3, 9, 'a full season of games makes a footballer');
/* And it is capped by how far he had left to go, which is what stops a
   loan being a way round the ceiling you paid to scout. */
{
  const nearly = { rtg: 78, pot: 80, pos: 'MID', n: 'Nearly There', age: 20 };
  let tight = 0;
  for (let i = 0; i < 500; i++) {
    tight += loanSeason(nearly, loanClubFor(nearly.rtg, mulberry32(i + 1)), mulberry32(i + 40)).gained;
  }
  band('a player near his ceiling gains', round(tight / 500), 0, 1.2, 'never more than half of what is left');
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
