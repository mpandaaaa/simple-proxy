import { defineStore } from './storage';

/**
 * Which of the three careers is the one being played.
 *
 * Its own record rather than a field on a career, because the answer has
 * to be readable when every slot is empty, and because writing it into
 * one career would mean the other two disagreed with it.
 */

export type Slot = { active: number };

function isSlot(v: unknown): v is Slot {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Slot;
  return typeof s.active === 'number' && s.active >= 0 && s.active <= 2;
}

export const slotStore = defineStore<Slot>({
  key: 'dynasty-slot',
  version: 1,
  fallback: { active: 0 },
  validate: isSlot,
});
