import { defineStore } from './storage';
import type { CupTieRun } from '../engine';

/**
 * The knockout in progress, or null when there is not one.
 *
 * One at a time, kept whole, like the two tournaments. Four ties is not
 * long but it holds results that have been shown to somebody, and those
 * cannot come out differently the second time.
 */

function isRun(v: unknown): v is CupTieRun | null {
  if (v === null) return true;
  if (typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.seed === 'number' &&
    typeof r.you === 'string' &&
    typeof r.round === 'string' &&
    Array.isArray(r.field) &&
    Array.isArray(r.alive) &&
    Array.isArray(r.played) &&
    Array.isArray(r.results) &&
    typeof r.over === 'boolean'
  );
}

export const cupStore = defineStore<CupTieRun | null>({
  key: 'cup',
  version: 1,
  fallback: null,
  validate: isRun,
});
