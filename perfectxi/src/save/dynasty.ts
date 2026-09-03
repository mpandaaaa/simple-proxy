import { defineStore } from './storage';
import { EMPTY_STAFF, EMPTY_TACTIC, type Dynasty, type DynastyPlayer } from '../engine/dynasty';
import { tidySquad } from '../engine/dynastySquad';
import { startingFans } from '../engine/dynastyClub';
import { startingLeague } from '../engine/pyramid';
import { CHAMPIONSHIP } from '../engine/sim';

/**
 * The Dynasty career in progress, or null when there is not one.
 *
 * `null` is a real state and not an error: the Dynasty row on Home then
 * carries the description instead of a status line.
 *
 * The shape changed three times while the mode was being built, so this
 * file carries the whole chain. The rule it follows now, learned the hard
 * way: every field a screen reads must either be validated here or filled
 * in by a migration. A save that passes a loose check and is then missing
 * something a screen reads crashes the screen, which is exactly what
 * happened when tactics were added without a version bump.
 */

export type { Dynasty };

/** What the home screen needs, derived rather than stored twice. */
export type DynastySummary = {
  club: string;
  season: number;
  rating: number;
  titles: number;
};

function isPlayer(v: unknown): v is DynastyPlayer {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.n === 'string' &&
    typeof p.pos === 'string' &&
    typeof p.rtg === 'number' &&
    typeof p.age === 'number' &&
    typeof p.phys === 'number' &&
    typeof p.tech === 'number' &&
    typeof p.ment === 'number' &&
    typeof p.pot === 'number' &&
    typeof p.apps === 'number' &&
    typeof p.goals === 'number' &&
    typeof p.assists === 'number' &&
    typeof p.daysOut === 'number' &&
    typeof p.injHist === 'number' &&
    typeof p.book === 'number' &&
    typeof p.amort === 'number' &&
    typeof p.amortLeft === 'number' &&
    typeof p.scout === 'number' &&
    typeof p.youth === 'boolean' &&
    Array.isArray(p.hist) &&
    typeof p.contract === 'object' &&
    p.contract !== null
  );
}

/**
 * Everything a screen reads has to be checked here.
 *
 * Deliberately exhaustive. A cheaper check is how a career with no tactics
 * reached a screen that needed them.
 */
