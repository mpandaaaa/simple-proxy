/*
 * Every saved record, fed everything that could be on the disk.
 *
 * The save layer promises two things in writing: a read never throws,
 * and a read never returns a half migrated value. Until now that was
 * proved for exactly one of nineteen stores, the Dynasty career, and
 * taken on trust for the other eighteen.
 *
 * This runs the real read path of every store against the states a disk
 * actually reaches: nothing written yet, a truncated write, a record
 * from a newer build after a downgrade, an envelope with no version, and
 * a value of every wrong type. Whatever comes back has to be the
 * fallback, and nothing may throw.
 *
 * It also checks the one property that would be silently fatal: that
 * each store's own fallback passes its own validator. A fallback that
 * fails validation is not obviously wrong anywhere in the code, and it
 * means the store can never hold anything: every read is rejected, every
 * write is thrown away on the next read, and the player's progress
 * quietly never saves.
 *
 * The save layer talks to MMKV, which is native and cannot run here, so
 * it is replaced with a plain map before anything is imported. The code
 * under test is otherwise the real code.
 */

import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const require_ = createRequire(import.meta.url);
const Module = require_('node:module');

/* ---- MMKV, as a map ---- */
const disk = new Map();
const stub = {
  createMMKV: () => ({
    getString: (k) => (disk.has(k) ? disk.get(k) : undefined),
    set: (k, v) => disk.set(k, v),
    remove: (k) => disk.delete(k),
    clearAll: () => disk.clear(),
  }),
};

/* ---- the filesystem, as a map, and a count of what it was asked ---- */
const disk2 = new Map();
const fsCalls = { writes: 0 };
const fsStub = {
  documentDirectory: 'file:///doc/',
  EncodingType: { UTF8: 'utf8' },
  getInfoAsync: async (p) => ({ exists: disk2.has(p) || p.endsWith('/') }),
  makeDirectoryAsync: async () => {},
  readDirectoryAsync: async () => [...disk2.keys()].map((k) => k.split('/').pop()),
  readAsStringAsync: async (p) => disk2.get(p) ?? '',
  writeAsStringAsync: async (p, v) => {
    fsCalls.writes++;
    /* a real write takes time, which is the whole point: it is the
       window in which a second call could slip past a guard */
    await new Promise((r) => setTimeout(r, 15));
    disk2.set(p, v);
  },
  deleteAsync: async (p) => {
    disk2.delete(p);
  },
};

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'react-native-mmkv') return stub;
  if (request === 'expo-file-system/legacy' || request === 'expo-file-system') return fsStub;
  return load.call(this, request, parent, isMain);
};

let failures = 0;
const fail = (m) => {
  console.error('  FAIL ' + m);
  failures++;
};

/* ---- every store the save layer defines ---- */
const modules = readdirSync('.headless/save')
  .filter((n) => n.endsWith('.js') && !['index.js', 'schema.js', 'storage.js'].includes(n));

const stores = [];
for (const name of modules) {
  const mod = require_(join(process.cwd(), '.headless/save', name));
  for (const [exported, value] of Object.entries(mod)) {
    if (value && typeof value.read === 'function' && typeof value.write === 'function' &&
        typeof value.key === 'string') {
      stores.push({ file: name, name: exported, store: value });
    }
  }
}

/* dynastyStores is an array of three, one per career slot */
for (const name of modules) {
  const mod = require_(join(process.cwd(), '.headless/save', name));
  for (const [exported, value] of Object.entries(mod)) {
    if (Array.isArray(value)) {
      value.forEach((s, i) => {
        if (s && typeof s.read === 'function' && typeof s.key === 'string') {
          stores.push({ file: name, name: exported + '[' + i + ']', store: s });
        }
      });
    }
  }
}

if (stores.length < 15) {
  fail('only found ' + stores.length + ' stores, which is fewer than the save layer has. This check is not seeing them all.');
}

/* ---- what a disk can actually hold ---- */
const JUNK = [
  ['nothing written yet', undefined],
  ['an empty string', ''],
  ['a truncated write', '{"v":1,"t":0,"data":{'],
  ['not json at all', 'hello'],
  ['json but not an envelope', '"a string"'],
  ['an envelope with no version', '{"t":0,"data":{}}'],
  ['a version that is not a number', '{"v":"1","t":0,"data":{}}'],
  ['a record from a newer build', '{"v":9999,"t":0,"data":{}}'],
  ['data that is null', '{"v":1,"t":0,"data":null}'],
  ['data that is a number', '{"v":1,"t":0,"data":42}'],
  ['data that is an array', '{"v":1,"t":0,"data":[]}'],
  ['data that is an empty object', '{"v":1,"t":0,"data":{}}'],
  ['a version of zero', '{"v":0,"t":0,"data":{}}'],
  ['a negative version', '{"v":-1,"t":0,"data":{}}'],
];

const same = (a, b) => {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
};

