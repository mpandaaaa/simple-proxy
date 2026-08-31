import { createMMKV } from 'react-native-mmkv';
import type { Envelope, StoreDef } from './schema';

const mmkv = createMMKV({ id: 'perfectxi' });

/**
 * A single saved record, versioned and migration safe.
 *
 * read() never throws and never returns a half-migrated value. If anything
 * at all is wrong with what is on disk, the fallback comes back and the
 * bad record is left in place rather than destroyed, so it can be
 * recovered from a support build if it ever matters.
 */
export function defineStore<T>(def: StoreDef<T>) {
  function read(): T {
    const raw = mmkv.getString(def.key);
    if (raw === undefined) return def.fallback;

    let env: Envelope<unknown>;
    try {
      env = JSON.parse(raw) as Envelope<unknown>;
    } catch {
      return def.fallback;
    }

    if (typeof env !== 'object' || env === null || typeof env.v !== 'number') {
      return def.fallback;
    }
    if (env.v > def.version) {
      // Written by a newer build of the app, for example after a downgrade.
      // Do not guess at a shape we do not know. Leave it alone.
      return def.fallback;
    }

    let value: unknown = env.data;
    for (let v = env.v + 1; v <= def.version; v++) {
      const step = def.migrations?.[v];
      if (!step) continue;
      try {
        value = step(value);
      } catch {
        return def.fallback;
      }
    }

    if (def.validate && !def.validate(value)) return def.fallback;
    return value as T;
  }

  function write(value: T): void {
    const env: Envelope<T> = { v: def.version, t: Date.now(), data: value };
    try {
      mmkv.set(def.key, JSON.stringify(env));
    } catch {
      // A failed write must never take the app down mid game.
    }
  }

  function update(fn: (current: T) => T): T {
    const next = fn(read());
    write(next);
    return next;
  }

  function clear(): void {
    mmkv.remove(def.key);
  }

  return { read, write, update, clear, key: def.key };
}

/** Wipe everything. Used by the reset control in settings, nowhere else. */
export function clearAllSaves(): void {
  mmkv.clearAll();
}
