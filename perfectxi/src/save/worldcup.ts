import { defineStore } from './storage';
import type { WcRun } from '../engine';

/**
 * The World Cup in progress.
 *
 * One run at a time, kept whole. A tournament played a match at a time
 * is only worth anything if closing the app between two of them changes
 * nothing, so the entire run is written after every match rather than
 * being rebuilt from a seed on the way back in: the run holds results
 * that were already shown to somebody, and those cannot be allowed to
 * come out differently the second time.
 */

function isRun(v: unknown): v is WcRun | null {
  if (v === null) return true;
  if (typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.seed === 'number' &&
    typeof r.you === 'string' &&
    typeof r.stage === 'string' &&
    Array.isArray(r.played) &&
    Array.isArray(r.ahead) &&
    Array.isArray(r.table) &&
    Array.isArray(r.bracket) &&
    typeof r.over === 'boolean'
  );
}

export const worldCupStore = defineStore<WcRun | null>({
  key: 'worldcup',
  version: 1,
  fallback: null,
  validate: isRun,
});
