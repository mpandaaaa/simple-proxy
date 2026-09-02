import { mulberry32, type Rng } from './rng';
import type { SeasonResult } from './sim';
import {
  ageOne,
  careerSeed,
  everyone,
  retireOdds,
  squadRating,
  starters,
  wage,
  type Dynasty,
  type DynastyPlayer,
  type InboxItem,
  type Ledger,
} from './dynasty';
import { development, expectedRating, seasonRatings } from './dynastyRatings';
import {
  closeBooks,
  devMultiplier,
  injuryMultiplier,
  nextBudget,
  nextFans,
  revenue,
  trainingMultiplier,
  wageBill,
} from './dynastyClub';
import { learnTactic } from './dynastyTactics';
import {
  autoRenews,
  intakeSize,
  makeYouth,
  renewalTerms,
  seasonInjuries,
} from './dynastySquad';
import { objectiveFor, objectiveLabel, scenarioById, type ScenarioId } from './career';

/**
 * The end of a season, in the one order that works.
 *
 * Ratings before ageing, because development reads them. Injuries before
 * ageing, because a season spent injured is what makes a player decline.
 * Finances before the budget, because the budget is what the books allow.
 * Everything else follows from those three.
 *
 * Pure, and seeded, so a career replays exactly.
 */

export type SummerReport = {
  ledger: Ledger;
  /** points taken off for the books, if any */
  deduction: number;
  met: boolean;
  /** how board confidence moved */
  mgrSwing: number;
  sacked: boolean;
  improved: DynastyPlayer[];
  declined: DynastyPlayer[];
  held: DynastyPlayer[];
  retired: DynastyPlayer[];
  /** deals that ran out and were renewed, and deals that ran out and were not */
  renewed: string[];
  lost: string[];
  injured: { name: string; days: number; injury: string }[];
  intake: DynastyPlayer[];
  released: string[];
  before: number;
  after: number;
  budget: number;
  /** the following before the season, and how far it moved */
  fansBefore: number;
  fansSwing: number;
  news: InboxItem[];
};

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

/**
 * Everything that happens between the last whistle and the first day of
 * pre-season.
 *
 * `result` is the league season the match engine just played with this
 * squad. The dynasty comes back changed, with a report of what changed.
 */
