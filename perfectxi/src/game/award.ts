import {
  careerStore,
  collectionStore,
  dailyStore,
  duelStore,
  owned,
  progressStore,
  weeklyStore,
} from '../save';
import {
  allSets,
  bestOwned,
  collectionCounts,
  type Dynasty,
  type UclRun,
  type WcRun,
} from '../engine';
import { uclClub } from '../engine';
import {
  earnDynasty,
  earnUcl,
  earnWorldCup,
  foldDynasty,
  foldUcl,
  foldWorldCup,
  sweep,
  type Standing,
} from './achievements';
import { pushUnlocks } from './unlocks';

/**
 * Handing out what has been earned.
 *
 * One place, so a screen that finishes something calls a single function
 * and never has to know the order: count it into the career, judge the
 * catalogue against the career that now includes it, bank the result, and
 * queue whatever is new for the banner above the navigator.
 *
 * Nothing here throws. An achievement that fails to save must never take
 * down the screen that was showing a trophy.
 */

function bank(keys: string[]): string[] {
  if (!keys.length) return keys;
  careerStore.update((c) => ({ ...c, earned: [...c.earned, ...keys] }));
  pushUnlocks(keys);
  return keys;
}

/** A World Cup that has just ended. */
export function awardWorldCup(run: WcRun): string[] {
  try {
    const after = careerStore.update((c) => foldWorldCup(c, run));
    return bank(earnWorldCup(after, run));
  } catch {
    return [];
  }
}

/** A Champions League campaign that has just ended. */
export function awardUcl(run: UclRun): string[] {
  try {
    const after = careerStore.update((c) => foldUcl(c, run));
    const pot = run.custom ? 4 : (uclClub(run.you)?.pot ?? 4);
    return bank(earnUcl(after, run, pot));
  } catch {
    return [];
  }
}

/** A Dynasty season that has just been played out. */
export function awardDynasty(d: Dynasty): string[] {
  try {
    const after = careerStore.update((c) => foldDynasty(c, d));
    return bank(earnDynasty(after, d));
  } catch {
    return [];
  }
}

/**
 * Everything that can simply be looked at.
 *
 * Cards, sets, levels, streaks. None of these have to be caught at the
 * moment they happen, so rather than a hook on every screen that could
 * move one, this reads the stores and compares. Cheap enough to run
 * whenever the cabinet or the front door opens.
 */
export function standing(): Standing {
  const have = owned(collectionStore.read());
  const counts = collectionCounts(have);
  const best = bestOwned(have, 1)[0];
  const sets = allSets(have);
  const prog = progressStore.read();
  const daily = dailyStore.read();
  const weekly = weeklyStore.read();
  const duels = duelStore.read();

  return {
    cards: { all: counts.all, icon: counts.icon },
    bestCard: best ? best.rtg : 0,
    sets: sets.filter((s) => s.done).length,
    setsTotal: sets.length,
    level: prog.lvl,
    daily: { played: daily.played, won: daily.won, streak: daily.streak },
    weekly: {
      played: (weekly.past?.length ?? 0) + (weekly.best ? 1 : 0),
      streak: weekly.streak,
    },
    duels: { played: duels.played, won: duels.won },
  };
}

export function awardSweep(): string[] {
  try {
    return bank(sweep(careerStore.read(), standing()));
  } catch {
    return [];
  }
}
