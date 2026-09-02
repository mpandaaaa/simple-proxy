import { SQUADS } from '../data/squads';
import type { Rng } from './rng';
import type { Position } from './types';
import {
  ageIn,
  seedTracks,
  value,
  wage,
  type Dynasty,
  type DynastyPlayer,
} from './dynasty';
import { injuryMultiplier } from './dynastyClub';
import { primeAge } from './career';

/**
 * Injuries, the academy, contracts and the market.
 *
 * Everything that happens to a squad between one season and the next
 * except getting older. Ported from the web build. Pure, and every draw
 * comes from a passed generator.
 */

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function gauss(rnd: Rng): number {
  const u = 1 - rnd();
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function rint(a: number, b: number, rnd: Rng): number {
  return a + Math.floor(rnd() * (b - a + 1));
}

/* ---------- injuries ---------- */

/**
 * Rates from the UEFA Elite Club Injury Study: eight injuries per thousand
 * hours overall, twenty seven and a half in matches. A twenty five man
 * squad averages about fifty a season and thigh strains are the commonest
 * single type by a distance.
 */
const INJURIES: readonly { t: string; min: number; max: number; w: number }[] = [
  { t: 'Thigh strain', min: 14, max: 35, w: 24 },
  { t: 'Hamstring', min: 14, max: 42, w: 20 },
  { t: 'Ankle sprain', min: 10, max: 35, w: 14 },
  { t: 'Groin', min: 10, max: 30, w: 12 },
  { t: 'Knee', min: 28, max: 120, w: 10 },
  { t: 'Calf', min: 10, max: 28, w: 10 },
  { t: 'Knock', min: 5, max: 12, w: 8 },
  { t: 'Cruciate ligament', min: 180, max: 270, w: 2 },
];

function rollInjury(rnd: Rng) {
  const total = INJURIES.reduce((a, i) => a + i.w, 0);
  let r = rnd() * total;
  for (const i of INJURIES) {
    r -= i.w;
    if (r <= 0) return i;
  }
  return INJURIES[0];
}

/**
 * A season of injuries for one player.
 *
 * Age is most of it, then how prone he is, then how congested the season
 * was, then how good the doctor is. Anything over sixty days leaves a
 * permanent mark on the physical track, which is why a cruciate changes a
 * career rather than a season.
 */
export function seasonInjuries(
  p: DynastyPlayer,
  congestion: number,
  medical: number,
  rnd: Rng,
): { count: number; days: number } {
  const ageF = p.age <= 24 ? 0.85 : p.age <= 28 ? 1.0 : p.age <= 31 ? 1.25 : 1.55;
  let k = 1.9 * ageF * p.prone * congestion * medical;

  let count = 0;
  let days = 0;
  let worst = 0;
  p.lastInj = null;

  while (k > 0) {
    if (rnd() < Math.min(1, k)) {
      const inj = rollInjury(rnd);
      const dur = rint(inj.min, inj.max, rnd);
      count++;
      days += dur;
      if (dur > worst) {
        worst = dur;
        p.lastInj = inj.t;
      }
      if (dur >= 60) p.injHist += 1;
    }
    k -= 1;
  }

  p.daysOut = days;
  p.apps = Math.max(0, Math.round(38 * (1 - Math.min(0.95, days / 300))));
  return { count, days };
}

/* ---------- the academy ---------- */

const FIRST = [
  'Alfie', 'Archie', 'Bobby', 'Callum', 'Dylan', 'Elliot', 'Finley', 'George',
  'Harvey', 'Isaac', 'Jayden', 'Kai', 'Leo', 'Mason', 'Noah', 'Ollie', 'Reuben',
  'Seb', 'Theo', 'Tyler', 'Zac', 'Amari', 'Kofi', 'Rio', 'Junior', 'Malachi',
  'Ronnie', 'Frankie', 'Louie', 'Ezra',
];

const LAST = [
  'Ashworth', 'Bramley', 'Cadogan', 'Doherty', 'Ellison', 'Fairweather',
  'Gallagher', 'Hollis', 'Ingram', 'Jarvis', 'Kingsley', 'Lockwood', 'Maddox',
  'Norrington', 'Oakley', 'Prentice', 'Quinn', 'Rowntree', 'Sackville', 'Thorne',
  'Underhill', 'Vance', 'Whitlock', 'Yarwood', 'Ababio', 'Boateng', 'Okonkwo',
  'Adeyemi',
];

const YOUTH_POS: Position[] = ['GK', 'DEF', 'DEF', 'MID', 'MID', 'ATT'];

/**
 * One academy player.
 *
 * The potential is a lottery and that is the point: four in a hundred are
 * generational, twelve make a first team, twenty nine become squad
 * players, and the rest never make it. You cannot tell which is which
 * without scouting, and even then you only ever get a range.
 */
export function makeYouth(academy: number, club: string, rnd: Rng): DynastyPlayer {
  const pos = YOUTH_POS[Math.floor(rnd() * YOUTH_POS.length)];
  const age = rint(16, 18, rnd);
  const cur = clamp(Math.round(52 + gauss(rnd) * 5 + academy * 1.5), 40, 72);

  const roll = rnd();
  const bump =
    roll < 0.04
      ? rint(28, 36, rnd)
      : roll < 0.16
        ? rint(18, 27, rnd)
        : roll < 0.45
          ? rint(9, 17, rnd)
          : rint(0, 8, rnd);

  const pot = clamp(cur + bump + Math.round(academy - 3), cur, 97);
  const name = `${FIRST[Math.floor(rnd() * FIRST.length)]} ${LAST[Math.floor(rnd() * LAST.length)]}`;

  return seedTracks(
    {
      n: name,
      nat: 'England',
      pos,
      club,
      season: 'Academy',
      rtg: cur,
      age,
      pot,
      youth: true,
      contract: { yrs: 3, wage: wage(cur, age) },
    },
    rnd,
  );
}

/** How many come through, and how good the crop is. */
export function intakeSize(academy: number, rnd: Rng): number {
  return rint(2, 3, rnd) + (academy >= 3 ? 1 : 0) + (academy >= 4 ? 1 : 0);
}

/**
 * What scouting will tell you about a young player's ceiling.
 *
 * Never the number. The range halves with every look, and an older player
 * is easier to read because there is less of him left to guess at.
 */
export function scoutRange(p: DynastyPlayer): { low: number; high: number; exact: boolean } {
  let spread = 22 * Math.pow(0.55, p.scout);
  if (p.age >= 21) spread *= 0.6;
  if (spread < 2.5) {
    return { low: p.pot, high: p.pot, exact: true };
  }
  const half = Math.round(spread / 2);
  return {
    low: clamp(p.pot - half, p.rtg, 99),
    high: clamp(p.pot + half, p.rtg, 99),
    exact: false,
  };
}

/* ---------- contracts ---------- */

export type RenewalTerms = {
  wage: number;
  yrs: number;
  add: number;
  rise: number;
  /** the agent's cut, in £m */
  fee: number;
};

/**
 * What it costs to keep a player.
 *
 * A renewal ADDS years to whatever is left rather than replacing them, and
 * the wage only moves if he has outgrown the deal he is on. Both of those
 * were real bugs: offering a thirty one year old two years when he already
 * had two changed nothing, and a percentage rise per renewal took a wage
 * bill to 86% of revenue.
 */
export function renewalTerms(p: DynastyPlayer): RenewalTerms {
  const market = wage(p.rtg, p.age);
  const cur = p.contract.wage || 0;
  const bump = p.rtg >= 88 ? 1.1 : p.rtg >= 80 ? 1.06 : 1.02;
  const demand = Math.max(cur, Math.round(market * bump));
  const add = p.age >= 33 ? 1 : p.age >= 31 ? 2 : p.age >= 28 ? 3 : 4;
  const total = Math.min(5, p.contract.yrs + add);
  return {
    wage: demand,
    yrs: total,
    add: total - p.contract.yrs,
    rise: demand - cur,
    fee: Math.round(((demand * 52) / 1000) * 0.1),
  };
}

/** Whose deal is nearly up. */
export function expiring(d: Dynasty): { index: number; player: DynastyPlayer }[] {
  const out: { index: number; player: DynastyPlayer }[] = [];
  d.roster.forEach((p, index) => {
    if (p && p.contract.yrs <= 1) out.push({ index, player: p });
  });
  return out;
}

/**
 * Whether the club will renew him without being asked.
 *
 * Good enough, not too old, and the wage bill still under three quarters
 * of what comes in. Otherwise he walks on a free, which is how you lose a
 * player you meant to keep.
 */
export function autoRenews(p: DynastyPlayer, projectedWages: number, revenue: number): boolean {
  return p.rtg >= 70 && p.age <= 32 && projectedWages < revenue * 0.75;
}

/* ---------- the market ---------- */

export type Listing = {
  n: string;
  nat: string;
  club: string;
  pos: Position;
  rtg: number;
  age: number;
  price: number;
  wage: number;
  free: boolean;
};

const ORDER: Record<Position, number> = { GK: 0, DEF: 1, MID: 2, ATT: 3 };

/**
 * Who is for sale this summer.
 *
 * A hundred and thirty club-seasons sampled, anyone already yours thrown
 * out, then nine players worth signing and three free agents. There is
 * always at least one keeper on the list, because a keeper retiring with
 * nobody to replace him would end a career through no fault of yours.
 */
export function market(d: Dynasty, rnd: Rng): Listing[] {
  const have = new Set<string>();
  for (const p of d.roster) if (p) have.add(p.n);

  const keys = Object.keys(SQUADS);
  const seen = new Map<string, Listing>();

  for (let i = 0; i < 130; i++) {
    const key = keys[Math.floor(rnd() * keys.length)];
    const bar = key.lastIndexOf('|');
    const club = key.slice(0, bar);
    const year = Number(key.slice(bar + 1));
    for (const pl of SQUADS[key]) {
      if (have.has(pl.n) || seen.has(pl.n)) continue;
      const pos = (pl.pos[0] as Position) ?? 'MID';
      const rtg = pl.prime || pl.rtg;
      const age = primeAge(pl.n) ?? ageIn(pl.n, year, pos);
      seen.set(pl.n, {
        n: pl.n,
        nat: pl.nat ?? '',
        club,
        pos,
        rtg,
        age,
        price: value(rtg, age, pos, 4),
        wage: wage(rtg, age),
        free: false,
      });
    }
  }

  const all = [...seen.values()];
  const shuffle = (arr: Listing[]) =>
    arr
      .map((v) => ({ v, k: rnd() }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.v);

  const stars = shuffle(all.filter((p) => p.rtg >= 78)).slice(0, 9);
  const frees = shuffle(all.filter((p) => p.rtg >= 68 && p.rtg <= 76))
    .slice(0, 3)
    .map((p) => ({ ...p, free: true, price: 0 }));

  const list = [...stars, ...frees];
  if (!list.some((p) => p.pos === 'GK')) {
    const gk = shuffle(all.filter((p) => p.pos === 'GK' && p.rtg >= 72))[0];
    if (gk) list.push(gk);
  }

  return list.sort(
    (a, b) =>
      (ORDER[a.pos] ?? 9) - (ORDER[b.pos] ?? 9) ||
      Number(a.free) - Number(b.free) ||
      b.rtg - a.rtg,
  );
}

/**
 * Sign one. The fee goes on the books and is written off across the
 * contract, which is what PSR actually measures.
 */
export function sign(
  d: Dynasty,
  listing: Listing,
  slot: number,
  rnd: Rng,
): Dynasty | null {
  if (slot < 0 || slot >= d.roster.length) return null;
  if (d.roster[slot]) return null;
  if (listing.price > d.budget) return null;

  const yrs = listing.free ? 3 : Math.min(5, listing.age >= 31 ? 2 : listing.age >= 28 ? 3 : 4);
  const p = seedTracks(
    {
      n: listing.n,
      nat: listing.nat,
      pos: listing.pos,
      club: listing.club,
      season: 'Signed',
      rtg: listing.rtg,
      age: listing.age,
      contract: { yrs, wage: listing.wage },
    },
    rnd,
  );
  p.book = listing.price;
  p.amort = Math.round(listing.price / yrs);
  p.amortLeft = yrs;

  const roster = [...d.roster];
  roster[slot] = p;
  return { ...d, roster, budget: d.budget - listing.price };
}

/**
 * Sell one.
 *
 * The profit is the fee less whatever is left on the books, which is why
 * an academy graduate is almost pure profit and a player you paid £90m for
 * last summer is not.
 */
export function sell(d: Dynasty, slot: number): Dynasty | null {
  const p = d.roster[slot];
  if (!p) return null;
  const fee = value(p.rtg, p.age, p.pos, p.contract.yrs);
  const roster = [...d.roster];
  roster[slot] = null;
  return {
    ...d,
    roster,
    budget: d.budget + fee,
    saleProfit: d.saleProfit + (fee - p.book),
    sold: [...d.sold, `${p.n} for £${fee}m`],
  };
}

/**
 * Bring an academy player into the squad.
 *
 * Free, because he is already yours. A graduate carries no book value at
 * all, which is why selling one later is almost pure profit and why every
 * club in the country would rather produce a player than buy one.
 */
export function promote(d: Dynasty, youthIndex: number, slot: number): Dynasty | null {
  const y = d.youth[youthIndex];
  if (!y) return null;
  if (slot < 0 || slot >= d.roster.length) return null;
  if (d.roster[slot]) return null;

  // He keeps his own position. Putting him in a place that does not suit
  // him is allowed and costs him, which is what the fit penalty is for.
  // Rewriting the position instead would hide the cost.
  const roster = [...d.roster];
  roster[slot] = { ...y, youth: true };
  return {
    ...d,
    roster,
    youth: d.youth.filter((_, i) => i !== youthIndex),
  };
}

/** Let one go. Nothing comes back for him: he was never worth anything yet. */
export function releaseYouth(d: Dynasty, youthIndex: number): Dynasty {
  return { ...d, youth: d.youth.filter((_, i) => i !== youthIndex) };
}

/** Which places in the shape have nobody in them. */
export function emptySlots(d: Dynasty): { index: number; pos: Position }[] {
  const out: { index: number; pos: Position }[] = [];
  d.roster.forEach((p, index) => {
    if (!p) out.push({ index, pos: d.slots[index] ?? 'MID' });
  });
  return out;
}
