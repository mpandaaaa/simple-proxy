import { defineStore } from './storage';
import {
  EMPTY_WEEKLY,
  EMPTY_DUELS,
  type WeeklyRecord,
  type DuelRecord,
} from '../engine/weekly';

/**
 * Where the week and the duels are kept.
 *
 * Only the storage. The rules of both live in the engine beside the
 * puzzles they are about, for the same reason the Daily's do: so they can
 * be checked headlessly, and so a server could one day check a submitted
 * run against exactly the same code.
 */

function obj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isWeekly(v: unknown): v is WeeklyRecord {
  if (!obj(v)) return false;
  return (
    typeof v.week === 'number' &&
    typeof v.streak === 'number' &&
    Array.isArray(v.past) &&
    (v.best === null || obj(v.best))
  );
}

function isDuels(v: unknown): v is DuelRecord {
  if (!obj(v)) return false;
  return (
    typeof v.played === 'number' &&
    typeof v.won === 'number' &&
    typeof v.drew === 'number' &&
    typeof v.lost === 'number' &&
    Array.isArray(v.results)
  );
}

export const weeklyStore = defineStore<WeeklyRecord>({
  key: 'weekly',
  version: 1,
  fallback: EMPTY_WEEKLY,
  validate: isWeekly,
});

export const duelStore = defineStore<DuelRecord>({
  key: 'duels',
  version: 1,
  fallback: EMPTY_DUELS,
  validate: isDuels,
});
