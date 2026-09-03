import { defineStore } from './storage';
import { EMPTY_DAILY, type DailyRecord, type DailyResult } from '../engine/daily';

/**
 * Where the Daily record is kept.
 *
 * Only the storage. The rules of it, which is what one attempt and a
 * streak actually mean, live in the engine beside the puzzle, so they can
 * be checked headlessly and so they could one day be checked again on a
 * server against a submitted run.
 */

function isResult(v: unknown): v is DailyResult {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.n === 'number' &&
    typeof r.pts === 'number' &&
    typeof r.position === 'number' &&
    typeof r.grade === 'string' &&
    typeof r.rating === 'number' &&
    typeof r.gf === 'number' &&
    typeof r.ga === 'number' &&
    typeof r.form === 'string' &&
    typeof r.at === 'number'
  );
}

function isRecord(v: unknown): v is DailyRecord {
  if (typeof v !== 'object' || v === null) return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d.last === 'number' &&
    typeof d.streak === 'number' &&
    typeof d.best === 'number' &&
    typeof d.played === 'number' &&
    typeof d.won === 'number' &&
    Array.isArray(d.results) &&
    d.results.every(isResult)
  );
}

export const dailyStore = defineStore<DailyRecord>({
  key: 'daily',
  version: 1,
  fallback: EMPTY_DAILY,
  validate: isRecord,
});
