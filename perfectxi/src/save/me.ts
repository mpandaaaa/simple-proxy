import { defineStore } from './storage';
import { handleFor } from '../engine';

/**
 * Who this phone is.
 *
 * There are no accounts in Perfect XI and there are not going to be. No
 * email, no password, no sign in wall between somebody and a game they
 * downloaded to play on a train. A player is a random id made on this
 * phone the first time it needs one, and a handle to go with it.
 *
 * That id is the only thing that ever leaves the device besides a seed
 * and a score. It is not linked to anything, it identifies nobody, and
 * deleting the app throws it away.
 */

export type Me = {
  /** a random id, made once, never shown to anybody */
  id: string;
  /** what other players see */
  name: string;
};

function isMe(v: unknown): v is Me {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Me).id === 'string' &&
    (v as Me).id.length > 0 &&
    typeof (v as Me).name === 'string'
  );
}

/** Sixteen bytes of nothing in particular. */
function freshId(): string {
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += Math.floor(Math.random() * 0x100000000)
      .toString(16)
      .padStart(8, '0');
  }
  return out;
}

const meStore = defineStore<Me | null>({
  key: 'me',
  version: 1,
  fallback: null,
  validate: (v): v is Me | null => v === null || isMe(v),
});

let cached: Me | null = null;

/**
 * This phone, making one if it has never needed one.
 *
 * The handle comes from the same list the Machine draws its opponents
 * from, seeded off the id, so a player and a stand in are named the same
 * way and neither reads as the odd one out in a duel.
 */
export function me(): Me {
  if (cached) return cached;
  const saved = meStore.read();
  if (saved) {
    cached = saved;
    return saved;
  }
  const id = freshId();
  const made: Me = { id, name: handleFor(parseInt(id.slice(0, 8), 16) >>> 0) };
  meStore.write(made);
  cached = made;
  return made;
}

/** Change what other people see. Trimmed, and never empty. */
export function rename(name: string): Me {
  const clean = name.trim().slice(0, 18);
  const next: Me = { ...me(), name: clean || me().name };
  meStore.write(next);
  cached = next;
  return next;
}
