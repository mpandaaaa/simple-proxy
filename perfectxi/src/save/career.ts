import { defineStore } from './storage';
import { EMPTY_CAREER, type Career } from '../game/achievements';

/**
 * The running total of everything you have ever done.
 *
 * Separate from the season history because some of it cannot be
 * recalculated from that history. A phoenix needs to know the season
 * before this one ended in relegation, and once that season falls off the
 * end of a capped list the fact is gone. Counters remember; a capped list
 * forgets.
 */

function isCareer(v: unknown): v is Career {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.seasons === 'number' &&
    typeof c.titles === 'number' &&
    typeof c.wins === 'number' &&
    typeof c.unbeaten === 'number' &&
    typeof c.relegations === 'number' &&
    typeof c.nationalCups === 'number' &&
    typeof c.continentalCups === 'number' &&
    typeof c.doubles === 'number' &&
    typeof c.trebles === 'number' &&
    typeof c.lastRelegated === 'boolean' &&
    Array.isArray(c.titleFormations) &&
    Array.isArray(c.earned)
  );
}

export const careerStore = defineStore<Career>({
  key: 'career',
  version: 1,
  fallback: EMPTY_CAREER,
  validate: isCareer,
});

export type { Career };
