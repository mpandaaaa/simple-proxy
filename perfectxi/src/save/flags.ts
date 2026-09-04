import { defineStore } from './storage';

/**
 * Things that only ever happen once.
 *
 * Kept apart from the settings, because a setting is a preference somebody
 * chose and a flag is a fact about what has already happened. Mixing them
 * means a switch appears in Settings that nobody would ever want to turn
 * back on.
 */

export type Flags = {
  /** the three cards explaining the game have been seen */
  intro: boolean;
};

const fallback: Flags = { intro: false };

function isFlags(v: unknown): v is Flags {
  return typeof v === 'object' && v !== null && typeof (v as Flags).intro === 'boolean';
}

export const flagsStore = defineStore<Flags>({
  key: 'flags',
  version: 1,
  fallback,
  validate: isFlags,
});
