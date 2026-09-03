import { defineStore } from './storage';
import { DEFAULTS } from '../engine';

/**
 * What is being worn.
 *
 * Three strings, in their own record, and the reason is performance
 * rather than tidiness. Reading a record parses the whole of it, and the
 * pitch is read every time a pitch is drawn, which during a draft is
 * every signing. Keeping these in the collection meant parsing a list of
 * card ids that grows for as long as somebody plays, so the draft would
 * have got measurably slower over a hundred seasons and nobody would
 * ever have worked out why.
 *
 * Sixty bytes, whatever else is going on.
 */

export type Looks = {
  frame: string;
  pitch: string;
  title: string;
};

export const EMPTY_LOOKS: Looks = {
  frame: DEFAULTS.frame,
  pitch: DEFAULTS.pitch,
  title: DEFAULTS.title,
};

function isLooks(v: unknown): v is Looks {
  if (typeof v !== 'object' || v === null) return false;
  const l = v as Record<string, unknown>;
  return typeof l.frame === 'string' && typeof l.pitch === 'string' && typeof l.title === 'string';
}

export const looksStore = defineStore<Looks>({
  key: 'looks',
  version: 1,
  fallback: EMPTY_LOOKS,
  validate: isLooks,
});
