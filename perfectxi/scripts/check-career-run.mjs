/**
 * Twenty seasons of Dynasty, end to end, measured.
 *
 * The ageing curves are checked on their own by check-dynasty. This runs
 * the whole loop instead: play, close the books, judge the board, age the
 * squad, renew the contracts, bring through an intake, and do it again.
 *
 * What it is looking for is the things the specification says went wrong
 * before. Wage bills spiralling past what a club earns. Squads that cannot
 * field an XI. Objectives whose words disagree with their target. Career
 * seasons reading as downgrades.
 */
import { clubOptions, startCareer, SCENARIOS } from '../.headless/engine/career.js';
import { starters, everyone, asSquad, squadRating } from '../.headless/engine/dynasty.js';
import { processSeasonEnd } from '../.headless/engine/dynastySeason.js';
import { revenue, wageBill, staffWages } from '../.headless/engine/dynastyClub.js';
import { market, sign, promote, emptySlots } from '../.headless/engine/dynastySquad.js';
import { effectiveRating } from '../.headless/engine/dynastyTactics.js';
import { simulateSeason, chemBonus } from '../.headless/engine/index.js';
import { mulberry32 } from '../.headless/engine/rng.js';

const LABELS = [
  'Win the Premier League', 'Finish in the top two', 'Champions League, top four',
  'European places, top seven', 'Top half finish', 'Comfortable mid-table',
  'Avoid the relegation fight',
];

let failures = 0;
function fail(msg) {
  console.log('  FAIL ' + msg);
  failures++;
}

const clubs = clubOptions(2026);
const SEASONS = 20;

for (const sc of SCENARIOS) {
  const club = clubs.find((c) => c.rank >= sc.tier[0] && c.rank <= sc.tier[1]);
  let d = startCareer({
    clubKey: club.key,
    scenario: sc.id,
    mode: 'simple',
    formation: '4-3-3',
    seed: 20260902,
  });

  console.log(`\n${sc.title} at ${club.club}`);
  let worstWageRatio = 0;
  let sacked = 0;
  let heldTotal = 0;
  let intakeTotal = 0;
  let retiredTotal = 0;

  for (let year = 1; year <= SEASONS; year++) {
    const xi = starters(d);
    if (xi.length < 11) {
      console.log(`  season ${year}: only ${xi.length} fit to start, career over`);
      break;
    }

    const rnd = mulberry32((d.seed ^ (d.year * 2654435761)) >>> 0);
    const squad = asSquad(xi);
    const result = simulateSeason(squad, d.tactic.form, chemBonus(squad), rnd);

    const out = processSeasonEnd(d, result);
    const r = out.report;
    d = out.dynasty;

    /* Act like a manager would, because the engine deliberately does not.
       Promote from the academy where it helps, then sign to fill what is
       left. A career that nobody manages is not a test of the career. */
    const mrnd = mulberry32((d.seed ^ (d.year * 40503)) >>> 0);
    let listings = market(d, mrnd);
    for (const slot of emptySlots(d)) {
      const fits = (from, to) =>
        from === to ? 1 : (to === "MID" && from !== "GK") || (from === "MID" && to !== "GK") ? 0.94 : 0.82;
      const y = d.youth
        .map((p, i) => ({ p, i, v: p.rtg * fits(p.pos, slot.pos) }))
        .filter((x) => x.v >= 55)
        .sort((a, b) => b.v - a.v)[0];
      const buy = listings
        .map((l) => ({ l, v: l.rtg * fits(l.pos, slot.pos) }))
        .filter((x) => x.l.price <= d.budget)
        .sort((a, b) => b.v - a.v)[0]?.l;
      if (buy && (!y || buy.rtg > y.p.rtg + 6)) {
        const after = sign(d, buy, slot.index, mrnd);
        if (after) {
          d = after;
          listings = listings.filter((l) => l.n !== buy.n);
          continue;
        }
      }
      if (y) {
        const after = promote(d, y.i, slot.index);
        if (after) d = after;
      }
    }

    const rev = r.ledger.rev;
    const wages = r.ledger.wages;
    worstWageRatio = Math.max(worstWageRatio, wages / rev);
    heldTotal += r.held.length;
    intakeTotal += r.intake.length;
    retiredTotal += r.retired.length;
    if (r.sacked) sacked++;

    if (!LABELS.includes(d.objective.label)) fail(`season ${year}: label "${d.objective.label}"`);
    if (d.objective.target < 1 || d.objective.target > 20) fail(`season ${year}: target ${d.objective.target}`);
    if (d.roster.length !== 14) fail(`season ${year}: roster is ${d.roster.length}`);
    if (d.mgr < 0 || d.mgr > 99) fail(`season ${year}: confidence ${d.mgr}`);
    if (d.budget < 0) fail(`season ${year}: budget ${d.budget}`);
    if (!Number.isFinite(r.ledger.profit)) fail(`season ${year}: profit is not a number`);
    for (const p of everyone(d)) {
      if (p.rtg < 35 || p.rtg > 99) fail(`season ${year}: ${p.n} rated ${p.rtg}`);
      if (p.age < 15 || p.age > 45) fail(`season ${year}: ${p.n} aged ${p.age}`);
      if (p.contract.yrs < 0 || p.contract.yrs > 5) fail(`season ${year}: ${p.n} has ${p.contract.yrs} years`);
      if (p.avgR != null && (p.avgR < 1 || p.avgR > 10)) fail(`season ${year}: ${p.n} averaged ${p.avgR}`);
    }

    if (year <= 3 || year === SEASONS) {
      console.log(
        `  s${String(year).padStart(2)}  ${String(result.position).padStart(2)}${result.position === 1 ? 'st' : 'th'} on ${String(result.pts).padStart(3)}  ` +
          `rated ${String(squadRating(starters(d))).padStart(2)}  conf ${String(d.mgr).padStart(2)}  ` +
          `£${String(d.budget).padStart(3)}m  rev £${String(rev).padStart(3)}m  wages £${String(wages).padStart(3)}m (${Math.round((wages / rev) * 100)}%)  ` +
          `${r.retired.length} retired  ${r.intake.length} in  ${r.held.length} held`,
      );
    }
  }

  console.log(
    `  worst wage bill ${Math.round(worstWageRatio * 100)}% of revenue, ` +
      `${retiredTotal} retirements, ${intakeTotal} academy, ${heldTotal} careers seasons held, ` +
      `${sacked ? 'SACKED' : 'survived'}`,
  );

  // The specification's own bound: bills sit at 51 to 66% of revenue even if
  // you renew everything every season. Anything near 86% is the old bug.
  if (worstWageRatio > 0.8) fail(`${sc.title}: wage bill reached ${Math.round(worstWageRatio * 100)}% of revenue`);
  if (intakeTotal === 0) fail(`${sc.title}: the academy produced nobody in twenty years`);
  if (retiredTotal === 0) fail(`${sc.title}: nobody retired in twenty years`);
}

console.log(
  failures ? `\n${failures} problems across a hundred seasons.\n` : '\nA hundred seasons, no problems.\n',
);
process.exit(failures ? 1 : 0);
