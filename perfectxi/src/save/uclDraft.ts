import { defineStore } from './storage';
import type { UclDraftState } from '../engine';

/**
 * A Champions League XI part way through being drafted.
 *
 * Kept apart from the campaign, because a draft is not a campaign yet.
 * Only the picks and the shape are stored: the board for a round is worked
 * out from the seed, so it cannot go stale.
 */

function isDraft(v: unknown): v is UclDraftState | null {
  if (v === null) return true;
  if (typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d.seed === 'number' &&
    typeof d.formation === 'string' &&
    typeof d.round === 'number' &&
    Array.isArray(d.slots) &&
    Array.isArray(d.taken)
  );
}

export const uclDraftStore = defineStore<UclDraftState | null>({
  key: 'ucl-draft',
  version: 1,
  fallback: null,
  validate: isDraft,
});
