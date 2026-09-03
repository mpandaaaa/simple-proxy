import { SQUADS } from '../data/squads';
import { CAPACITY, DOB, RIVALS } from '../data/dynasty';
import { FORMATIONS } from './formations';
import { startingFans } from './dynastyClub';
import { startingLeague } from './pyramid';
import { CHAMPIONSHIP } from './sim';
import { mulberry32 } from './rng';
import type { Position } from './types';
import {
  ageIn,
  careerSeed,
  seedTracks,
  wage,
  EMPTY_STAFF,
  EMPTY_TACTIC,
  type Dynasty,
  type DynastyPlayer,
} from './dynasty';

/**
 * Starting a Dynasty.
 *
 * You inherit a real club and its real squad rather than carrying a
 * drafted XI forward. The scenario decides which clubs you are allowed,
 * how much you have to spend and how much the board will put up with.
 *
 * All of it ported from the web build's own career start. Pure.
 */

export type ScenarioId = 'giant' | 'elite' | 'rebuild' | 'minnow' | 'champs';

export type Scenario = {
  id: ScenarioId;
  title: string;
  desc: string;
  /** the club strength ranks this scenario lets you manage */
  tier: [number, number];
  /** what the starting budget is multiplied by */
  budget: number;
  /** places added to the objective. Negative is harder. */
  expect: number;
  /** how much patience the board has */
  leash: number;
};

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'giant',
    title: 'Sleeping Giant',
    desc: 'A big club underachieving badly. Huge budget, huge pressure, no patience.',
    tier: [1, 6],
    budget: 1.35,
    expect: -2,
    leash: 0.7,
  },
  {
    id: 'elite',
    title: 'Establish the Elite',
    desc: 'A solid mid-table side. Break into Europe and stay there.',
    tier: [5, 12],
    budget: 1.0,
    expect: 0,
    leash: 1.0,
  },
  {
    id: 'rebuild',
    title: 'The Rebuild',
    desc: 'A club in trouble with almost nothing to spend. Survive, then build.',
    tier: [13, 20],
    budget: 0.35,
    expect: 3,
    leash: 1.4,
  },
  {
    id: 'minnow',
    title: 'The Long Haul',
    desc: 'The smallest squad in the division. Nobody expects a thing.',
    tier: [15, 20],
    budget: 0.5,
    expect: 5,
    leash: 1.8,
  },
  {
    id: 'champs',
    title: 'Defend the Throne',
    desc: 'You inherit the champions. Anything but first is a failure.',
    tier: [1, 2],
    budget: 1.15,
    expect: -1,
    leash: 0.55,
  },
];

export function scenarioById(id: ScenarioId): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[1];
}

export type ClubOption = {
  club: string;
  key: string;
  year: number;
  /** the average of the sixteen best players, to one decimal */
  avg: number;
  rank: number;
  squadSize: number;
  capacity: number;
  rival: string | null;
};

/**
 * Every club you could manage, ranked by how good its squad actually is.
 *
 * The sixteen best by prime rating, averaged. Sixteen rather than eleven
 * because a squad is what you inherit, and rather than the whole list
 * because that would punish a club for having depth.
 */
export function clubOptions(year = 2026): ClubOption[] {
  const out: ClubOption[] = [];
  for (const key of Object.keys(SQUADS)) {
    const bar = key.lastIndexOf('|');
    if (Number(key.slice(bar + 1)) !== year) continue;
    const arr = SQUADS[key];
    if (!arr || arr.length < 11) continue;
    const top = arr
      .map((p) => p.prime || p.rtg)
      .sort((a, b) => b - a)
      .slice(0, 16);
    const club = key.slice(0, bar);
    out.push({
      club,
      key,
      year,
      avg: Math.round((top.reduce((a, b) => a + b, 0) / top.length) * 10) / 10,
      rank: 0,
      squadSize: arr.length,
      capacity: CAPACITY[club] ?? 28000,
      rival: RIVALS[club] ?? null,
    });
  }
  out.sort((a, b) => b.avg - a.avg);
  out.forEach((c, i) => {
    c.rank = i + 1;
  });
  return out;
}

