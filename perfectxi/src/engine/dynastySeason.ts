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
import { COMPS, simulateSeasonCups, type CupSeason, type ShieldTie } from './cups';
import { clubRating, endOfSeason, startingChampionship, startingLeague } from './pyramid';
import {
  MORALE_UNHAPPY,
  autoLoanPicks,
  averageWage,
  loanClubFor,
  loanSeason,
  jobOffers,
  moraleAfterSeason,
  offersFor,
  seasonCards,
  type LoanSpell,
} from './dynastyPeople';
import {
  autoRenews,
  intakeSize,
  makeYouth,
  renewalTerms,
  seasonInjuries,
} from './dynastySquad';
import {
  boardTarget,
  clubOptions,
  objectiveClause,
  objectiveFor,
  objectiveLabel,
  scenarioById,
  type ScenarioId,
} from './career';

/**
 * The clubs a career can be started at.
 *
 * Worked out on first use rather than when this module is loaded. It
 * walks the whole database, seven hundred and twelve club-seasons of it,
 * and doing that while modules are still being evaluated makes the app
 * slower to open for no reason and puts a database read inside an import
 * cycle, which is a hard way to find out you have one.
 */
let manageable: ReadonlyMap<string, number> | null = null;
function manageableClubs(): ReadonlyMap<string, number> {
  if (!manageable) {
    manageable = new Map(clubOptions(2026).map((o) => [o.club, o.avg]));
  }
  return manageable;
}

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
  /** every cup the club played, with its money and its trophies */
  cups: CupSeason;
  /** who was suspended, and for how long */
  suspended: { name: string; yellows: number; reds: number; games: number }[];
  /** who came back from a loan, and what it did for them */
  loans: LoanSpell[];
  /** who is unhappy enough to ask for a move */
  unsettled: string[];
  /** what May did to the division */
  relegated: string[];
  promoted: string[];
  youWentDown: boolean;
  youWentUp: boolean;
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

  /* 0. the cups, which are decided by the same squad and the same seed
     and whose prize money the books are about to count. */
  const cups = simulateSeasonCups({
    myAvg: squadRating(starters(d)),
    leaguePosition: result.position,
    europe: d.europe,
    shield: d.shield,
    runSeed: (d.seed ^ Math.imul(d.year, 0x2545f491)) >>> 0,
    club: d.club,
  });
  next.europe = cups.europeNext;
  next.lastCups = cups;
  next.shield = nextShield(d, result, cups, rnd);
  next.honours = { ...d.honours };
  for (const t of cups.trophies) {
    next.honours[t] = (next.honours[t] ?? 0) + 1;
    say(
      `${COMPS[t].name} winners`,
      `${d.club} lifted the ${COMPS[t].name}.`,
      'good',
    );
  }
  if (cups.europeNext !== d.europe) {
    say(
      cups.europeNext ? `Into the ${COMPS[cups.europeNext].name}` : 'Out of Europe',
      cups.europeNext
        ? `${ordinalOf(result.position)} and the cups put you in the ${COMPS[cups.europeNext].name} next season.`
        : `${ordinalOf(result.position)} was not enough for Europe. There is no European football at the club next season.`,
      cups.europeNext ? 'good' : 'bad',
    );
  }

  /* 1. the books */
  const ledger = closeBooks(next, result.position, cups.money);
  next.ledger = ledger;
  next.psrHit = ledger.deduction;
  if (ledger.deduction) {
    say(
      `${ledger.deduction} point deduction`,
      `Three seasons of losses came to £${Math.abs(Math.round(ledger.rolling))}m, past the £105m the league allows. The points come off next season.`,
      'bad',
    );
  }

  /* 1b. the derby.
     It was a word in the fixture list. Beating them is worth more to the
     board and to the crowd than beating anybody else, and losing to them
     costs more, because that is what a derby is. */
  const derbies = d.rival ? result.matches.filter((m) => m.opp === d.rival) : [];
  const derbyW = derbies.filter((m) => m.oc === 'win').length;
  const derbyD = derbies.filter((m) => m.oc === 'draw').length;
  const derbyL = derbies.filter((m) => m.oc === 'loss').length;
  next.derby = {
    w: d.derby.w + derbyW,
    d: d.derby.d + derbyD,
    l: d.derby.l + derbyL,
  };
  const derbySwing = derbyW * 4 - derbyL * 5;
  if (derbies.length && (derbyW === 2 || derbyL === 2)) {
    say(
      derbyW === 2 ? `The double over ${d.rival}` : `${d.rival} did the double`,
      derbyW === 2
        ? `Both of them, and the city knows about it.`
        : `Beaten home and away by ${d.rival}. Nobody forgets that one.`,
      derbyW === 2 ? 'good' : 'bad',
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
  const swing =
    Math.round((raw - (ledger.deduction ? 10 : 0)) * (met ? d.leash : 1 / d.leash)) + derbySwing;
  next.mgr = clamp(d.mgr + swing, 0, 99);
  const sacked = next.mgr <= 20;
  next.sacked = sacked;
  say(
    met ? 'The board are pleased' : 'The board are not pleased',
    `You were asked to ${objectiveClause(d.objective.target, d.division)} and you finished ${ordinalOf(
      result.position,
    )}. Confidence is ${next.mgr}.`,
    met ? 'good' : 'bad',
  );

  /* 3. the history */
  const row = {
    s: d.year,
    club: d.club,
    div: d.division,
    won: cups.trophies.slice(),
    runs: cups.runs
      .filter((r) => r.entered)
      .map((r) => ({ id: r.id, fate: r.won ? 'Winners' : (r.elim ?? '') })),
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
  // A derby is worth a few thousand on the gate either way.
  if (derbies.length) {
    next.fans = Math.round(Math.max(0.4, next.fans + derbyW * 0.05 - derbyL * 0.05) * 100) / 100;
  }

  /* 5a. injuries, before anything reads how many games a man played.

     This used to run two steps later, which meant the season's ratings and
     the season's goals were shared out using last season's availability
     and then this season's injuries overwrote the appearances. That is how
     a player with thirteen appearances finished with forty six goals. */
  const medical = injuryMultiplier(next);
  const injured: { name: string; days: number; injury: string }[] = [];
  for (const p of everyone(next)) {
    if (!d.injuriesOn) {
      p.daysOut = 0;
      p.lastInj = null;
      p.apps = 38;
      continue;
    }
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

  /* 5b. bookings, and the games they cost.
     Five yellows inside the first nineteen and he misses one, whoever he
     is and whatever the fixture is. It comes off his appearances, which
     is what development reads. */
  const suspended: { name: string; yellows: number; reds: number; games: number }[] = [];
  for (const p of everyone(next)) {
    const fit = Math.max(0, 38 - Math.round((p.daysOut ?? 0) / 9));
    const disc = seasonCards(p, fit, rnd);
    p.cards = disc.yellows;
    p.reds = disc.reds;
    p.banned = disc.banned;
    if (disc.banned > 0) {
      suspended.push({ name: p.n, yellows: disc.yellows, reds: disc.reds, games: disc.banned });
    }
  }
  const worstBan = [...suspended].sort((a, b) => b.games - a.games)[0];
  if (worstBan && worstBan.games >= 3) {
    say(
      `${worstBan.name} suspended`,
      worstBan.reds
        ? `A red card and ${worstBan.games} games out of the side.`
        : `${worstBan.yellows} bookings across the season and ${worstBan.games} games missed for them.`,
      'bad',
    );
  }

  /* 5c. match ratings, which development is about to read.

     The engine plays the season before it knows who was fit, so the goals
     it hands out assume everybody played every game. They are shared out
     again here against the appearances each man actually made, keeping the
     team's totals exactly as the season produced them. */
  shareByAppearances(next, result);
  const stats: Record<string, { g: number; a: number }> = {};
  for (const [name, s] of Object.entries(result.playerStats)) {
    stats[name] = { g: s.g, a: s.a };
  }
  seasonRatings(next, result.matches, stats, rnd);
  // A suspension is games missed, and it comes off after the ratings are in.
  for (const p of everyone(next)) {
    if (p.banned > 0) p.apps = Math.max(0, (p.apps ?? 0) - p.banned);
  }

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
    /* One group each. A player who played too well to decline and also
       gained a point belongs in the group that says he improved, not in
       both, and seeing the same name twice on one page reads as a bug
       because it is one. */
    if (aged.delta > 0) improved.push(aged);
    else if (aged.delta < 0) declined.push(aged);
    else if (aged.why.startsWith('A career') || aged.why.startsWith('Played too well')) {
      held.push(aged);
    }
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
  // Nobody at the club, in the academy or in this intake shares a name.
  const taken = new Set<string>([
    ...everyone(next).map((p) => p.n),
    ...next.youth.map((p) => p.n),
  ]);
  for (let i = 0; i < count; i++) {
    const kid = makeYouth(next.infra.academy, d.club, rnd, taken);
    taken.add(kid.n);
    intake.push(kid);
  }

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

  /* 10b. loans, academy only.
     A season of thirty five games in the Championship is worth two or
     three rating points that a year in the under twenty ones is not. */
  const loansBack: LoanSpell[] = [];
  for (const y of next.youth) {
    if (!y.loan) continue;
    const spell = loanSeason(y, { n: y.loan, level: y.rtg >= 62 ? 2 : 3 }, rnd);
    const was = y.rtg;
    /* The ceiling can move first, because a season of men's football is
       allowed to prove a scout wrong, and a loan can never make a player
       worse than the day he left. */
    y.pot = Math.min(97, y.pot + spell.lift);
    y.rtg = Math.max(y.rtg, Math.min(y.pot, Math.round(y.rtg + spell.gained)));
    y.apps = spell.apps;
    y.loans = [
      ...(y.loans ?? []),
      { s: d.year, club: y.loan, apps: spell.apps, gained: y.rtg - was, to: y.rtg },
    ];
    y.loan = null;
    loansBack.push({ ...spell, gained: y.rtg - was });
  }
  if (loansBack.length) {
    const best = [...loansBack].sort((a, b) => b.gained - a.gained)[0];
    say(
      `${loansBack.length} back from loan`,
      `${best.name} played ${best.apps} games at ${best.club} and came back ${best.gained} better.`,
      'good',
    );
  }
  if (next.autoLoan) {
    for (const i of autoLoanPicks(next)) {
      const y = next.youth[i];
      if (y) y.loan = loanClubFor(y.rtg, rnd).n;
    }
  }

  /* 10c. how everybody feels about it, and who has been asked about. */
  const squadWage = averageWage(next);
  const trophyCount = cups.trophies.length + (result.position === 1 ? 1 : 0);
  for (const p of everyone(next)) {
    p.morale = moraleAfterSeason(next, p, {
      finish: result.position,
      trophies: trophyCount,
      squadWage,
    }, rnd);
  }
  next.offers = offersFor(next, next.league, rnd);
  const unsettled = everyone(next).filter((p) => p.morale < MORALE_UNHAPPY);
  if (unsettled.length) {
    say(
      unsettled.length === 1 ? `${unsettled[0].n} wants to leave` : `${unsettled.length} want to leave`,
      unsettled.length === 1
        ? `${unsettled[0].n} is unhappy enough to ask for a move.`
        : `${unsettled.map((p) => p.n).slice(0, 3).join(', ')} are unhappy enough to ask for a move.`,
      'bad',
    );
  }
  if (next.offers.length) {
    const top = next.offers[0];
    say(
      `${top.club} want ${top.name}`,
      `£${top.fee}m on the table for a player worth £${top.worth}m. It is in the transfer screen until you answer it.`,
      'news',
    );
  }

  /* 11b. promotion and relegation, which is what makes a twentieth
     season a different league from a fifth. */
  const pyramid = endOfSeason({
    division: d.division,
    league: d.league,
    table: result.table,
    club: d.club,
    below: d.below,
    rnd,
  });
  next.below = pyramid.below;
  next.league = pyramid.league;

  if (pyramid.youWentDown) {
    next.division = 2;
    next.league = startingChampionship(d.club);
    next.europe = null;
    next.parachute = 3;
    /* Nearly every Premier League contract carries a relegation clause,
       usually between forty and fifty percent. Without it a club goes
       down carrying a £150m wage bill into a division that pays £8m of
       central money, and the books never recover. */
    const cut = (c: { yrs: number; wage: number; full?: number }) => ({
      ...c,
      full: c.full ?? c.wage,
      wage: Math.max(3, Math.round(c.wage * 0.55)),
    });
    for (const p of next.roster) if (p) p.contract = cut(p.contract);
    for (const p of next.youth) p.contract = cut(p.contract);
    say(
      'Relegated',
      `${d.club} finished ${ordinalOf(result.position)} and are down. The Championship next season, and the money that goes with it.`,
      'bad',
    );
  } else if (pyramid.youWentUp) {
    next.division = 1;
    next.league = startingLeague(d.club);
    next.parachute = 0;
    /* The clause runs the other way when you go back up, but only for the
       men who took the cut. Anybody signed while you were down never had
       one and does not get a rise for being promoted. */
    const restore = (c: { yrs: number; wage: number; full?: number }) =>
      c.full ? { yrs: c.yrs, wage: c.full } : { yrs: c.yrs, wage: c.wage };
    for (const p of next.roster) if (p) p.contract = restore(p.contract);
    for (const p of next.youth) p.contract = restore(p.contract);
    say(
      'Promoted',
      `${d.club} are back in the Premier League.`,
      'good',
    );
  } else if (pyramid.promoted.length) {
    say(
      'Up and down',
      `${pyramid.relegated.filter((n) => n !== d.club).join(', ')} went down. ${pyramid.promoted.join(', ')} came up.`,
      'news',
    );
  }

  /* 12. next season */
  next.year = d.year + 1;
  const avg = squadAverage(starters(next));
  const sc = scenarioById(d.scenario as ScenarioId);
  /* In the Championship the board wants one thing and it is not a top
     half finish. Everywhere else the objective comes off the squad. */
  if (next.division === 2) {
    next.objective = { label: 'Win promotion', target: 2 };
  } else {
    const target = boardTarget(next, avg, sc.expect);
    next.objective = { label: objectiveLabel(target), target };
  }
  // A year of the parachute is a year gone.
  if (next.division === 2 && !pyramid.youWentDown) {
    next.parachute = Math.max(0, (d.parachute ?? 0) - 1);
  }
  /* And who wants you.
     A manager who has just been relegated is approached by nobody. One
     who has been sacked is approached by somebody, because somebody
     always needs one, and it is always a rung down. */
  next.jobs = pyramid.youWentDown
    ? []
    : jobOffers(next, next.league, rnd, sacked, manageableClubs(), next.division);
  for (const j of next.jobs) {
    say(
      `${j.club} want to speak to you`,
      `${j.note}. They would want you to ${j.objective.toLowerCase()}, with £${j.budget}m to spend. The offer is on the club screen until you answer it.`,
      'news',
    );
  }

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
      cups,
      suspended,
      loans: loansBack,
      unsettled: unsettled.map((p) => p.n),
      relegated: pyramid.relegated.filter((n) => n !== d.club),
      promoted: pyramid.promoted,
      youWentDown: pyramid.youWentDown,
      youWentUp: pyramid.youWentUp,
      news,
    },
  };
}


/**
 * Share the season's goals out again, by who was actually there.
 *
 * The match engine plays all thirty eight before anybody knows who was
 * injured, so its scorers assume a fully fit squad all year. Once the
 * injuries are in, the same total is redistributed by how many games each
 * man played and how likely his position is to score, which keeps the
 * team's goals for exactly as the season produced them while making the
 * individual numbers ones a footballer could have.
 *
 * Largest remainder, so nothing is lost or invented in the rounding.
 */
function shareByAppearances(d: Dynasty, result: SeasonResult): void {
  const squad = everyone(d).filter((p) => result.playerStats[p.n]);
  if (!squad.length) return;

  const played = (p: DynastyPlayer) =>
    Math.max(0, 38 - Math.min(38, Math.round((p.daysOut ?? 0) / 9)));

  const totals = { g: 0, a: 0 };
  for (const p of squad) {
    totals.g += result.playerStats[p.n].g;
    totals.a += result.playerStats[p.n].a;
  }

  const share = (key: 'g' | 'a') => {
    const weights = squad.map((p) => {
      /* His own share of the season's goals is the best guess at what kind
         of scorer he is, and games are the rest of it. */
      const own = result.playerStats[p.n][key];
      return Math.max(0, own) * (played(p) / 38);
    });
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum <= 0) return;

    const want = totals[key];
    const exact = weights.map((w) => (w / sum) * want);
    const base = exact.map((v) => Math.floor(v));
    let left = want - base.reduce((a, b) => a + b, 0);
    const order = exact
      .map((v, i) => ({ i, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac);
    for (const o of order) {
      if (left <= 0) break;
      base[o.i]++;
      left--;
    }
    squad.forEach((p, i) => {
      result.playerStats[p.n][key] = base[i];
    });
  };

  share('g');
  share('a');

  /* Clean sheets are a defender being on the pitch when nothing went in,
     so they scale with games played too. */
  for (const p of squad) {
    const st = result.playerStats[p.n];
    if (!st.cs) continue;
    st.cs = Math.round(st.cs * (played(p) / 38));
  }
}

/**
 * Who plays in next season's Community Shield.
 *
 * The champions against the FA Cup holders. A club that has won both plays
 * the league runners up instead, which is the one part of it people forget
 * and the game had wrong.
 *
 * When somebody else won the FA Cup it has to be somebody, and no cups are
 * simulated for the other nineteen clubs, so the holders are drawn from the
 * top half of the table with the champions excluded. That is where FA Cup
 * winners come from.
 */
function nextShield(
  d: Dynasty,
  result: SeasonResult,
  cups: CupSeason,
  rnd: Rng,
): ShieldTie | null {
  const table = result.table;
  if (table.length < 2) return null;

  const nameOf = (row: { name: string; isYou: boolean }) => (row.isYou ? d.club : row.name);
  const champion = nameOf(table[0]);
  const runnerUp = nameOf(table[1]);

  const iAmChampion = result.position === 1;
  const iWonTheCup = cups.trophies.includes('fa');
  if (!iAmChampion && !iWonTheCup) return null;

  const ratingOf = (name: string): number => {
    const club = d.league.find((c) => c.name === name);
    return club ? clubRating(club.str) : 80;
  };

  // The double: you play whoever finished second.
  if (iAmChampion && iWonTheCup) {
    return { club: runnerUp, rating: ratingOf(runnerUp), as: 'champions', they: 'runners-up' };
  }

  if (iAmChampion) {
    /* Somebody else has the cup. Drawn from the top half, because that is
       who wins FA Cups, and never the champions themselves because that
       case is the one above. */
    const field = table
      .filter((r) => !r.isYou && r.name !== champion)
      .slice(0, 10)
      .map((r) => r.name);
    const holder = field.length ? field[Math.floor(rnd() * field.length)] : runnerUp;
    return { club: holder, rating: ratingOf(holder), as: 'champions', they: 'holders' };
  }

  // You have the cup, so you play the champions.
  return { club: champion, rating: ratingOf(champion), as: 'holders', they: 'champions' };
}

function ordinalOf(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
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
