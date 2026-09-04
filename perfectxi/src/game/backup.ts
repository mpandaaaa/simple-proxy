import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  careerStore,
  collectionStore,
  dailyStore,
  duelStore,
  dynastySlots,
  slotStore,
  flagsStore,
  historyStore,
  looksStore,
  progressStore,
  settingsStore,
  uclStore,
  weeklyStore,
  worldCupStore,
} from '../save';
import { ENGINE_VERSION } from '../engine';

/**
 * Taking a save off the phone, and putting one back.
 *
 * Deleting the app throws away everything, including a twenty five season
 * career, and there is no account to restore from because there is no
 * account. So this writes the whole thing to one file you can put in
 * Files, iCloud Drive, or a message to yourself, and reads it back.
 *
 * It is deliberately not a silent cloud sync. A sync that runs on its own
 * can overwrite the good copy with the empty one, and the failure mode of
 * that is losing everything, which is the exact thing it was supposed to
 * prevent. This only ever does what somebody just asked it to.
 *
 * Nothing here throws. Every path reports what happened instead, because
 * the screen has to say something either way.
 */

const MAGIC = 'perfectxi-save';
const FORMAT = 1;

/*
 * Every record that is worth carrying.
 *
 * Written by name rather than by reading the whole of storage, so a file
 * from a newer build lands in the right places and anything it carries
 * that this build has never heard of is ignored rather than restored into
 * nothing.
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
      /* A record that will not read is left out rather than aborting the
         whole backup. Everything else is still worth keeping. */
    }
  }
  return { magic: MAGIC, format: FORMAT, engine: ENGINE_VERSION, at: Date.now(), parts };
}

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type ExportResult = { ok: true; where: string } | { ok: false; why: string };

/**
 * Write it out and hand it to the share sheet.
 *
 * The file goes in the app's own cache first, because that is the only
 * place it is allowed to write without asking, and the share sheet is
 * what moves it somewhere that survives the app being deleted.
 */
export async function exportSave(): Promise<ExportResult> {
  try {
    const dir = FileSystem.cacheDirectory;
    if (!dir) return { ok: false, why: 'This phone will not give the app anywhere to write.' };

    const path = `${dir}perfect-xi-${stamp()}.json`;
    await FileSystem.writeAsStringAsync(path, JSON.stringify(collect()), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, why: 'Sharing is not available on this phone.' };
    }
    await Sharing.shareAsync(path, {
      mimeType: 'application/json',
      dialogTitle: 'Save your Perfect XI',
      UTI: 'public.json',
    });
    return { ok: true, where: `perfect-xi-${stamp()}.json` };
  } catch {
    return { ok: false, why: 'The save could not be written.' };
  }
}

export type ImportResult =
  | { ok: true; restored: number; at: number }
  | { ok: false; why: string };

/**
 * Read one back.
 *
 * Every record is written through its own store, which means every record
 * goes through that store's own validator and migration chain on the next
 * read. A file from an older build lands in an older shape and is
 * upgraded exactly the way a save on this phone would have been.
 *
 * Nothing is written until the whole file has been understood, so a file
 * that turns out to be rubbish halfway through cannot leave half a save
 * behind.
 */
export async function importSave(): Promise<ImportResult> {
  try {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'public.json', '*/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled) return { ok: false, why: '' };

    const file = picked.assets?.[0];
    if (!file?.uri) return { ok: false, why: 'Nothing was chosen.' };

    const raw = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, why: 'That file is not a Perfect XI save.' };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return { ok: false, why: 'That file is not a Perfect XI save.' };
    }
    const save = parsed as Partial<SaveFile>;
    if (save.magic !== MAGIC || typeof save.parts !== 'object' || save.parts === null) {
      return { ok: false, why: 'That file is not a Perfect XI save.' };
    }
    if (typeof save.format === 'number' && save.format > FORMAT) {
      return { ok: false, why: 'That save was written by a newer version of the app.' };
    }

    /* Understood in full first, written second. */
    const writes: { name: PartName; value: unknown }[] = [];
    for (const name of Object.keys(PARTS) as PartName[]) {
      const value = (save.parts as Record<string, unknown>)[name];
      if (value === undefined) continue;
      writes.push({ name, value });
    }
    if (!writes.length) return { ok: false, why: 'That save is empty.' };

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
      at: typeof save.at === 'number' ? save.at : Date.now(),
    };
  } catch {
    return { ok: false, why: 'That save could not be read.' };
  }
}