export function clubsForScenario(sc: Scenario, year = 2026): ClubOption[] {
  const all = clubOptions(year);
  const picked = all.filter((c) => c.rank >= sc.tier[0] && c.rank <= sc.tier[1]);
  return picked.length ? picked : all;
}

/** What the board asks of a squad of this quality. */
export function objectiveFor(avg: number): { label: string; target: number } {
  if (avg >= 90) return { label: 'Win the Premier League', target: 1 };
  if (avg >= 87) return { label: 'Finish in the top two', target: 2 };
  if (avg >= 84) return { label: 'Champions League, top four', target: 4 };
  if (avg >= 80) return { label: 'European places, top seven', target: 7 };
  if (avg >= 76) return { label: 'Top half finish', target: 10 };
  return { label: 'Avoid the relegation fight', target: 17 };
}

/**
 * The words for a target.
 *
 * Always derived from the final target, never from the unadjusted one. A
 * scenario shifts the number, and a board that says "top four" while
 * demanding ninth is the sort of thing that makes a game feel broken.
 */
export function objectiveLabel(target: number): string {
  if (target <= 1) return 'Win the Premier League';
  if (target <= 2) return 'Finish in the top two';
  if (target <= 4) return 'Champions League, top four';
  if (target <= 7) return 'European places, top seven';
  if (target <= 10) return 'Top half finish';
  if (target <= 14) return 'Comfortable mid-table';
  return 'Avoid the relegation fight';
}

/**
 * The same objective, as a clause that reads inside a sentence.
 *
 * "You were asked to win the Premier League", not "to win the premier
 * league". Lower casing the label whole was doing that to every proper
 * noun in it, so the clause is written out rather than mangled.
 */
export function objectiveClause(target: number, division: 1 | 2 = 1): string {
  if (division === 2) return 'win promotion';
  if (target <= 1) return 'win the Premier League';
  if (target <= 2) return 'finish in the top two';
  if (target <= 4) return 'finish in the Champions League places';
  if (target <= 7) return 'finish in the European places';
  if (target <= 10) return 'finish in the top half';
  if (target <= 14) return 'finish comfortably in mid-table';
  return 'stay out of the relegation fight';
}

