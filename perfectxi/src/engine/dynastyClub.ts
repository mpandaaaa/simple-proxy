import type { Dynasty, Ledger } from './dynasty';
import { everyone } from './dynasty';

/**
 * The books, the backroom and the bricks.
 *
 * Every figure ported from the web build, whose shape is real 2024/25
 * Premier League money: an equal share of about £97m, merit money that
 * falls £2.66m a place, facility fees for being on television, commercial
 * income that follows where you finish, European money, and whatever you
 * take at the gate.
 *
 * Pure. Nothing here knows what a screen is.
 */

/* ---------- staff ---------- */

export type StaffRole = 'coach' | 'medical' | 'youth' | 'setpiece' | 'scout';

export const STAFF: readonly {
  id: StaffRole;
  title: string;
  desc: string;
  effect: string;
}[] = [
  {
    id: 'coach',
    title: 'Head Coach',
    desc: 'Drives how fast your players improve.',
    effect: 'development',
  },
  {
    id: 'medical',
    title: 'Head of Medicine',
    desc: 'Fewer injuries, shorter lay-offs.',
    effect: 'injuries',
  },
  {
    id: 'youth',
    title: 'Head of Youth',
    desc: 'Better academy intakes.',
    effect: 'youth',
  },
  {
    id: 'setpiece',
    title: 'Set-Piece Coach',
    desc: 'Set pieces are 27% of all goals.',
    effect: 'set pieces',
  },
  {
    id: 'scout',
    title: 'Chief Scout',
    desc: 'Brings back more names, and better ones. Reads your own young players quicker.',
    effect: 'scouting',
  },
];

export const STAR_NAMES = ['None', 'Basic', 'Decent', 'Good', 'Excellent', 'Elite'];

/** £m a season, per star. An all elite backroom is £150m a year. */
export function staffCost(stars: number): number {
  return [0, 2, 5, 10, 18, 30][stars] ?? 0;
}

/** A one off, at 2.2 times what the new tier costs to run. */
export function staffUpgradeCost(current: number): number {
  return Math.round(staffCost(current + 1) * 2.2);
}

export function staffWages(d: Dynasty): number {
  return STAFF.reduce((t, s) => t + staffCost(d.staff[s.id] || 1), 0);
}

/** A good coach makes players improve faster. */
export function devMultiplier(d: Dynasty): number {
  return 0.8 + 0.1 * (d.staff.coach || 1);
}

/** A good doctor keeps them on the pitch. */
export function injuryMultiplier(d: Dynasty): number {
  return Math.max(0.5, 1.15 - 0.13 * (d.staff.medical || 1));
}

/** A good training ground does a little of both. */
export function trainingMultiplier(d: Dynasty): number {
  return 0.94 + 0.03 * (d.infra.training || 1);
}

/* ---------- the stadium ---------- */

/** £m a seat, from what Anfield Road actually cost. */
export const SEAT_COST = 0.012;
export const STADIUM_STEP = 5000;

/**
 * What each seat takes on a matchday.
 *
 * Scales with where you finished, from £25 near the bottom to about £90
 * at the top, because a big club charges more and fills the ground.
 */
export function ticketYield(d: Dynasty): number {
  const fin = d.seasons.length ? d.seasons[d.seasons.length - 1].fin : 12;
  return 25 + Math.max(0, 20 - fin) * 3.4;
}

export function matchdayRevenue(d: Dynasty): number {
  return Math.round((d.infra.capacity * 0.93 * ticketYield(d) * 19) / 1_000_000);
}

export function stadiumCost(): number {
  return Math.round(STADIUM_STEP * SEAT_COST);
}

/**
 * Whether building is worth it.
 *
 * Five thousand seats for £60m pays back in about seven and a half years
 * at a big club and twenty at a small one, which is roughly what the real
 * numbers say.
 */
export function stadiumPayback(d: Dynasty): { addRev: number; cost: number; years: number } {
  const addRev = Math.round((STADIUM_STEP * 0.93 * ticketYield(d) * 19) / 1_000_000);
  const cost = stadiumCost();
  return { addRev, cost, years: addRev > 0 ? Math.round((cost / addRev) * 10) / 10 : 99 };
}

/* ---------- the accounts ---------- */

/**
 * The wage bill for a season, in £m.
 *
 * The fourteen are modelled one by one. The rest of a twenty five man
 * squad is not, so it is charged at 48% of the average of the ones that
 * are, which is roughly what a real bench and reserve list costs.
 */
export function wageBill(d: Dynasty): number {
  const squad = everyone(d);
  const t = squad.reduce((a, p) => a + (p.contract.wage || 0) * 52, 0) / 1000;
  const n = squad.length;
  const depth = Math.max(0, 25 - n) * (n ? (t / n) * 0.48 : 0);
  return Math.round(t + depth);
}

/** What is still being written off from transfer fees, this season. */
export function amortTotal(d: Dynasty): number {
  return Math.round(
    everyone(d).reduce((t, p) => t + (p.amortLeft > 0 ? p.amort : 0), 0),
  );
}

/* ---------- the following, and what it buys ---------- */

/** What the club shop costs to build out, by level. */
export const RETAIL_COST = [0, 0, 20, 45, 85, 150];

