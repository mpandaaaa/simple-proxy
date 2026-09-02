import { defineStore } from './storage';
import type { Dynasty } from '../engine/dynasty';

/**
 * The Dynasty career in progress, or null when there is not one.
 *
 * `null` is a real state and not an error: the Dynasty row on Home then
 * carries the description instead of a status line.
 *
 * Version 1 of this key held a summary of a career the app could not yet
 * play, written before the mode existed. It is migrated to null rather
 * than guessed at, because a summary cannot be turned back into a squad
 * and inventing one would be worse than starting again.
 */

export type { Dynasty };

/** What the home screen needs, derived rather than stored twice. */
export type DynastySummary = {
  club: string;
  season: number;
  rating: number;
  titles: number;
};

function isPlayer(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.n === 'string' &&
    typeof p.pos === 'string' &&
    typeof p.rtg === 'number' &&
    typeof p.age === 'number' &&
    typeof p.phys === 'number' &&
    typeof p.tech === 'number' &&
    typeof p.ment === 'number' &&
    typeof p.contract === 'object' &&
    p.contract !== null
  );
}

function isDynasty(v: unknown): v is Dynasty | null {
  if (v === null) return true;
  if (typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d.seed === 'number' &&
    typeof d.club === 'string' &&
    typeof d.year === 'number' &&
    typeof d.formation === 'string' &&
    Array.isArray(d.squad) &&
    d.squad.every(isPlayer) &&
    Array.isArray(d.retired) &&
    Array.isArray(d.seasons) &&
    typeof d.titles === 'number'
  );
}

export const dynastyStore = defineStore<Dynasty | null>({
  key: 'dynasty',
  version: 2,
  fallback: null,
  validate: isDynasty,
  migrations: {
    // The old summary describes a career that was never playable. There is
    // nothing in it to carry forward.
    2: () => null,
  },
});

export function dynastySummary(d: Dynasty | null): DynastySummary | null {
  if (!d || !d.squad.length) return null;
  return {
    club: d.club,
    season: d.year,
    rating: Math.round(d.squad.reduce((s, p) => s + p.rtg, 0) / d.squad.length),
    titles: d.titles,
  };
}
