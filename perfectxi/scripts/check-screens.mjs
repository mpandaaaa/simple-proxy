/**
 * Everything a screen reads, across a career it actually plays.
 *
 * The checks either side of this one measure whether the game is right.
 * This one measures whether it can be drawn: that no screen is ever
 * handed a NaN, an undefined, a negative where there cannot be one, or a
 * name it has nothing to show for.
 *
 * Almost every bug that has reached a phone in this project has been of
 * that shape rather than a wrong number, so it runs a career forward and
 * walks every field every screen touches, every season.
 */
import { startCareer, clubOptions, takeJob } from '../.headless/engine/career.js';
import { processSeasonEnd } from '../.headless/engine/dynastySeason.js';
import { simulateSeason } from '../.headless/engine/sim.js';
import {
  asSquad,
  starters,
  bench,
  everyone,
  squadRating,
  squadValue,
  playerValue,
} from '../.headless/engine/dynasty.js';
import { chemBonus } from '../.headless/engine/draft.js';
import {
  effectiveRating,
  misfits,
  benchCover,
  setPieceShare,
  tacticDeltas,
} from '../.headless/engine/dynastyTactics.js';
import {
  wageBill as clubWageBill,
  amortTotal,
  revenue,
  merchRevenue,
  matchdayRevenue,
  ticketYield,
  stadiumPayback,
  staffWages,
  devMultiplier,
  injuryMultiplier,
  trainingMultiplier,
} from '../.headless/engine/dynastyClub.js';
import { scoutRange, emptySlots, market, sign, promote } from '../.headless/engine/dynastySquad.js';
import { playerStyle, squadStyleFit, styleMisfits } from '../.headless/engine/dynastyStyles.js';
import { moraleWord, reputation } from '../.headless/engine/dynastyPeople.js';
import { COMPS } from '../.headless/engine/cups.js';
import { mulberry32 } from '../.headless/engine/rng.js';

let failures = 0;
/* What the walk actually reached. A check that silently exercises nothing
   passes for the wrong reason, so it says what it covered. */
const hit = {
  seasons: 0,
  players: 0,
  offers: 0,
  jobs: 0,
  moves: 0,
  loans: 0,
  suspensions: 0,
  cupTies: 0,
  relegations: 0,
  sackings: 0,
  shields: 0,
};
const seen = new Set();
function bad(what) {
  if (seen.has(what)) return;
  seen.add(what);
  console.log('  FAIL ' + what);
  failures++;
}

/** A number a screen can print. */
function num(v, what, { min = -Infinity, max = Infinity, whole = false } = {}) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return bad(`${what} is ${v}`);
  if (v < min || v > max) return bad(`${what} is ${v}, outside ${min} to ${max}`);
  if (whole && !Number.isInteger(v)) return bad(`${what} is ${v} and should be whole`);
}

/** Something a screen puts on the page as words. */
function words(v, what) {
  if (typeof v !== 'string' || !v.trim()) bad(`${what} is ${JSON.stringify(v)}`);
}

/**
 * Fill what is empty, the way a manager would.
 *
 * The engine deliberately does nothing on its own, so a career nobody
 * manages loses a player a year and is over by season five. This promotes
 * from the academy where it helps and signs where it does not, obeying
 * the same rules the app obeys.
 */
function manage(d, rnd) {
  let out = d;
  let listings = market(out, rnd);
  for (const slot of emptySlots(out)) {
    const legal = (from, to) => (from === 'GK') === (to === 'GK') || slot.index >= 11;
    const kid = out.youth
      .map((p, i) => ({ p, i }))
      .filter((x) => !x.p.loan && legal(x.p.pos, slot.pos) && x.p.rtg >= 58)
      .sort((a, b) => b.p.rtg - a.p.rtg)[0];
    const buy = listings
      .filter((l) => legal(l.pos, slot.pos) && l.price <= out.budget)
      .sort((a, b) => b.rtg - a.rtg)[0];

    if (buy && (!kid || buy.rtg > kid.p.rtg + 5)) {
      const after = sign(out, buy, slot.index, rnd);
      if (after) {
        out = after;
        listings = listings.filter((l) => l.n !== buy.n);
        continue;
      }
    }
    if (kid) {
      const after = promote(out, kid.i, slot.index);
      if (after) out = after;
    }
  }
  return out;
}

