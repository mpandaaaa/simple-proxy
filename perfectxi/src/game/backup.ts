import * as FileSystem from 'expo-file-system/legacy';
import {
  careerStore,
  collectionStore,
  dailyStore,
  duelStore,
  dynastySlots,
  flagsStore,
  historyStore,
  looksStore,
  progressStore,
  settingsStore,
  slotStore,
  uclStore,
  weeklyStore,
  worldCupStore,
  cupStore,
} from '../save';
import { ENGINE_VERSION } from '../engine';

/**
 * Keeping a copy, without anybody having to think about it.
 *
 * The save itself already lives in the app's Documents folder, which is
 * the folder iOS puts in the phone's own iCloud backup. A phone restored
 * from that backup, or a new phone set up from it, already has every
 * season and every career. That has always been true and nobody was ever
 * told.
 *
 * What was missing is a copy of the save that is not the save. If the
 * live record is ever damaged there is nothing to fall back to, so this
 * writes a snapshot beside it every time the app goes into the
 * background, keeps the last three, and can put any of them back. Those
 * snapshots sit in Documents too, so they go into the phone's backup
 * along with everything else.
 *
 * It is deliberately not a cloud sync of its own. A sync that runs on its
 * own can overwrite the good copy with the empty one, and losing
 * everything is the exact thing it would be there to prevent.
 *
 * Nothing here throws. A backup that fails is not worth a crash, and
 * every path reports what happened instead.
 */

const MAGIC = 'perfectxi-save';
const FORMAT = 1;

/** How many snapshots are kept. Three is a bad day and two good ones. */
const KEEP = 3;

const DIR = `${FileSystem.documentDirectory ?? ''}backups/`;

/*
 * Every record worth carrying.
 *
 * Written by name rather than by copying the whole of storage, so a
 * snapshot from a newer build lands in the right places and anything it
 * holds that this build has never heard of is ignored rather than
 * restored into nothing.
 */
const PARTS = {
  progress: progressStore,
  history: historyStore,
  career: careerStore,
  dynasty: dynastySlots[0],
  dynasty2: dynastySlots[1],
  dynasty3: dynastySlots[2],
  slot: slotStore,
  collection: collectionStore,
  looks: looksStore,
  daily: dailyStore,
  weekly: weeklyStore,
  duels: duelStore,
  worldcup: worldCupStore,
  ucl: uclStore,
  cup: cupStore,
  settings: settingsStore,
  flags: flagsStore,
} as const;

type PartName = keyof typeof PARTS;

export type SaveFile = {
  magic: string;
  format: number;
  engine: number;
  at: number;
  parts: Partial<Record<PartName, unknown>>;
};

/** Everything, as one object. */
export function collect(): SaveFile {
  const parts: Partial<Record<PartName, unknown>> = {};
  for (const name of Object.keys(PARTS) as PartName[]) {
    try {
      parts[name] = PARTS[name].read();
    } catch {
      /* A record that will not read is left out rather than abandoning
         the whole snapshot. Everything else is still worth keeping. */
    }
  }
  return { magic: MAGIC, format: FORMAT, engine: ENGINE_VERSION, at: Date.now(), parts };
}