export function processSeasonEnd(
  d: Dynasty,
  result: SeasonResult,
): { dynasty: Dynasty; report: SummerReport } {
  const rnd: Rng = mulberry32(careerSeed(d.seed, d.year + 1000));
  const next: Dynasty = {
    ...d,
    roster: d.roster.map((p) => (p ? { ...p, hist: [...p.hist] } : null)),
    psr: [...d.psr],
    allTime: { ...d.allTime },
    inbox: [...d.inbox],
  };
  const news: InboxItem[] = [];
  const say = (t: string, b: string, k: InboxItem['k']) => {
    news.push({ t, b, k, s: d.year });
  };

  /* 1. the books */
  const ledger = closeBooks(next, result.position);
  next.ledger = ledger;
  next.psrHit = ledger.deduction;
  if (ledger.deduction) {
    say(
      `${ledger.deduction} point deduction`,
      `Three seasons of losses came to £${Math.abs(Math.round(ledger.rolling))}m, past the £105m the league allows. The points come off next season.`,
      'bad',
    );
  }

  /* 2. the board */
  const met = result.position <= d.objective.target;
  const raw = met
    ? d.objective.target === 1
      ? 15
      : 12
    : Math.abs(result.position - d.objective.target) <= 3
      ? -6
      : -14;
  const swing = Math.round((raw - (ledger.deduction ? 10 : 0)) * (met ? d.leash : 1 / d.leash));
  next.mgr = clamp(d.mgr + swing, 0, 99);
  const sacked = next.mgr <= 20;
  next.sacked = sacked;
  say(
    met ? 'The board are pleased' : 'The board are not pleased',
    met
      ? `You were asked to ${d.objective.label.toLowerCase()} and you finished ${result.position}. Confidence is ${next.mgr}.`
      : `You were asked to ${d.objective.label.toLowerCase()} and you finished ${result.position}. Confidence is ${next.mgr}.`,
    met ? 'good' : 'bad',
  );

  /* 3. the history */
  const row = {
    s: d.year,
    fin: result.position,
    pts: result.pts,
    w: result.wins,
    d: result.draws,
    l: result.losses,
    gf: result.gf,
    ga: result.ga,
    met,
    rev: ledger.rev,
    profit: ledger.profit,
    ded: ledger.deduction,
  };
  // The season screen already banked this year the moment the last whistle
  // went, so that closing the app between the final match and the summer
  // could not lose a season. This fills that row in rather than writing a
  // second one for the same year.
  const already = d.seasons.findIndex((x) => x.s === d.year);
  next.seasons =
    already >= 0
      ? d.seasons.map((x, i) => (i === already ? row : x))
      : [...d.seasons, row];
  if (result.position === 1) {
    next.titles = d.titles + 1;
    say('Champions', `${d.club} are champions of England on ${result.pts} points.`, 'good');
  }
  next.records = {
    bestPts: Math.max(d.records.bestPts, result.pts),
    bestFin: Math.min(d.records.bestFin, result.position),
    unbeaten: d.records.unbeaten + (result.losses === 0 ? 1 : 0),
  };

  /* 4. the budget, and who is now following the club */
  next.budget = nextBudget(d, result.position, ledger);
  const fansBefore = d.fans;
  next.fans = nextFans(d, result.position, squadRating(starters(d)));

  /* 5. match ratings, which development is about to read */
  const stats: Record<string, { g: number; a: number }> = {};
  for (const [name, s] of Object.entries(result.playerStats)) {
    stats[name] = { g: s.g, a: s.a };
  }
  seasonRatings(next, result.matches, stats, rnd);

  /* 6. career history */
  for (const p of everyone(next)) {
    p.hist = [
      ...p.hist,
      {
        s: d.year,
        club: d.club,
        apps: p.apps,
        g: p.goals,
        a: p.assists,
        r: p.avgR,
        rtg: p.rtg,
        fin: result.position,
      },
    ];
    const at = next.allTime[p.n] ?? {
      n: p.n,
      pos: p.pos,
      apps: 0,
      g: 0,
      a: 0,
      seasons: 0,
      best: 0,
      rSum: 0,
      rN: 0,
    };
    next.allTime[p.n] = {
      ...at,
      apps: at.apps + p.apps,
      g: at.g + p.goals,
      a: at.a + p.assists,
      seasons: at.seasons + 1,
      best: Math.max(at.best, p.rtg),
      rSum: at.rSum + (p.avgR ?? 0) * (p.avgR == null ? 0 : 1),
      rN: at.rN + (p.avgR == null ? 0 : 1),
    };
  }

  /* 7. injuries */
  const medical = injuryMultiplier(next);
  const injured: { name: string; days: number; injury: string }[] = [];
  for (const p of everyone(next)) {
    const r = seasonInjuries(p, 1, medical, rnd);
    if (r.days >= 30 && p.lastInj) {
      injured.push({ name: p.n, days: r.days, injury: p.lastInj });
    }
  }
  next.injuries = injured.filter((i) => i.days >= 60).map((i) => i.name);
  if (injured.length >= 4) {
    say(
      'An injury crisis',
      `${injured.length} of the squad missed a month or more. ${injured[0].name} was out for ${injured[0].days} days with a ${injured[0].injury.toLowerCase()}.`,
      'bad',
    );
  }

  /* 8. ageing, which is the whole point of a career */
  const before = squadAverage(starters(next));
  const grow = devMultiplier(next) * trainingMultiplier(next);

  const kept: (DynastyPlayer | null)[] = [];
  const gone: DynastyPlayer[] = [];
  const improved: DynastyPlayer[] = [];
  const declined: DynastyPlayer[] = [];
  const held: DynastyPlayer[] = [];

  for (const cur of next.roster) {
    if (!cur) {
      kept.push(null);
      continue;
    }
    const was = cur.rtg;
    const dev = development(cur);
    const aged = ageOne(cur, rnd, dev.minutes * dev.perf * grow);

    /* form beats the calendar. A season far above what a player of his
       quality should produce means he has not declined yet, whatever his
       age says, and a truly historic one still adds. This is what stops a
       sixty goal season reading as a downgrade. */
    aged.why = null;
    if (aged.apps >= 22 && aged.avgR != null) {
      const over = aged.avgR - expectedRating(was);
      if (over >= 1.0 && aged.rtg <= was && was < 99) {
        aged.rtg = Math.min(99, was + 1);
        aged.why = 'A career season. He has not declined, whatever his age says.';
      } else if (over >= 0.55 && aged.rtg < was) {
        aged.rtg = was;
        aged.why = 'Played too well to drop. The decline is cancelled this year.';
      }
    }
    aged.delta = aged.rtg - was;
    if (!aged.why) aged.why = reasonFor(aged, dev);

    aged.contract = {
      yrs: Math.max(0, aged.contract.yrs - 1),
      wage: aged.contract.wage,
    };

    if (rnd() < retireOdds(aged)) {
      gone.push({ ...aged, retired: true });
      kept.push(null);
      continue;
    }
    kept.push(aged);
    if (aged.why.startsWith('A career') || aged.why.startsWith('Played too well')) {
      held.push(aged);
    }
    if (aged.delta > 0) improved.push(aged);
    else if (aged.delta < 0) declined.push(aged);
  }

  next.roster = kept;
  next.retired = [...gone, ...d.retired];
  improved.sort((a, b) => b.delta - a.delta);
  declined.sort((a, b) => a.delta - b.delta);
  for (const p of gone) {
    say(`${p.n} retires`, `${p.n} calls it a day at ${p.age}, rated ${p.rtg}.`, 'news');
  }

  /* 9. contracts */
  const renewed: string[] = [];
  const lost: string[] = [];
  const rev = revenue(result.position, next);
  for (let i = 0; i < next.roster.length; i++) {
    const p = next.roster[i];
    if (!p || p.contract.yrs > 0) continue;
    const terms = renewalTerms(p);
    const projected = wageBill(next) + (terms.wage - p.contract.wage) * 0.052;
    if (autoRenews(p, projected, rev)) {
      p.contract = { yrs: terms.yrs, wage: terms.wage };
      renewed.push(p.n);
    } else {
      lost.push(p.n);
      next.roster[i] = null;
      say(
        `${p.n} leaves on a free`,
        `His contract ran out and the club did not offer new terms. He is gone for nothing.`,
        'bad',
      );
    }
  }
  next.renewed = renewed;
  next.expired = lost;

  /* 10. the academy */
  const intake: DynastyPlayer[] = [];
  const count = intakeSize(next.infra.academy, rnd);
  for (let i = 0; i < count; i++) intake.push(makeYouth(next.infra.academy, d.club, rnd));

  const released: string[] = [];
  const youth: DynastyPlayer[] = [];
  for (const y of next.youth) {
    const aged = ageOne(y, rnd, grow);
    aged.contract = { yrs: Math.max(0, aged.contract.yrs - 1), wage: wage(aged.rtg, aged.age) };
    if (aged.age >= 24) released.push(aged.n);
    else youth.push(aged);
  }
  next.youth = [...youth, ...intake];
  if (intake.length) {
    say(
      'Intake day',
      `${intake.length} came through the academy. ${intake[0].n} is the one they are talking about.`,
      'news',
    );
  }

  /* 11. a new market, and the looks at it come back */
  next.marketRolls = 0;

  /* the tactic is a season better understood */
  next.tactic = learnTactic(next.tactic);

  /* 12. next season */
  next.year = d.year + 1;
  const avg = squadAverage(starters(next));
  const sc = scenarioById(d.scenario as ScenarioId);
  const target = clamp(objectiveFor(avg).target + sc.expect, 1, 20);
  next.objective = { label: objectiveLabel(target), target };
  next.inbox = [...news, ...d.inbox].slice(0, 40);

  return {
    dynasty: next,
    report: {
      ledger,
      deduction: ledger.deduction,
      met,
      mgrSwing: swing,
      sacked,
      improved,
      declined,
      held,
      retired: gone,
      renewed,
      lost,
      injured,
      intake,
      released,
      before,
      after: avg,
      budget: next.budget,
      fansBefore,
      fansSwing: Math.round((next.fans - fansBefore) * 100) / 100,
      news,
    },
  };
}

function squadAverage(squad: readonly DynastyPlayer[]): number {
  if (!squad.length) return 0;
  return Math.round(squad.reduce((s, p) => s + p.rtg, 0) / squad.length);
}

/** Why a rating moved, in the terms a manager would use. */
function reasonFor(p: DynastyPlayer, dev: ReturnType<typeof development>): string {
  if (p.daysOut >= 90) return 'A season lost to injury.';
  if (dev.minutes < 0.6) return 'Not enough football.';
  if (p.delta > 0) {
    if (p.rtg >= p.pot - 1) return 'As good as he is going to get.';
    if (p.age <= 23) return 'Still growing into it.';
    if (dev.over != null && dev.over > 0.3) return 'A strong season, and it shows.';
    return 'Improving.';
  }
  if (p.delta < 0) {
    if (p.age >= 33) return 'The legs are going.';
    if (p.age >= 30) return 'Past his peak now.';
    if (dev.over != null && dev.over < -0.3) return 'A poor season, and it shows.';
    return 'A hard year.';
  }
  return 'Holding steady.';
}
