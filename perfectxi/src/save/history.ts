import { defineStore } from './storage';

/**
 * Every season you have finished.
 *
 * Enough of each run to rebuild the card that shows it, and no more. The
 * XI is kept because the season means nothing without it, but the thirty
 * eight results are not: a run is remembered by where it finished and who
 * did it, and keeping every match of fifty seasons would be a megabyte of
 * storage nobody ever reads.
 *
 * The seed and engine version are kept so a run could be replayed and
 * verified later, which is how the online leaderboard will check that a
 * submitted season is real.
 */

export type HistoryPlayer = {
  n: string;
  pos: string;
  rtg: number;
  club: string;
  season: string;
};

export type SeasonRecord = {
  /** when it was finished, as a timestamp */
  at: number;
  seed: number;
  engineVersion: number;
  formation: string;
  mode: string;
  diff: string;
  avg: number;
  position: number;
  pts: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  grade: string;
  cleanSheets: number;
  /** the honours won that season, already worded */
  honours: string[];
  nationalCup: boolean;
  continentalCup: boolean;
  topScorer: { name: string; goals: number } | null;
  xi: HistoryPlayer[];
};

export type History = { runs: SeasonRecord[] };

/**
 * Fifty is where it stops.
 *
 * Long enough that the cabinet has a real history behind it, short enough
 * that reading and writing it stays instant. The best seasons are ranked
 * out of whatever is kept, so what falls off the end is the oldest, not
 * the best.
 */
export const HISTORY_CAP = 50;

const fallback: History = { runs: [] };

function isRecord(v: unknown): v is SeasonRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.at === 'number' &&
    typeof r.position === 'number' &&
    typeof r.pts === 'number' &&
    typeof r.formation === 'string' &&
    Array.isArray(r.xi)
  );
}

function isHistory(v: unknown): v is History {
  if (typeof v !== 'object' || v === null) return false;
  const h = v as Record<string, unknown>;
  return Array.isArray(h.runs) && h.runs.every(isRecord);
}

export const historyStore = defineStore<History>({
  key: 'history',
  version: 1,
  fallback,
  validate: isHistory,
});

/** Newest first, capped. */
export function remember(record: SeasonRecord): void {
  historyStore.update((h) => ({
    runs: [record, ...h.runs].slice(0, HISTORY_CAP),
  }));
}

/**
 * Your seasons in the order the Hall of Fame wants them: best first.
 *
 * Points decide it, then goal difference, then goals scored, which is how
 * a league table is decided and so the order a football fan expects.
 */
export function ranked(runs: readonly SeasonRecord[]): SeasonRecord[] {
  return [...runs].sort(
    (a, b) =>
      b.pts - a.pts ||
      b.gf - b.ga - (a.gf - a.ga) ||
      b.gf - a.gf ||
      a.position - b.position,
  );
}