async function ensureDir(): Promise<boolean> {
  if (!FileSystem.documentDirectory) return false;
  try {
    const info = await FileSystem.getInfoAsync(DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
    return true;
  } catch {
    return false;
  }
}

/** The snapshots on disk, newest first. */
async function listSnapshots(): Promise<{ name: string; at: number }[]> {
  try {
    if (!(await ensureDir())) return [];
    const files = await FileSystem.readDirectoryAsync(DIR);
    return files
      .filter((f) => f.startsWith('save-') && f.endsWith('.json'))
      .map((f) => ({ name: f, at: Number(f.slice(5, -5)) || 0 }))
      .filter((f) => f.at > 0)
      .sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

/**
 * Write one, and throw away anything past the last three.
 *
 * Skipped when the newest is under a minute old, because the app going in
 * and out of the background three times in ten seconds is not three
 * things worth keeping.
 */
/*
 * One at a time, and not too often.
 *
 * A snapshot reads every store, turns the lot into JSON and writes it to
 * disk. JSON.stringify is synchronous: while it runs, nothing else on
 * the JavaScript thread does, including drawing. On a save with three
 * careers and a full album that is real work, and doing it twice at once
 * is doing it twice on the same thread, one after the other, with the
 * app frozen for both.
 *
 * That is what happened. The app backed up on 'inactive' as well as
 * 'background', and on iOS 'inactive' fires constantly: the app
 * switcher, control centre, any system alert, a moment during launch.
 * Flicking in and out of the app queued a full serialise for each one.
 *
 * The time check alone did not stop it, because it came after two
 * filesystem reads: two calls could both get past it before either had
 * written anything. This is the flag that actually stops it.
 */
let backingUp = false;
let lastWroteAt = 0;

export async function autoBackup(force = false): Promise<boolean> {
  /* Checked before any await, so two calls in the same tick cannot both
     get through. */
  if (backingUp) return false;
  if (!force && lastWroteAt && Date.now() - lastWroteAt < 60_000) return true;
  backingUp = true;

  try {
    if (!(await ensureDir())) return false;
    const have = await listSnapshots();
    if (!force && have[0] && Date.now() - have[0].at < 60_000) {
      lastWroteAt = have[0].at;
      return true;
    }

    const at = Date.now();
    await FileSystem.writeAsStringAsync(`${DIR}save-${at}.json`, JSON.stringify(collect()), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    lastWroteAt = at;

    for (const old of have.slice(KEEP - 1)) {
      try {
        await FileSystem.deleteAsync(`${DIR}${old.name}`, { idempotent: true });
      } catch {
        /* An old snapshot that will not delete is only wasted space. */
      }
    }
    return true;
  } catch {
    return false;
  } finally {
    backingUp = false;
  }
}

/** When the newest snapshot was written, or null if there is not one. */
export async function lastBackup(): Promise<number | null> {
  const have = await listSnapshots();
  return have[0]?.at ?? null;
}

export type RestoreResult =
  | { ok: true; restored: number; at: number }
  | { ok: false; why: string };

/**
 * Put the newest snapshot back.
 *
 * Every record goes back through its own store, which means it goes
 * through that store's own validator and migration chain on the next
 * read: a snapshot from an older build is upgraded exactly the way a save
 * on this phone would have been.
 *
 * Nothing is written until the whole file has been understood, so a
 * snapshot that turns out to be damaged halfway through cannot leave half
 * a save behind.
 */
export async function restoreLatest(): Promise<RestoreResult> {
  try {
    const have = await listSnapshots();
    if (!have.length) return { ok: false, why: 'There is no backup on this phone yet.' };

    const raw = await FileSystem.readAsStringAsync(`${DIR}${have[0].name}`, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, why: 'The backup could not be read.' };
    }
    if (typeof parsed !== 'object' || parsed === null) {
      return { ok: false, why: 'The backup could not be read.' };
    }

    const save = parsed as Partial<SaveFile>;
    if (save.magic !== MAGIC || typeof save.parts !== 'object' || save.parts === null) {
      return { ok: false, why: 'The backup could not be read.' };
    }
    if (typeof save.format === 'number' && save.format > FORMAT) {
      return { ok: false, why: 'That backup was written by a newer version of the app.' };
    }

    const writes: { name: PartName; value: unknown }[] = [];
    for (const name of Object.keys(PARTS) as PartName[]) {
      const value = (save.parts as Record<string, unknown>)[name];
      if (value === undefined) continue;
      writes.push({ name, value });
    }
    if (!writes.length) return { ok: false, why: 'That backup is empty.' };

    for (const w of writes) {
      try {
        (PARTS[w.name] as { write: (v: unknown) => void }).write(w.value);
      } catch {
        /* One record refusing to write must not undo the rest. */
      }
    }

    return {
      ok: true,
      restored: writes.length,
      at: typeof save.at === 'number' ? save.at : have[0].at,
    };
  } catch {
    return { ok: false, why: 'The backup could not be read.' };
  }
}
