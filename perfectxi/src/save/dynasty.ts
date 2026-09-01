import { defineStore } from './storage';

/**
 * The headline of a Dynasty career, which is all the home screen needs to
 * show a live status line on the Dynasty row.
 *
 * The full career record is Phase 4. It lands as a version 2 migration on
 * this same key so an in flight career is not thrown away when it does.
 *
 * `null` means no career has been started, which is a real state and not
 * an error: the row then carries the description instead of a status.
 */
export type DynastySummary = {
  club: string;
  season: number;
  /** transfer budget in £m */
  budget: number;
  /** league titles won in this career */
  trophies: number;
  sacked: boolean;
};

function isSummary(v: unknown): v is DynastySummary | null {
  if (v === null) return true;
  if (typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d.club === 'string' &&
    typeof d.season === 'number' &&
    typeof d.budget === 'number' &&
    typeof d.trophies === 'number' &&
    typeof d.sacked === 'boolean'
  );
}

export const dynastyStore = defineStore<DynastySummary | null>({
  key: 'dynasty',
  version: 1,
  fallback: null,
  validate: isSummary,
});
