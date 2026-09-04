import { defineStore } from './storage';
import type { WcDraftState } from '../engine';

/**
 * A World XI part way through being drafted.
 *
 * Kept separately from the run itself, because a draft is not a
 * tournament yet: eleven picks that have not started anything, and if the
 * phone dies on the seventh the seventh is where you come back to. The
 * board for a round is worked out from the seed rather than stored, so
 * this is only ever the picks and the shape.
 */

function isDraft(v: unknown): v is WcDraftState | null {
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

export const wcDraftStore = defineStore<WcDraftState | null>({
  key: 'worldcup-draft',
  version: 1,
  fallback: null,
  validate: isDraft,
});