const SEASONS = 12;
/* The last one is deliberately left to rot, because relegation, the
   Championship and being sacked are three whole screens' worth of paths
   that a well run club never walks. */
const CLUBS = [
  { club: 'Arsenal', managed: true },
  { club: 'Sunderland', managed: true },
  { club: 'Everton', managed: true },
  { club: 'Hull', managed: true },
  { club: 'Hull', managed: false },
];

for (const { club: clubName, managed } of CLUBS) {
  const option = clubOptions(2026).find((o) => o.club === clubName);
  if (!option) {
    bad(`no club called ${clubName} to start a career at`);
    continue;
  }

  let d = startCareer({
    clubKey: option.key,
    scenario: 'longhaul',
    mode: 'simple',
    formation: '4-3-3',
    seed: 20260903,
  });
  /* Injuries on and loans automatic, because the point is to walk every
     path a screen can be handed rather than the quietest one. */
  d = { ...d, injuriesOn: true, autoLoan: true };

  for (let year = 1; year <= SEASONS; year++) {
    const at = `${clubName} season ${year}`;

    /* ---- the hub ---- */
    words(d.club, `${at}: club name`);
    num(d.year, `${at}: year`, { min: 1, whole: true });
    num(d.budget, `${at}: budget`, { min: 0 });
    num(d.mgr, `${at}: board confidence`, { min: 0, max: 99 });
    num(d.fans, `${at}: fans`, { min: 0.3, max: 13 });
    num(d.titles, `${at}: titles`, { min: 0, whole: true });
    words(d.objective.label, `${at}: objective`);
    num(d.objective.target, `${at}: objective target`, { min: 1, max: 20, whole: true });
    num(d.division, `${at}: division`, { min: 1, max: 2, whole: true });
    if (d.league.length !== 19) bad(`${at}: ${d.league.length} clubs in the league`);
    if (d.roster.length !== 14) bad(`${at}: roster is ${d.roster.length}`);
    if (d.slots.length !== 14) bad(`${at}: ${d.slots.length} slots`);

    const xi = starters(d);
    const subs = bench(d);
    if (xi.length > 11) bad(`${at}: ${xi.length} starters`);
    if (subs.length > 3) bad(`${at}: ${subs.length} substitutes`);
    num(squadRating(xi), `${at}: squad rating`, { min: 0, max: 99 });
    num(effectiveRating(d), `${at}: effective rating`, { min: 0, max: 99 });
    num(squadValue(everyone(d)), `${at}: squad value`, { min: 0 });
    num(benchCover(d), `${at}: bench cover`, { min: 0, max: 3 });
    num(squadStyleFit(d), `${at}: how the squad suits the shape`, { min: 0.9, max: 1.1 });
    for (const m of misfits(d)) words(m.name, `${at}: a misfit with no name`);
    for (const m of styleMisfits(d)) {
      words(m.name, `${at}: a style misfit with no name`);
      words(m.style, `${at}: a style with no name`);
    }

    /* ---- every player, on every screen that draws one ---- */
    hit.players += everyone(d).length;
    hit.offers += d.offers.length;
    hit.jobs += d.jobs.length;
    if (d.shield) hit.shields++;
    for (const p of everyone(d)) {
      const who = `${at}: ${p.n || '(no name)'}`;
      words(p.n, `${at}: a player with no name`);
      num(p.rtg, `${who} rating`, { min: 30, max: 99, whole: true });
      num(p.age, `${who} age`, { min: 15, max: 46, whole: true });
      num(p.pot, `${who} ceiling`, { min: 30, max: 99 });
      num(playerValue(p), `${who} value`, { min: 0 });
      num(p.contract.wage, `${who} wage`, { min: 0 });
      num(p.contract.yrs, `${who} years left`, { min: 0, max: 6, whole: true });
      num(p.apps ?? 0, `${who} appearances`, { min: 0, max: 46, whole: true });
      num(p.goals ?? 0, `${who} goals`, { min: 0, max: 60, whole: true });
      num(p.assists ?? 0, `${who} assists`, { min: 0, max: 45, whole: true });
      num(p.morale, `${who} morale`, { min: 0, max: 100 });
      num(p.cards ?? 0, `${who} bookings`, { min: 0, max: 30, whole: true });
      num(p.banned ?? 0, `${who} games banned`, { min: 0, max: 14, whole: true });
      num(p.daysOut ?? 0, `${who} days out`, { min: 0, max: 400 });
      if (p.avgR != null) num(p.avgR, `${who} match rating`, { min: 1, max: 10 });
      words(moraleWord(p.morale), `${who} morale in words`);
      words(playerStyle(p).name, `${who} kind of player`);
      words(playerStyle(p).note, `${who} kind of player, the line under it`);
      // A man cannot score in games he did not play.
      if ((p.goals ?? 0) > 0 && (p.apps ?? 0) === 0) {
        bad(`${who} scored ${p.goals} in ${p.apps} appearances`);
      }
      for (const l of p.loans ?? []) {
        words(l.club, `${who} loan with no club`);
        num(l.apps, `${who} loan appearances`, { min: 0, max: 60, whole: true });
        num(l.gained, `${who} loan gain`, { min: -2, max: 20 });
      }
      for (const h of p.hist ?? []) {
        num(h.apps, `${who} history appearances`, { min: 0, max: 60 });
        num(h.fin, `${who} history finish`, { min: 1, max: 24 });
      }
    }

    /* ---- the academy ---- */
    for (const y of d.youth) {
      const r = scoutRange(y, d.staff.scout);
      num(r.low, `${at}: ${y.n} scouted floor`, { min: 30, max: 99 });
      num(r.high, `${at}: ${y.n} scouted ceiling`, { min: 30, max: 99 });
      if (r.high < r.low) bad(`${at}: ${y.n} has a ceiling below his floor`);
    }

    /* ---- the club, the staff and the books ---- */
    num(d.infra.capacity, `${at}: capacity`, { min: 5000, max: 200000 });
    num(d.infra.retail, `${at}: the shop`, { min: 0, max: 5, whole: true });
    num(ticketYield(d), `${at}: yield a seat`, { min: 0 });
    num(matchdayRevenue(d), `${at}: matchday`, { min: 0 });
    num(merchRevenue(d), `${at}: the shop's takings`, { min: 0 });
    num(revenue(10, d), `${at}: revenue`, { min: 0 });
    num(clubWageBill(d), `${at}: wage bill`, { min: 0 });
    num(staffWages(d), `${at}: backroom wages`, { min: 0 });
    num(amortTotal(d), `${at}: fees written off`, { min: 0 });
    num(devMultiplier(d), `${at}: development`, { min: 0.5, max: 2 });
    num(injuryMultiplier(d), `${at}: injuries`, { min: 0.3, max: 2 });
    num(trainingMultiplier(d), `${at}: training`, { min: 0.5, max: 2 });
    const pay = stadiumPayback(d);
    num(pay.cost, `${at}: what seats cost`, { min: 0 });
    num(pay.years, `${at}: years to pay back`, { min: 0, max: 200 });
    num(reputation(d), `${at}: your reputation`, { min: 0, max: 100 });

    /* ---- the transfer market ---- */
    const listings = market(d, mulberry32(year * 7919 + 3));
    if (!listings.length) bad(`${at}: nobody on the market at all`);
    for (const l of listings) {
      words(l.n, `${at}: a listing with no name`);
      num(l.rtg, `${at}: ${l.n} rating`, { min: 30, max: 99 });
      num(l.price, `${at}: ${l.n} price`, { min: 0 });
      num(l.wage, `${at}: ${l.n} wage`, { min: 0 });
      num(l.age, `${at}: ${l.n} age`, { min: 15, max: 42 });
    }
    for (const h of emptySlots(d)) {
      num(h.index, `${at}: an empty place`, { min: 0, max: 13, whole: true });
      words(h.pos, `${at}: an empty place with no position`);
    }

    /* ---- the offers and the approaches ---- */
    for (const o of d.offers) {
      words(o.name, `${at}: an offer for nobody`);
      words(o.club, `${at}: an offer from nobody`);
      num(o.fee, `${at}: the fee for ${o.name}`, { min: 1 });
      num(o.worth, `${at}: what ${o.name} is worth`, { min: 0 });
      num(o.slot, `${at}: the place ${o.name} is in`, { min: 0, max: 13, whole: true });
      if (o.club === d.club) bad(`${at}: your own club bid for ${o.name}`);
      if (!d.roster[o.slot] || d.roster[o.slot].n !== o.name) {
        bad(`${at}: the offer for ${o.name} points at the wrong place`);
      }
    }
    for (const j of d.jobs) {
      words(j.club, `${at}: an approach from nobody`);
      words(j.objective, `${at}: an approach with no objective`);
      words(j.note, `${at}: an approach with nothing said about it`);
      num(j.budget, `${at}: the budget at ${j.club}`, { min: 0 });
      if (j.club === d.club) bad(`${at}: your own club offered you your own job`);
    }

    /* ---- the Shield tie ---- */
    if (d.shield) {
      words(d.shield.club, `${at}: a Shield against nobody`);
      num(d.shield.rating, `${at}: the Shield opponent's rating`, { min: 30, max: 99 });
      if (d.shield.club === d.club) bad(`${at}: the Shield against yourself`);
    }

    /* ---- the record ---- */
    for (const row of d.seasons) {
      num(row.fin, `${at}: a finish`, { min: 1, max: 24, whole: true });
      num(row.pts, `${at}: points in season ${row.s}`, { min: 0, max: 114, whole: true });
      if (row.w + row.d + row.l !== 38) {
        bad(`${at}: season ${row.s} played ${row.w + row.d + row.l} games`);
      }
      if (row.w * 3 + row.d - (row.ded ?? 0) !== row.pts) {
        bad(`${at}: season ${row.s} points do not match the record`);
      }
      for (const id of row.won ?? []) {
        if (!COMPS[id]) bad(`${at}: won a competition called ${id}`);
      }
      for (const r of row.runs ?? []) {
        if (!COMPS[r.id]) bad(`${at}: a cup run in a competition called ${r.id}`);
      }
    }
    for (const sp of d.spells) {
      words(sp.club, `${at}: a spell at nobody`);
      num(sp.seasons, `${at}: seasons at ${sp.club}`, { min: 0, whole: true });
    }

    /* ---- act like a manager, or the squad decays and the career ends
       four seasons in having walked almost nothing ---- */
    if (managed) d = manage(d, mulberry32(year * 40503 + 7));
    const fit = starters(d);
    if (fit.length < 11) break;
    const squad = asSquad(fit);
    const result = simulateSeason(
      squad,
      d.tactic.form,
      chemBonus(squad),
      mulberry32((d.seed ^ (d.year * 2654435761)) >>> 0),
      d.club,
      d.league,
    );

    if (result.matches.length !== 38) bad(`${at}: ${result.matches.length} matches`);
    if (result.table.length !== 20) bad(`${at}: ${result.table.length} clubs in the table`);
    if (result.table.filter((r) => r.isYou).length !== 1) bad(`${at}: you are in the table twice`);
    if (new Set(result.table.map((r) => (r.isYou ? d.club : r.name))).size !== 20) {
      bad(`${at}: two clubs with the same name in the table`);
    }
    num(result.position, `${at}: your finish`, { min: 1, max: 20, whole: true });
    for (const m of result.matches) {
      words(m.opp, `${at}: a fixture against nobody`);
      if (m.opp === d.club) bad(`${at}: you played yourself`);
      num(m.gf, `${at}: goals for on matchday ${m.n}`, { min: 0, max: 12, whole: true });
      num(m.ga, `${at}: goals against on matchday ${m.n}`, { min: 0, max: 12, whole: true });
    }
    // Nobody twice in a fortnight.
    const lastSeen = {};
    result.matches.forEach((m, i) => {
      if (lastSeen[m.opp] !== undefined && i - lastSeen[m.opp] < 4) {
        bad(`${at}: played ${m.opp} twice inside four matchdays`);
      }
      lastSeen[m.opp] = i;
    });

    hit.seasons++;
    const out = processSeasonEnd(d, result);
    const rep = out.report;
    hit.loans += rep.loans.length;
    hit.suspensions += rep.suspended.length;
    for (const r of rep.cups.runs) hit.cupTies += r.ties.length;
    if (rep.youWentDown) hit.relegations++;
    if (rep.sacked) hit.sackings++;

    /* ---- the season review ---- */
    num(rep.ledger.rev, `${at}: revenue in the books`, { min: 0 });
    num(rep.ledger.wages, `${at}: wages in the books`, { min: 0 });
    num(rep.before, `${at}: squad before`, { min: 0, max: 99 });
    num(rep.after, `${at}: squad after`, { min: 0, max: 99 });
    num(rep.budget, `${at}: next budget`, { min: 0 });
    num(rep.fansBefore, `${at}: fans before`, { min: 0.3, max: 13 });
    num(rep.fansSwing, `${at}: how the following moved`, { min: -1, max: 1 });
    num(rep.cups.money, `${at}: prize money`, { min: 0 });
    for (const run of rep.cups.runs) {
      words(run.name, `${at}: a competition with no name`);
      if (!run.entered) continue;
      if (!run.won && !run.elim) bad(`${at}: ${run.name} neither won nor lost`);
      for (const t of run.ties) {
        if (t.opp === d.club) bad(`${at}: drawn against yourself in the ${run.name}`);
        num(t.gf, `${at}: ${run.name} goals for`, { min: 0, max: 20, whole: true });
        num(t.ga, `${at}: ${run.name} goals against`, { min: 0, max: 20, whole: true });
        num(t.md, `${at}: ${run.name} matchday`, { min: 0, max: 38, whole: true });
      }
    }
    for (const s of rep.suspended) {
      words(s.name, `${at}: somebody suspended with no name`);
      num(s.games, `${at}: ${s.name} games banned`, { min: 1, max: 14, whole: true });
    }
    for (const l of rep.loans) {
      words(l.name, `${at}: a loan with nobody on it`);
      words(l.club, `${at}: a loan to nobody`);
    }
    for (const n of rep.news) {
      words(n.t, `${at}: a headline with no words`);
      words(n.b, `${at}: a story with no words`);
      if (n.t.includes('undefined') || n.b.includes('undefined')) {
        bad(`${at}: "undefined" reached the desk: ${n.t}`);
      }
      if (n.t.includes('NaN') || n.b.includes('NaN')) {
        bad(`${at}: "NaN" reached the desk: ${n.t}`);
      }
    }

    // The team's goals have to be the players' goals.
    const scored = Object.values(result.playerStats).reduce((a, s) => a + s.g, 0);
    if (scored !== result.gf) {
      bad(`${at}: the team scored ${result.gf} and the players scored ${scored}`);
    }

    d = out.dynasty;

    /* Take a job halfway through, so the whole of that path is walked too. */
    if (year === 6 && d.jobs.length) {
      const moved = takeJob(d, d.jobs[0]);
      if (moved) {
        if (moved.club === clubName) bad(`${at}: took a job at the club you already have`);
        if (!moved.spells.length) bad(`${at}: moving club forgot where you had been`);
        if (moved.titles !== d.titles) bad(`${at}: your titles did not come with you`);
        d = moved;
        hit.moves++;
      }
    }

    // Nobody manages a club they have been sacked by.
    if (d.sacked) break;
  }
}