function isDynasty(v: unknown): v is Dynasty | null {
  if (v === null) return true;
  if (typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  const obj = (x: unknown) => typeof x === 'object' && x !== null;

  return (
    typeof d.seed === 'number' &&
    typeof d.club === 'string' &&
    typeof d.year === 'number' &&
    typeof d.formation === 'string' &&
    typeof d.mode === 'string' &&
    typeof d.scenario === 'string' &&
    Array.isArray(d.roster) &&
    d.roster.every((p) => p === null || isPlayer(p)) &&
    Array.isArray(d.slots) &&
    typeof d.mgr === 'number' &&
    typeof d.budget === 'number' &&
    typeof d.leash === 'number' &&
    obj(d.objective) &&
    typeof d.capacity === 'number' &&
    typeof d.fans === 'number' &&
    obj(d.honours) &&
    Array.isArray(d.league) &&
    Array.isArray(d.offers) &&
    Array.isArray(d.jobs) &&
    obj(d.tactic) &&
    typeof (d.tactic as Record<string, unknown>).form === 'string' &&
    obj(d.staff) &&
    obj(d.infra) &&
    typeof (d.infra as Record<string, unknown>).retail === 'number' &&
    Array.isArray(d.youth) &&
    d.youth.every(isPlayer) &&
    Array.isArray(d.retired) &&
    Array.isArray(d.seasons) &&
    typeof d.titles === 'number' &&
    obj(d.allTime) &&
    obj(d.records) &&
    Array.isArray(d.inbox) &&
    Array.isArray(d.psr) &&
    typeof d.saleProfit === 'number' &&
    typeof d.psrHit === 'number' &&
    typeof d.marketRolls === 'number' &&
    Array.isArray(d.expired) &&
    Array.isArray(d.renewed) &&
    Array.isArray(d.sold) &&
    Array.isArray(d.injuries) &&
    typeof d.sacked === 'boolean'
  );
}

/**
 * Fill in everything a player gained after he was saved.
 *
 * Defaults that read as "this has not happened yet" rather than as data:
 * no appearances, no rating, no injuries, nothing on the books.
 */
function repairPlayer(v: unknown): DynastyPlayer | null {
  if (typeof v !== 'object' || v === null) return null;
  const p = v as Record<string, unknown>;
  if (typeof p.n !== 'string' || typeof p.rtg !== 'number') return null;
  return {
    n: p.n,
    nat: typeof p.nat === 'string' ? p.nat : '',
    pos: (typeof p.pos === 'string' ? p.pos : 'MID') as DynastyPlayer['pos'],
    club: typeof p.club === 'string' ? p.club : '',
    season: typeof p.season === 'string' ? p.season : '',
    rtg: p.rtg,
    age: typeof p.age === 'number' ? p.age : 26,
    phys: typeof p.phys === 'number' ? p.phys : p.rtg,
    tech: typeof p.tech === 'number' ? p.tech : p.rtg,
    ment: typeof p.ment === 'number' ? p.ment : p.rtg,
    pot: typeof p.pot === 'number' ? p.pot : p.rtg,
    peakOff: typeof p.peakOff === 'number' ? p.peakOff : 0,
    declMul: typeof p.declMul === 'number' ? p.declMul : 1,
    prone: typeof p.prone === 'number' ? p.prone : 1,
    contract:
      typeof p.contract === 'object' && p.contract !== null
        ? (p.contract as DynastyPlayer['contract'])
        : { yrs: 3, wage: 30 },
    apps: typeof p.apps === 'number' ? p.apps : 0,
    goals: typeof p.goals === 'number' ? p.goals : 0,
    assists: typeof p.assists === 'number' ? p.assists : 0,
    avgR: typeof p.avgR === 'number' ? p.avgR : null,
    daysOut: typeof p.daysOut === 'number' ? p.daysOut : 0,
    lastInj: typeof p.lastInj === 'string' ? p.lastInj : null,
    injHist: typeof p.injHist === 'number' ? p.injHist : 0,
    delta: typeof p.delta === 'number' ? p.delta : 0,
    why: typeof p.why === 'string' ? p.why : null,
    retired: p.retired === true,
    book: typeof p.book === 'number' ? p.book : 0,
    amort: typeof p.amort === 'number' ? p.amort : 0,
    amortLeft: typeof p.amortLeft === 'number' ? p.amortLeft : 0,
    youth: p.youth === true,
    joined: typeof p.joined === 'number' ? p.joined : 0,
    scout: typeof p.scout === 'number' ? p.scout : 0,
    morale: typeof p.morale === 'number' ? p.morale : 70,
    cards: typeof p.cards === 'number' ? p.cards : 0,
    reds: typeof p.reds === 'number' ? p.reds : 0,
    banned: typeof p.banned === 'number' ? p.banned : 0,
    loan: typeof p.loan === 'string' ? p.loan : null,
    loans: Array.isArray(p.loans) ? (p.loans as DynastyPlayer['loans']) : [],
    hist: Array.isArray(p.hist) ? (p.hist as DynastyPlayer['hist']) : [],
  };
}

/**
 * Version 3 to 4: everything the finished mode added.
 *
 * A career from before tactics, staff, facilities, the academy and the
 * accounts existed is still a real career with a real squad in it, so it
 * is repaired rather than thrown away. Only what is genuinely unknowable
 * gets a default.
 */
function migrateToFour(v: unknown): Dynasty | null {
  if (typeof v !== 'object' || v === null) return null;
  const d = v as Record<string, unknown>;
  if (!Array.isArray(d.roster) || typeof d.club !== 'string') return null;

  const formation = typeof d.formation === 'string' ? d.formation : '4-3-3';
  const seasons = Array.isArray(d.seasons) ? (d.seasons as Dynasty['seasons']) : [];
  const capacity = typeof d.capacity === 'number' ? d.capacity : 40000;

  return {
    seed: typeof d.seed === 'number' ? d.seed : 1,
    club: d.club,
    year: typeof d.year === 'number' ? d.year : 1,
    formation,
    mode: d.mode === 'immersive' ? 'immersive' : 'simple',
    scenario: typeof d.scenario === 'string' ? d.scenario : 'elite',
    roster: d.roster.map(repairPlayer),
    slots: Array.isArray(d.slots) ? (d.slots as Dynasty['slots']) : [],
    mgr: typeof d.mgr === 'number' ? d.mgr : 55,
    budget: typeof d.budget === 'number' ? d.budget : 60,
    leash: typeof d.leash === 'number' ? d.leash : 1,
    objective:
      typeof d.objective === 'object' && d.objective !== null
        ? (d.objective as Dynasty['objective'])
        : { label: 'Top half finish', target: 10 },
    capacity,
    fans: typeof d.fans === 'number' ? d.fans : startingFans(capacity),
    europe:
      d.europe === 'ucl' || d.europe === 'uel' || d.europe === 'uecl' ? d.europe : null,
    honours:
      typeof d.honours === 'object' && d.honours !== null
        ? (d.honours as Record<string, number>)
        : {},
    lastCups: d.lastCups ?? null,
    shield: (d.shield as Dynasty['shield']) ?? null,
    division: d.division === 2 ? 2 : 1,
    league: Array.isArray(d.league) && d.league.length
      ? (d.league as Dynasty['league'])
      : startingLeague(typeof d.club === 'string' ? d.club : ''),
    below: Array.isArray(d.below) && d.below.length
      ? (d.below as Dynasty['below'])
      : CHAMPIONSHIP.map((c) => ({ ...c })),
    parachute: typeof d.parachute === 'number' ? d.parachute : 0,
    offers: Array.isArray(d.offers) ? (d.offers as Dynasty['offers']) : [],
    jobs: Array.isArray(d.jobs) ? (d.jobs as Dynasty['jobs']) : [],
    autoLoan: d.autoLoan === true,
    injuriesOn: d.injuriesOn === true,
    derby:
      typeof d.derby === 'object' && d.derby !== null
        ? (d.derby as Dynasty['derby'])
        : { w: 0, d: 0, l: 0 },
    spells: Array.isArray(d.spells) ? (d.spells as Dynasty['spells']) : [],
    rival: typeof d.rival === 'string' ? d.rival : null,
    tactic: { ...EMPTY_TACTIC, form: formation },
    staff: { ...EMPTY_STAFF },
    infra: { stadium: 0, training: 2, academy: 2, capacity, retail: 1 },
    youth: [],
    retired: Array.isArray(d.retired)
      ? d.retired.map(repairPlayer).filter((p): p is DynastyPlayer => p !== null)
      : [],
    seasons,
    titles: typeof d.titles === 'number' ? d.titles : 0,
    allTime: {},
    records: {
      bestPts: seasons.reduce((m, s) => Math.max(m, s.pts ?? 0), 0),
      bestFin: seasons.reduce((m, s) => Math.min(m, s.fin ?? 20), 20),
      unbeaten: seasons.filter((s) => s.l === 0).length,
    },
    inbox: [],
    psr: [],
    saleProfit: 0,
    psrHit: 0,
    marketRolls: 0,
    ledger: null,
    expired: [],
    renewed: [],
    sold: [],
    injuries: [],
    sacked: false,
  };
}

export const dynastyStore = defineStore<Dynasty | null>({
  key: 'dynasty',
  version: 13,
  fallback: null,
  validate: isDynasty,
  migrations: {
    // Version 1 held a summary of a career the app could not yet play, and
    // version 2 an eleven man squad from before the roster was fourteen.
    // Neither can be turned into the shape that exists now.
    2: () => null,
    3: () => null,
    4: migrateToFour,
    // Five added the looks at the market. A career from before it simply
    // starts the season with all three unused.
    5: (v) => (v ? { ...(v as Dynasty), marketRolls: 0 } : null),
    // Six is the keeper rule. Careers that already have a goalkeeper at
    // centre back are tidied up rather than left broken.
    6: (v) => (v ? tidySquad(v as Dynasty) : null),
    // Seven is the following and the club shop. A career from before them
    // starts with the crowd its ground would hold and a shop at level one.
    /* Thirteen is the summer a player arrived, and who is allowed to bid.
       Every player already in a career reads as having always been there,
       so nobody is frozen out of a sale by it. The bids on the table are
       thrown away rather than kept, because they were made under the old
       rule that let a club rated 30 offer £170m. */
    13: (v) => {
      if (!v) return null;
      const d = v as Dynasty;
      /* And it repairs the league a change of job could break. Taking a
         job used to say you were in the Premier League whatever division
         the offer came from, so a manager hired after a relegation played
         nineteen second tier clubs in a season the game called the top
         flight. A top flight with nobody in it above 78 is that career,
         and it is given a real Premier League back. */
      const best = d.league?.length ? Math.max(...d.league.map((c) => c.str)) : 0;
      const brokenTopFlight = d.division !== 2 && best < 0.7;

      return {
        ...d,
        offers: [],
        jobs: [],
        league: brokenTopFlight ? startingLeague(d.club) : d.league,
        roster: d.roster.map((p) =>
          p ? { ...p, joined: typeof p.joined === 'number' ? p.joined : 0 } : p,
        ),
        youth: (d.youth ?? []).map((p) => ({
          ...p,
          joined: typeof p.joined === 'number' ? p.joined : 0,
        })),
      };
    },
    /* Twelve is the Community Shield played by its real rules. A career
       from before it works its next tie out at the end of this season. */
    12: (v) => (v ? { ...(v as Dynasty), shield: (v as Dynasty).shield ?? null } : null),
    /* Eleven is the injuries switch. Every career that already exists
       had injuries, so it keeps them until it is told otherwise. */
    11: (v) => (v ? { ...(v as Dynasty), injuriesOn: (v as Dynasty).injuriesOn ?? true } : null),
    /* Ten is the people: how they feel, who wants them, who gets booked,
       who goes out on loan, and who wants you. */
    10: (v) => {
      if (!v) return null;
      const d = v as Dynasty;
      const fix = (p: DynastyPlayer | null) =>
        p
          ? {
              ...p,
              morale: typeof p.morale === 'number' ? p.morale : 70,
              cards: p.cards ?? 0,
              reds: p.reds ?? 0,
              banned: p.banned ?? 0,
              loan: p.loan ?? null,
              loans: p.loans ?? [],
            }
          : null;
      return {
        ...d,
        roster: d.roster.map(fix),
        youth: d.youth.map((p) => fix(p) as DynastyPlayer),
        retired: d.retired.map((p) => fix(p) as DynastyPlayer),
        offers: d.offers ?? [],
        jobs: d.jobs ?? [],
        autoLoan: d.autoLoan ?? false,
        injuriesOn: d.injuriesOn ?? true,
        shield: d.shield ?? null,
        derby: d.derby ?? { w: 0, d: 0, l: 0 },
        spells: d.spells ?? [],
      };
    },
    /* Nine is promotion and relegation. A career from before it keeps the
       division it was in, which was always the top one, and starts with
       the real 2026/27 clubs. */
    9: (v) => {
      if (!v) return null;
      const d = v as Dynasty;
      return {
        ...d,
        division: d.division === 2 ? 2 : 1,
        league: d.league?.length ? d.league : startingLeague(d.club),
        below: d.below?.length ? d.below : CHAMPIONSHIP.map((c) => ({ ...c })),
        parachute: d.parachute ?? 0,
      };
    },
    // Eight is the cups: which competition in Europe, and what has been won.
    8: (v) =>
      v
        ? {
            ...(v as Dynasty),
            europe: (v as Dynasty).europe ?? null,
            honours: (v as Dynasty).honours ?? {},
            lastCups: (v as Dynasty).lastCups ?? null,
          }
        : null,
    7: (v) => {
      if (!v) return null;
      const d = v as Dynasty;
      return {
        ...d,
        fans: typeof d.fans === 'number' ? d.fans : startingFans(d.infra.capacity),
        infra: { ...d.infra, retail: typeof d.infra.retail === 'number' ? d.infra.retail : 1 },
      };
    },
  },
});

export function dynastySummary(d: Dynasty | null): DynastySummary | null {
  if (!d) return null;
  const xi = d.roster.slice(0, 11).filter((p): p is DynastyPlayer => p !== null);
  if (!xi.length) return null;
  return {
    club: d.club,
    season: d.year,
    rating: Math.round(xi.reduce((s, p) => s + p.rtg, 0) / xi.length),
    titles: d.titles,
  };
}
