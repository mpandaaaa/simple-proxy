import { defineStore } from './storage';

/**
 * Player progression. Mirrors the web build's PXP record so a future
 * import can carry a browser save across without reshaping it.
 *
 * Missions are not built yet, so they are not in the shape. When they
 * arrive they come in as a version 2 migration, not as an optional field.
 */
export type Progress = {
  lvl: number;
  xp: number;
  coins: number;
  streak: number;
  seasons: number;
  titles: number;
  /** best points total across every completed season */
  best: number;
};

const fallback: Progress = {
  lvl: 1,
  xp: 0,
  coins: 0,
  streak: 0,
  seasons: 0,
  titles: 0,
  best: 0,
};

function isProgress(v: unknown): v is Progress {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.lvl === 'number' &&
    typeof p.xp === 'number' &&
    typeof p.coins === 'number' &&
    typeof p.streak === 'number' &&
    typeof p.seasons === 'number' &&
    typeof p.titles === 'number' &&
    typeof p.best === 'number'
  );
}

export const progressStore = defineStore<Progress>({
  key: 'progress',
  version: 1,
  fallback,
  validate: isProgress,
});
