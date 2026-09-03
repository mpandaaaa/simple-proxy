import { defaultConfig, type DraftConfig } from './types';
import { DAILY_EPOCH } from './daily';

/**
 * The Weekly Event.
 *
 * A rotating rule twist, the same one for everybody, running Monday to
 * Monday. Where the Daily is one attempt at one board, this is one rule
 * for seven days and as many attempts as you like: the Daily is the
 * crossword and this is the practice net.
 *
 * That difference is the whole reason both exist. A player who has used
 * their attempt at today's puzzle still has something to open the app
 * for, and a rule they have a week to work out rewards a different kind
 * of thinking from a board they see once.
 *
 * Five twists, named as the site names them, rotating in order so it is
 * always knowable what next week is. Each one is a real constraint rather
 * than a label: a different era, a different shape, or a rule about who
 * is allowed on the board at all.
 */

const WEEK = 7 * 86400000;

/**
 * Which week a moment belongs to.
 *
 * Counted from the same epoch as the Daily, so week one contains puzzle
 * one, and on the same UTC boundary for the same reason.
 */
export function weekNumber(now: number = Date.now()): number {
  return Math.floor((now - DAILY_EPOCH) / WEEK) + 1;
}

export function nextWeekAt(now: number = Date.now()): number {
  return DAILY_EPOCH + weekNumber(now) * WEEK;
}

/** How long is left of this week, in whole seconds. */
export function untilNextWeek(now: number = Date.now()): number {
  return Math.max(0, Math.round((nextWeekAt(now) - now) / 1000));
}

export type Twist = {
  id: string;
  name: string;
  /** the rule, in one sentence */
  rule: string;
  /** why it is a different game, in one more */
  note: string;
  /** what it does to a draft */
  apply: (base: DraftConfig) => DraftConfig;
};

export const TWISTS: readonly Twist[] = [
  {
    id: 'nineties',
    name: 'Nineties Week',
    rule: 'Only 1992 to 1999.',
    note: 'Cantona, Shearer and Bergkamp, and nobody who came after them.',
    apply: (c) => ({ ...c, eraFrom: 1992, eraTo: 1999 }),
  },
  {
    id: 'y2k',
    name: 'Y2K Week',
    rule: 'Only 2000 to 2009.',
    note: 'The Invincibles, the Treble chasers and the last of the four four two.',
    apply: (c) => ({ ...c, eraFrom: 2000, eraTo: 2009 }),
  },
  {
    id: 'moneyball',
    name: 'Moneyball',
    rule: 'No ratings, and only the top three of every board.',
    note: 'You are picking on the name and the club, with no time to think about it.',
    apply: (c) => ({ ...c, showRatings: false, blitz: true, eraFrom: 1992, eraTo: 2026 }),
  },
  {
    id: 'modern',
    name: 'Modern Era',
    rule: 'Only 2015 to 2026, in a 4-2-4.',
    note: 'The best players in the world in the most attacking shape there is.',
    apply: (c) => ({ ...c, eraFrom: 2015, eraTo: 2026, formation: '4-2-4' }),
  },
  {
    id: 'homegrown',
    name: 'Homegrown',
    rule: 'English players only.',
    note: 'Thirty five seasons of the Premier League and only the ones who came through it.',
    apply: (c) => ({ ...c, nation: 'England', eraFrom: 1992, eraTo: 2026 }),
  },
];

export type Weekly = {
  /** the week number, which is what people compare */
  n: number;
  twist: Twist;
  config: DraftConfig;
};

/**
 * A week's event.
 *
 * The twist rotates in order rather than at random, so somebody who has
 * played four of them knows what the fifth is and can look forward to it.
 * The board itself is not fixed: every attempt spins fresh, because a
 * week of the same eleven names would be one puzzle stretched over seven
 * days rather than a rule to play with.
 */
export function weeklyFor(n: number): Weekly {
  const twist = TWISTS[(((n - 1) % TWISTS.length) + TWISTS.length) % TWISTS.length];
  return {
    n,
    twist,
    config: twist.apply({ ...defaultConfig, diff: 'normal' }),
  };
}

/** This week's, from the clock. */
export function thisWeek(now: number = Date.now()): Weekly {
  return weeklyFor(weekNumber(now));
}

/** What next week will be, because knowing is half of coming back. */
export function nextTwist(now: number = Date.now()): Twist {
  return weeklyFor(weekNumber(now) + 1).twist;
}

/* ---------- what a week remembers ---------- */

export type WeeklyBest = {
  n: number;
  twistId: string;
  pts: number;
  position: number;
  rating: number;
  /** how many goes it took to get there */
  attempts: number;
  at: number;
};

export type WeeklyRecord = {
  /** the week the current best belongs to */
  week: number;
  best: WeeklyBest | null;
  /** every week finished before this one, newest first */
  past: WeeklyBest[];
  /** weeks in a row with at least one attempt */
  streak: number;
};

export const WEEKLY_KEEP = 12;

export const EMPTY_WEEKLY: WeeklyRecord = {
  week: 0,
  best: null,
  past: [],
  streak: 0,
};

/**
 * Bank an attempt at the week.
 *
 * As many goes as you like, and only the best of them is kept. Moving to
 * a new week files the old best away and starts again, and the streak
 * counts weeks you turned up for rather than weeks you won.
 */
export function bankWeekly(record: WeeklyRecord, result: WeeklyBest): WeeklyRecord {
  // A new week: file the old one and start again.
  if (result.n !== record.week) {
    const continued = result.n === record.week + 1;
    return {
      week: result.n,
      best: { ...result, attempts: 1 },
      past: record.best ? [record.best, ...record.past].slice(0, WEEKLY_KEEP) : record.past,
      streak: record.best ? (continued ? record.streak + 1 : 1) : 1,
    };
  }

  const attempts = (record.best?.attempts ?? 0) + 1;
  const better = !record.best || result.pts > record.best.pts;
  return {
    ...record,
    best: better ? { ...result, attempts } : { ...record.best!, attempts },
  };
}

/** This week's best, if this week has been played. */
export function bestThisWeek(record: WeeklyRecord, n: number): WeeklyBest | null {
  return record.week === n ? record.best : null;
}

/** The streak as it stands now, rather than as it stood when it was set. */
export function weeklyStreak(record: WeeklyRecord, n: number): number {
  if (!record.best) return 0;
  return n - record.week <= 1 ? record.streak : 0;
}

/* ---------- duels, as a record rather than a code ---------- */

export type DuelResult = {
  /** the code that was played, so it can be shown again */
  code: string;
  /** what you scored, and what they had */
  mine: number;
  theirs: number;
  outcome: 'won' | 'drew' | 'lost';
  /** true when you were the one who sent it */
  sent: boolean;
  at: number;
};

export type DuelRecord = {
  played: number;
  won: number;
  drew: number;
  lost: number;
  /** the most recent twelve, newest first */
  results: DuelResult[];
  /** a challenge you have sent and can show again */
  outstanding: string | null;
};

export const EMPTY_DUELS: DuelRecord = {
  played: 0,
  won: 0,
  drew: 0,
  lost: 0,
  results: [],
  outstanding: null,
};

export function bankDuel(record: DuelRecord, result: DuelResult): DuelRecord {
  return {
    played: record.played + 1,
    won: record.won + (result.outcome === 'won' ? 1 : 0),
    drew: record.drew + (result.outcome === 'drew' ? 1 : 0),
    lost: record.lost + (result.outcome === 'lost' ? 1 : 0),
    results: [result, ...record.results].slice(0, 12),
    outstanding: result.sent ? result.code : record.outstanding,
  };
}