/** How many people follow a club this size before you have done anything. */
export function startingFans(capacity: number): number {
  return Math.round((capacity / 13500) * 10) / 10;
}

/** Nobody has fewer than this, and nobody in England has more. */
export const FAN_FLOOR = 0.4;
export const FAN_CEIL = 12;

/**
 * What a season does to the following.
 *
 * Winning brings people in and losing loses them, but the squad matters
 * on its own: a team full of players worth watching is followed by people
 * who never see a match. The two together are what merchandise is sold
 * to, so the shop is worth building only once there is somebody to sell
 * to, which is the decision.
 */
export function fanChange(finish: number, squadRating: number, titles: number): number {
  const onThePitch =
    finish === 1 ? 0.62 : finish <= 4 ? 0.34 : finish <= 7 ? 0.14 : finish <= 14 ? 0.02 : finish <= 17 ? -0.06 : -0.18;
  const worthWatching = (squadRating - 78) * 0.022;
  const history = Math.min(0.12, titles * 0.015);
  return Math.round(Math.max(-0.4, Math.min(0.9, onThePitch + worthWatching + history)) * 100) / 100;
}

/** The following after a season, kept inside its bounds. */
export function nextFans(d: Dynasty, finish: number, squadRating: number): number {
  const moved = d.fans + fanChange(finish, squadRating, d.titles);
  return Math.round(Math.max(FAN_FLOOR, Math.min(FAN_CEIL, moved)) * 100) / 100;
}

/** Every level of the shop is worth another twelve percent of everything sold. */
export function retailMultiplier(d: Dynasty): number {
  return 1 + (d.infra?.retail ?? 0) * 0.12;
}

/** Shirts, and everything else with a badge on it, in £m a season. */
export function merchRevenue(d: Dynasty): number {
  return Math.round((d.fans ?? 0) * 9 * retailMultiplier(d));
}

export function revenue(finish: number, d: Dynasty): number {
  const equal = 96.9;
  const merit = Math.max(2.6, 53.1 - (finish - 1) * 2.66);
  const facility = 9 + Math.max(0, 21 - finish) * 0.8;
  /* Commercial used to be a flat bracket by finish. It is now the base
     sponsorship plus what the shop actually sells, so a following is
     worth money rather than being a number on a screen. */
  const commercial = d.titles * 8 + (finish <= 4 ? 30 : finish <= 7 ? 22 : 16);
  const euro = finish === 1 ? 95 : finish <= 4 ? 70 : finish <= 5 ? 55 : finish <= 7 ? 18 : 0;
  return Math.round(
    equal + merit + facility + commercial + euro + merchRevenue(d) + matchdayRevenue(d),
  );
}

/**
 * Close the books on a season.
 *
 * Profit is what came in less wages, less what is being written off from
 * transfer fees, less the 18% it costs to run a football club, plus
 * anything made selling players. Three years of that is what the league
 * looks at, and £105m of losses across them is where the points start
 * coming off. Everton, 2023/24.
 *
 * This mutates the roster's amortisation, because a year of a transfer fee
 * being written off is a year gone whatever else happens.
 */
export function closeBooks(d: Dynasty, finish: number, cupMoney = 0): Ledger {
  /* Prize money is real income and a Champions League run is the biggest
     single line a club has: Arsenal banked £96.85m for reaching one
     semi-final. It goes through the books like everything else, which is
     why qualifying matters more than the trophy. */
  const rev = revenue(finish, d) + Math.round(cupMoney);
  const wages = wageBill(d) + staffWages(d);
  const amort = amortTotal(d);
  const running = Math.round(rev * 0.18);
  const profit = rev - wages - amort - running + d.saleProfit;

  const psr = [...d.psr, profit].slice(-3);
  const rolling = psr.reduce((a, b) => a + b, 0);
  const breach = rolling < -105;
  const deduction = breach ? Math.min(12, 6 + Math.floor((-rolling - 105) / 6.5)) : 0;

  d.psr = psr;
  d.saleProfit = 0;

  for (const p of d.roster) {
    if (!p || p.amortLeft <= 0) continue;
    p.amortLeft--;
    if (p.amortLeft <= 0) {
      p.amort = 0;
      p.book = 0;
    } else {
      p.book = Math.max(0, p.book - p.amort);
    }
  }

  return { rev, wages, amort, running, profit, rolling, breach, deduction };
}

/**
 * What the board hands you to spend.
 *
 * The finish sets the headline figure, and the books cap it. Only 45% of
 * what you did not spend last time carries over: the rest goes back into
 * the club.
 */
export function nextBudget(d: Dynasty, finish: number, ledger: Ledger | null): number {
  const base = baseBudget(finish);
  const allowed = ledger
    ? Math.max(5, Math.round(Math.min(base, Math.max(5, (105 + ledger.rolling) * 0.55))))
    : base;
  return Math.min(320, Math.round(d.budget * 0.45 + allowed));
}

export function baseBudget(finish: number): number {
  return finish === 1
    ? 160
    : finish === 2
      ? 130
      : finish === 3
        ? 110
        : finish === 4
          ? 95
          : finish <= 7
            ? 75
            : finish <= 10
              ? 58
              : finish <= 14
                ? 45
                : finish <= 17
                  ? 34
                  : 25;
}
