import { defineStore } from './storage';
import type { UclRun } from '../engine';

/**
 * The Champions League campaign in progress.
 *
 * One at a time, kept whole. Eight matchdays and up to nine knockout
 * matches is a long thing to hold, and it holds results that have already
 * been shown to somebody, so the whole run is written after every match
 * rather than rebuilt from a seed on the way back in.
 */

function isRun(v: unknown): v is UclRun | null {
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
    Array.isArray(r.order) &&
    Array.isArray(r.alive) &&
    typeof r.over === 'boolean'
  );
}

export const uclStore = defineStore<UclRun | null>({
  key: 'ucl',
  version: 1,
  fallback: null,
  validate: isRun,
});
