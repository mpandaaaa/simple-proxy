import { SQUADS } from '../data/squads';
import { CAPACITY, DOB, RIVALS } from '../data/dynasty';
import { FORMATIONS } from './formations';
import { startingFans } from './dynastyClub';
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
