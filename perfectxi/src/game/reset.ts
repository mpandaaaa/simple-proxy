import {
  clearAllSaves,
  collectionStore,
  dynastySlots,
  slotStore,
  uclStore,
  worldCupStore,
} from '../save';
import { setCareer } from './career';
import { clearRun } from './run';
import { setUcl } from './ucl';
import { clearUclDraft } from './uclDraft';
import { setWorldCup } from './worldcup';
import { clearWcDraft } from './worldcupDraft';
import { clearUnlocks } from './unlocks';

/**
 * Throwing things away, properly.
 *
 * Wiping storage on its own is not enough and is the sort of bug that
 * looks like the delete did not work. Five things in this app hold a copy
 * of a save outside React so that every screen reading it sees the same
 * one, and those copies survive a storage wipe: the World Cup, the
 * Champions League, the two drafts and the Dynasty career. Clearing the
 * disk and leaving them in memory means the run you just deleted is still
 * on the screen, and writes itself back the next time anything touches
 * it.
 *
 * So everything held in memory is dropped first, and only then is the
 * disk cleared.
 */

/** One mode, thrown away. */
export function wipeWorldCup(): void {
  setWorldCup(null);
  clearWcDraft();
}

export function wipeUcl(): void {
  setUcl(null);
  clearUclDraft();
}

/** All three careers, not just the one being played. */
export function wipeDynasty(): void {
  setCareer(null);
  for (const s of dynastySlots) s.write(null);
  slotStore.write({ active: 0 });
}

export function wipeCollection(): void {
  collectionStore.write({ cards: [], bought: [], claimed: [], owed: [] });
}

/**
 * Everything on the phone.
 *
 * The in-memory copies go first, each of which writes its own emptiness
 * back, and then the disk is cleared underneath them. Doing it the other
 * way round leaves a live run that would save itself again.
 */
export function wipeEverything(): void {
  clearUnlocks();
  clearRun();
  setWorldCup(null);
  setUcl(null);
  clearWcDraft();
  clearUclDraft();
  setCareer(null);
  for (const s of dynastySlots) s.write(null);
  clearAllSaves();
  /* Written after the wipe so the stores hold a valid empty record rather
     than nothing at all, which is what a fresh install looks like. */
  worldCupStore.write(null);
  uclStore.write(null);
  for (const s of dynastySlots) s.write(null);
  slotStore.write({ active: 0 });
}
