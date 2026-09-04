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
    typeof c.wcRuns === 'number' &&
    typeof c.wcTitles === 'number' &&
    typeof c.wcBest === 'number' &&
    typeof c.uclRuns === 'number' &&
    typeof c.uclTitles === 'number' &&
    typeof c.uclBest === 'number' &&
    typeof c.dynSeasons === 'number' &&
    typeof c.dynTitles === 'number' &&
    typeof c.dynBestPts === 'number' &&
    Array.isArray(c.titleFormations) &&
    Array.isArray(c.earned)
  );
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export const careerStore = defineStore<Career>({
  key: 'career',
  version: 2,
  fallback: EMPTY_CAREER,
  validate: isCareer,
  migrations: {
    /*
     * Two adds the tournament and Dynasty counters.
     *
     * Everything earned before them is kept exactly as it was. The new
     * counters start at nought, which is true: nothing had been counted,
     * because nothing was counting. A cabinet that quietly awarded a
     * World Cup for a tournament nobody played would be worse than one
     * that starts the count today.
     */
    2: (v: unknown) => {
      if (typeof v !== 'object' || v === null) return null;
      const c = v as Record<string, unknown>;
      return {
        ...EMPTY_CAREER,
        seasons: num(c.seasons),
        titles: num(c.titles),
        wins: num(c.wins),
        unbeaten: num(c.unbeaten),
        relegations: num(c.relegations),
        nationalCups: num(c.nationalCups),
        continentalCups: num(c.continentalCups),
        doubles: num(c.doubles),
        trebles: num(c.trebles),
        lastRelegated: c.lastRelegated === true,
        titleFormations: Array.isArray(c.titleFormations)
          ? (c.titleFormations as string[]).filter((x) => typeof x === 'string')
          : [],
        earned: Array.isArray(c.earned)
          ? (c.earned as string[]).filter((x) => typeof x === 'string')
          : [],
      };
    },
  },
});

export type { Career };