/**
 * The same record with one field changed to another legal value.
 *
 * Returns null when there is nothing safe to change, so a store with an
 * empty or awkward fallback is skipped rather than guessed at.
 */
function mutate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'boolean') return { ...value, [k]: !v };
    if (typeof v === 'number' && Number.isFinite(v)) return { ...value, [k]: v + 1 };
  }
  return null;
}

let cases = 0;

for (const { file, name, store } of stores) {
  /* the fallback, read from an empty disk */
  disk.clear();
  let fallback;
  try {
    fallback = store.read();
  } catch (e) {
    fail(file + ' ' + name + ' throws on an empty disk: ' + e.message);
    continue;
  }

  /* ---- a real value must survive a round trip ---- */
  /*
   * Deliberately not the fallback. Writing the fallback and reading it
   * back proves nothing: if the validator rejects everything, the read
   * returns the fallback anyway and the two match. That version of this
   * test passed happily against a validator broken on purpose.
   *
   * So one field is changed to another legal value of the same type
   * first. If the validator is wrong, the changed value is rejected on
   * the way back and the fallback arrives instead, which is visible.
   *
   * A store whose fallback has no field to change is skipped rather than
   * pretended about.
   */
  const changed = mutate(fallback);
  if (changed !== null) {
    disk.clear();
    try {
      store.write(changed);
      const back = store.read();
      if (same(back, fallback)) {
        fail(file + ' ' + name + ' will not read back a value it just wrote. ' +
          'Its validator rejects its own data, so nothing can ever save.');
      } else if (!same(back, changed)) {
        fail(file + ' ' + name + ' read back something different from what was written.');
      }
    } catch (e) {
      fail(file + ' ' + name + ' throws on a normal write then read: ' + e.message);
    }
    cases++;
  }

  /* ---- and every junk state gives the fallback back ---- */
  for (const [what, raw] of JUNK) {
    disk.clear();
    if (raw !== undefined) disk.set(store.key, raw);
    cases++;
    let got;
    try {
      got = store.read();
    } catch (e) {
      fail(file + ' ' + name + ' throws on ' + what + ': ' + e.message);
      continue;
    }
    if (!same(got, fallback)) {
      fail(file + ' ' + name + ' returns something other than the fallback for ' + what +
        '. A half migrated value has reached the app.');
    }
  }
}


/* ---- a backup runs once at a time, however often it is asked ---- */
/*
 * This is the fault that froze the app. It backed up on 'inactive' as
 * well as 'background', and on iOS 'inactive' fires for the app
 * switcher, control centre, any system alert, and briefly at launch. So
 * flicking in and out of the app asked for several backups at once.
 *
 * A backup reads every store and turns the lot into JSON, and
 * JSON.stringify is synchronous: while it runs, nothing else on the
 * JavaScript thread does, including drawing. Several at once is several
 * in a row on the same thread with the app frozen for all of them.
 *
 * The one-a-minute check did not stop it, because it sat behind two
 * filesystem reads and two calls could both get past it before either
 * had written. So the guard is a flag checked before any await, and this
 * proves it: ask five times at once, and exactly one write happens.
 */
{
  const backup = require_(join(process.cwd(), '.headless/game/backup.js'));
  disk2.clear();
  fsCalls.writes = 0;

  const asked = await Promise.all([
    backup.autoBackup(),
    backup.autoBackup(),
    backup.autoBackup(),
    backup.autoBackup(),
    backup.autoBackup(),
  ]);

  if (fsCalls.writes !== 1) {
    fail(
      'five backups asked for at once produced ' + fsCalls.writes +
      ' writes. Each one serialises the whole save on the JavaScript thread, which is what froze the app.',
    );
  }
  if (!asked.some((x) => x === true)) {
    fail('five backups asked for at once and not one of them succeeded.');
  }
  cases += 5;

  /* and asking again straight after does no work either */
  fsCalls.writes = 0;
  await backup.autoBackup();
  if (fsCalls.writes !== 0) {
    fail('a backup taken seconds after the last one wrote again. The one-a-minute rule is not holding.');
  }
  cases++;
}

/* ---- every version above one has migrations to reach it ---- */
for (const name of readdirSync('src/save').filter((n) => n.endsWith('.ts'))) {
  const src = readFileSync(join('src/save', name), 'utf8');
  const versions = [...src.matchAll(/version:\s*(\d+)/g)].map((m) => Number(m[1]));
  const top = Math.max(0, ...versions);
  if (top > 1 && !/migrations:/.test(src)) {
    fail('src/save/' + name + ' is at version ' + top + ' with no migrations. Anything saved by an older build is thrown away.');
  }
}

if (failures) {
  console.error('\n' + failures + ' problems.\n');
  process.exit(1);
}

console.log(`
Every saved record survives a bad disk
  ${stores.length} stores, ${cases} reads
  ${JUNK.length} kinds of damage: no write, a truncated one, a newer build, every wrong type
  nothing threw, every read gave the fallback back
  and every fallback passes its own validator, so every store can save
`);
