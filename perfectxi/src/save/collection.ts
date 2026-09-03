import { defineStore } from './storage';

/**
 * What you own.
 *
 * Cards, bought cosmetics, and what is still owed. Levels are not in
 * here: what a level has handed over is worked out from the level, so
 * there is nothing to go stale and no way to end up owning something the
 * level says you should not. Nor is what is being worn, which lives in
 * its own record because it is read far more often than this one and
 * this one grows.
 *
 * Cards are kept as a plain list of ids rather than a set, because that
 * is what survives being written to storage and read back. Everything
 * that asks a question of it turns it into a set first.
 */

export type Collection = {
  /** every card id, oldest first */
  cards: string[];
  /** cosmetics bought with coins, as opposed to reached */
  bought: string[];
  /** sets and milestones already paid out, so nothing pays twice */
  claimed: string[];
  /** packs owed from levels, waiting to be opened */
  owed: string[];
};

export const EMPTY_COLLECTION: Collection = {
  cards: [],
  bought: [],
  claimed: [],
  owed: [],
};

function isCollection(v: unknown): v is Collection {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    Array.isArray(c.cards) &&
    Array.isArray(c.bought) &&
    Array.isArray(c.claimed) &&
    Array.isArray(c.owed)
  );
}

export const collectionStore = defineStore<Collection>({
  key: 'collection',
  version: 1,
  fallback: EMPTY_COLLECTION,
  validate: isCollection,
});

/**
 * Add cards, keeping only the ones that are new.
 *
 * Returns the collection and which ids were actually added, because the
 * screen that shows a pack being opened has to know which of the five
 * were duplicates and the one that banks a season has to know whether to
 * say anything at all.
 */
export function addCards(c: Collection, ids: readonly string[]): { next: Collection; added: string[] } {
  const have = new Set(c.cards);
  const added: string[] = [];
  for (const id of ids) {
    if (have.has(id)) continue;
    have.add(id);
    added.push(id);
  }
  if (!added.length) return { next: c, added };
  return { next: { ...c, cards: [...c.cards, ...added] }, added };
}

/** Cards as a set, which is what every question about them wants. */
export function owned(c: Collection): Set<string> {
  return new Set(c.cards);
}