/** What a finish is worth in transfer money next summer, in £m. */
export function budgetFor(finish: number): number {
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

/**
 * How old a player was in his best season.
 *
 * A player shown at his peak rating has to be shown at the age he actually
 * was then. Schmeichel is 34 for the treble, Henry 25 for 2003/04. Using
 * one age for every era turns a squad of legends into a squad of twenty
 * year olds.
 */
export function primeAge(name: string): number | null {
  const dob = DOB[name];
  if (!dob) return null;
  return Math.max(18, Math.min(37, dob[2] - dob[0] - dob[1]));
}

export type Mode = 'simple' | 'immersive';

/**
 * Inherit a real club and its real squad.
 *
 * Every slot in the formation, then three substitutes, filled with the
 * best unused player at that position from that club's own squad, at his
 * prime rating and the age he was when he reached it. A slot with nobody
 * to fill it stays empty rather than being given a stranger.
 */
export function startCareer(args: {
  clubKey: string;
  scenario: ScenarioId;
  mode: Mode;
  formation: string;
  seed: number;
}): Dynasty {
  const { clubKey, scenario, mode, formation, seed } = args;
  const sc = scenarioById(scenario);
  const rnd = mulberry32(careerSeed(seed, 0));
  const arr = SQUADS[clubKey] ?? [];
  const bar = clubKey.lastIndexOf('|');
  const club = clubKey.slice(0, bar);
  const year = Number(clubKey.slice(bar + 1));

  const shape = FORMATIONS[formation] ?? FORMATIONS['4-3-3'];
  const slots: Position[] = [];
  for (const row of shape.rows) for (const p of row) slots.push(p);
  // Three substitutes, one of each outfield line.
  slots.push('DEF', 'MID', 'ATT');

  const used = new Set<number>();
  const roster: (DynastyPlayer | null)[] = [];

  for (const pos of slots) {
    let best = -1;
    let bestRtg = -1;
    for (let i = 0; i < arr.length; i++) {
      if (used.has(i)) continue;
      const p = arr[i];
      if (!p.pos || p.pos.indexOf(pos) < 0) continue;
      const v = p.prime || p.rtg;
      if (v > bestRtg) {
        best = i;
        bestRtg = v;
      }
    }
    if (best < 0) {
      roster.push(null);
      continue;
    }
    used.add(best);
    const p = arr[best];
    const rtg = p.prime || p.rtg;
    const age = primeAge(p.n) ?? ageIn(p.n, year, pos);
    roster.push(
      seedTracks(
        {
          n: p.n,
          nat: p.nat ?? '',
          pos,
          club,
          season: `${year}/${String(year + 1).slice(2)}`,
          rtg,
          age,
          contract: { yrs: 2 + Math.floor(rnd() * 4), wage: wage(rtg, age) },
        },
        rnd,
      ),
    );
  }

  const filled = roster.filter((p): p is DynastyPlayer => p !== null);
  const avg = filled.length ? filled.reduce((s, p) => s + p.rtg, 0) / filled.length : 0;
  const target = Math.max(1, Math.min(20, objectiveFor(avg).target + sc.expect));

  return {
    seed,
    club,
    year: 1,
    formation,
    mode,
    scenario,
    roster,
    slots,
    retired: [],
    seasons: [],
    titles: 0,
    mgr: 55,
    budget: Math.round(budgetFor(target) * sc.budget),
    leash: sc.leash,
    objective: { label: objectiveLabel(target), target },
    capacity: CAPACITY[club] ?? 28000,
    fans: startingFans(CAPACITY[club] ?? 28000),
    /* Where the club was last season, before you took it. A giant is in
       the Champions League on the day you walk in; a minnow is in
       nothing. */
    europe: target <= 4 ? 'ucl' : target <= 6 ? 'uel' : target <= 8 ? 'uecl' : null,
    honours: {},
    division: 1,
    league: startingLeague(club),
    below: CHAMPIONSHIP.map((c) => ({ ...c })),
    parachute: 0,
    offers: [],
    jobs: [],
    autoLoan: false,
    /* Off to begin with. A manager who wants them can turn them on from
       the club screen. */
    injuriesOn: false,
    derby: { w: 0, d: 0, l: 0 },
    spells: [],
    lastCups: null,
    /* You have not won anything yet, so there is no Shield to play in. */
    shield: null,
    rival: RIVALS[club] ?? null,
    tactic: { ...EMPTY_TACTIC, form: formation },
    staff: { ...EMPTY_STAFF },
    infra: {
      stadium: 0,
      training: 2,
      academy: 2,
      capacity: CAPACITY[club] ?? 28000,
      retail: 1,
    },
    youth: [],
    allTime: {},
    records: { bestPts: 0, bestFin: 20, unbeaten: 0 },
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

/**
 * Take the job.
 *
 * A career belongs to the manager, so what you won stays with you: the
 * trophies, the seasons you have been at it, the clubs you have been at.
 * Everything that belongs to the club is left behind, because it does:
 * their squad, their money, their stadium, their following, their books.
 *
 * The seed moves with you so the new club is not a replay of somebody
 * else's season, and the objective is the one they set out in the offer.
 */
function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function takeJob(
  d: Dynasty,
  offer: { club: string; objective: string; budget: number },
): Dynasty | null {
  const option = clubOptions(2026).find((o) => o.club === offer.club);
  if (!option) return null;

  const fresh = startCareer({
    clubKey: option.key,
    scenario: d.scenario as ScenarioId,
    mode: d.mode,
    formation: d.tactic.form,
    seed: (d.seed ^ Math.imul(d.year + 1, 0x27d4eb2d)) >>> 0,
  });

  // What this manager did at the club he is leaving.
  const spell = {
    club: d.club,
    from: d.spells.reduce((a, s) => a + s.seasons, 1),
    to: d.spells.reduce((a, s) => a + s.seasons, 0) + d.seasons.length,
    seasons: d.seasons.length,
    titles: d.titles,
    cups: Object.values(d.honours ?? {}).reduce((a, n) => a + (n as number), 0),
    best: d.seasons.length ? Math.min(...d.seasons.map((s) => s.fin)) : 20,
  };

  const target = clamp(objectiveFor(option.avg).target, 1, 20);

  return {
    ...fresh,
    /* The manager's record, which is his and not the club's. */
    spells: [...d.spells, spell],
    honours: { ...(d.honours ?? {}) },
    titles: d.titles,
    year: d.year,
    /* A new board that has just hired you starts you well thought of. */
    mgr: 62,
    objective: { label: objectiveLabel(target), target },
    budget: offer.budget,
  };
}

/**
 * How big a club is, on a scale of nought to a hundred.
 *
 * Not how good this year's team is. How big the club is: how many people
 * follow it, what it has won under you, how many it holds, and the best
 * it has managed lately. Those are the things a boardroom actually
 * measures itself by, and they are why Arsenal and Luton are not asked
 * the same question even in a season where their squads are level.
 *
 * It moves. A club that wins things gains supporters, and a club that
 * keeps finishing fourth is expected to finish fourth, so a side climbing
 * out of nothing is asked for more every year without anybody rewriting
 * the rule.
 */
export function stature(d: Dynasty): number {
  // The following is the loudest signal, because it is the one that grows.
  const support = Math.min(46, ((d.fans ?? 2.5) / 12) * 46);
  // What has been won here.
  const cups = Object.values(d.honours ?? {}).reduce((a, n) => a + (n as number), 0);
  const silverware = Math.min(24, d.titles * 6 + cups * 2);
  // The size of the place.
  const ground = Math.min(14, ((d.infra?.capacity ?? 30000) / 62000) * 14);
  // And what the club has actually been doing.
  const recent = d.seasons.slice(-5);
  const form = recent.length
    ? Math.min(16, (recent.reduce((a, s) => a + Math.max(0, 21 - s.fin), 0) / recent.length) * 0.9)
    : 6;
  return Math.round(Math.max(0, Math.min(100, support + silverware + ground + form)));
}

/**
 * The worst finish a club of this size will accept.
 *
 * A hard floor rather than an average, because that is what it is. Arsenal
 * do not ask their manager to avoid relegation whatever the squad looks
 * like, and no amount of a bad season makes them.
 */
export function statureFloor(s: number): number {
  if (s >= 90) return 4;
  if (s >= 80) return 6;
  if (s >= 70) return 9;
  if (s >= 58) return 12;
  if (s >= 46) return 15;
  return 18;
}

/**
 * What the board will ask for next season.
 *
 * Three things, in the order a boardroom weighs them. What you have been
 * delivering, because last season is the number everybody in the building
 * remembers. What the squad is actually worth, because they are not
 * completely unreasonable. And the size of the club, which sets a floor
 * neither of the other two can push through.
 *
 * The floor is what was missing. The target used to come from the squad
 * rating alone, so Arsenal with seven titles, twelve million supporters
 * and a squad that had been allowed to slide were asked to avoid
 * relegation, and were then pleased with ninth.
 */
export function boardTarget(d: Dynasty, avg: number, expect: number): number {
  const fromSquad = objectiveFor(avg).target + expect;

  /* What you have been doing lately, and they always want a little more
     of it. Three seasons, because one is luck and five is history. */
  const recent = d.seasons.slice(-3);
  const fromForm = recent.length
    ? Math.round(recent.reduce((a, s) => a + s.fin, 0) / recent.length) - 1
    : fromSquad;

  const blended = Math.round(fromSquad * 0.45 + fromForm * 0.55);
  const floor = statureFloor(stature(d));
  return Math.max(1, Math.min(20, Math.min(blended, floor)));
}