/* ---- and the way down, which a well run club never walks ----
   A squad this bad finishes bottom, so relegation, the Championship, the
   parachute money and the wage clause all get looked at. */
{
  const option = clubOptions(2026).find((o) => o.club === 'Hull');
  let d = startCareer({
    clubKey: option.key,
    scenario: 'longhaul',
    mode: 'simple',
    formation: '4-3-3',
    seed: 616,
  });
  d = {
    ...d,
    injuriesOn: true,
    roster: d.roster.map((p) => (p ? { ...p, rtg: 48, pot: 52 } : p)),
  };

  for (let year = 1; year <= 9; year++) {
    const at = `the way down, season ${year}`;
    /* Keep them under contract, or the squad empties before the board
       loses patience and the sacking is never walked. */
    d = {
      ...d,
      roster: d.roster.map((p) => (p ? { ...p, contract: { ...p.contract, yrs: 5 } } : p)),
    };
    const fit = starters(d);
    if (fit.length < 11) break;
    const squad = asSquad(fit);
    const result = simulateSeason(
      squad,
      d.tactic.form,
      chemBonus(squad),
      mulberry32(year * 99991 + 3),
      d.club,
      d.league,
    );
    const wasIn = d.division;
    const out = processSeasonEnd(d, result);
    hit.seasons++;
    if (out.report.youWentDown) hit.relegations++;
    if (out.report.sacked) hit.sackings++;
    d = out.dynasty;

    num(d.budget, `${at}: budget`, { min: 0 });
    num(d.division, `${at}: division`, { min: 1, max: 2, whole: true });
    num(d.parachute, `${at}: parachute seasons left`, { min: 0, max: 3, whole: true });
    num(revenue(10, d), `${at}: revenue`, { min: 0 });
    words(d.objective.label, `${at}: objective`);
    if (d.league.length !== 19) bad(`${at}: ${d.league.length} clubs in the division`);
    for (const p of everyone(d)) {
      num(p.contract.wage, `${at}: ${p.n} wage`, { min: 0 });
      num(p.rtg, `${at}: ${p.n} rating`, { min: 30, max: 99 });
    }
    /* And a sacked manager is offered somewhere else, because that is the
       whole point of a career belonging to the manager. */
    if (out.report.sacked) {
      if (!d.jobs.length) bad(`${at}: sacked with nowhere to go`);
      for (const j of d.jobs) {
        words(j.club, `${at}: an offer from nobody after a sacking`);
        num(j.rating, `${at}: ${j.club} rating`, { min: 30, max: 99 });
        if (j.club === d.club) bad(`${at}: offered your own job back after being sacked`);
        const moved = takeJob(d, j);
        if (!moved) bad(`${at}: could not take the job at ${j.club}`);
        else {
          if (moved.titles !== d.titles) bad(`${at}: titles lost on the way to ${j.club}`);
          if (moved.spells.length <= d.spells.length) {
            bad(`${at}: moving to ${j.club} forgot where you had been`);
          }
        }
      }
    }

    // Going down cuts the wages, and there is money to keep the lights on.
    if (wasIn === 1 && d.division === 2) {
      if (revenue(10, d) <= 0) bad(`${at}: no revenue at all in the Championship`);
      if (!d.parachute) bad(`${at}: relegated with no parachute payment`);
    }
  }
}

console.log(
  `
Walked ` +
    hit.seasons +
    ' seasons, ' +
    hit.players +
    ' player pages, ' +
    hit.cupTies +
    ' cup ties, ' +
    hit.offers +
    ' offers, ' +
    hit.jobs +
    ' approaches, ' +
    hit.moves +
    ' moves of club, ' +
    hit.loans +
    ' loans back, ' +
    hit.suspensions +
    ' suspensions, ' +
    hit.shields +
    ' Shields, ' +
    hit.relegations +
    ' relegations and ' +
    hit.sackings +
    ' sackings.',
);

/* A walk that reached none of the interesting paths is not a check. */
for (const [what, n] of Object.entries({
  seasons: hit.seasons,
  players: hit.players,
  'cup ties': hit.cupTies,
  offers: hit.offers,
})) {
  if (!n) bad(`the walk never reached any ${what}`);
}

console.log(
  failures
    ? `\n${failures} things a screen could not draw.\n`
    : `\nEvery number and every name that reaches a screen is one it can draw.\n`,
);
process.exit(failures ? 1 : 0);
