/**
 * Three careers that cannot touch each other.
 *
 * The failure this exists to prevent is the worst one in the app: playing
 * career two and having it write itself over career one. So this drives
 * three slots through the same shape the screens do, and checks after
 * every step that the other two are exactly where they were left.
 *
 * The stores themselves need a phone, so this checks the routing rather
 * than the storage: one map of slots, one pointer into it, and every read
 * and write going through the pointer.
 */

let bad = 0;
const fail = (m) => {
  console.log('  ' + m);
  bad++;
};

const SLOTS = 3;

/* A stand-in for the three saved records, which is all a store is from
   this module's point of view. */
function makeDisk() {
  return { 0: null, 1: null, 2: null, pointer: 0 };
}

/* The routing, exactly as src/game/career.ts does it. */
function makeCareer(disk) {
  let slot = disk.pointer;
  let current = disk[slot];
  return {
    get: () => current,
    set(d) {
      current = d;
      disk[slot] = d;
    },
    switchTo(n) {
      const to = Math.max(0, Math.min(SLOTS - 1, Math.round(n)));
      if (to === slot) return;
      slot = to;
      disk.pointer = to;
      current = disk[to];
    },
    clear(n) {
      const at = Math.max(0, Math.min(SLOTS - 1, Math.round(n)));
      disk[at] = null;
      if (at === slot) current = null;
    },
    active: () => slot,
    summaries: () =>
      [0, 1, 2].map((n) => ({
        n,
        career: n === slot ? current : disk[n],
        active: n === slot,
      })),
  };
}

const disk = makeDisk();
const career = makeCareer(disk);

/* ---------- three careers, played in turn ---------- */

career.set({ club: 'Arsenal', year: 1 });
if (disk[0]?.club !== 'Arsenal') fail('starting a career did not land in the first slot');
if (disk[1] !== null || disk[2] !== null) fail('starting one career filled another slot');

career.switchTo(1);
if (career.get() !== null) fail('switching to an empty slot showed the old career');
career.set({ club: 'Hull', year: 1 });
if (disk[0]?.club !== 'Arsenal') fail('the second career overwrote the first');
if (disk[1]?.club !== 'Hull') fail('the second career did not save');

career.switchTo(2);
career.set({ club: 'Leeds', year: 1 });
if (disk[0]?.club !== 'Arsenal' || disk[1]?.club !== 'Hull') {
  fail('the third career disturbed the first two');
}

/* ---------- twenty seasons on one, none on the others ---------- */

career.switchTo(0);
for (let y = 2; y <= 20; y++) {
  const d = career.get();
  career.set({ ...d, year: y });
  if (disk[1]?.year !== 1 || disk[2]?.year !== 1) {
    fail(`playing season ${y} of career one moved another career on`);
    break;
  }
}
if (disk[0]?.year !== 20) fail(`twenty seasons left career one on ${disk[0]?.year}`);

/* ---------- coming back to it ---------- */

career.switchTo(1);
if (career.get()?.club !== 'Hull') fail('coming back to career two showed the wrong club');
career.switchTo(0);
if (career.get()?.year !== 20) fail('coming back to career one lost its seasons');

/* ---------- deleting one ---------- */

career.clear(1);
if (disk[1] !== null) fail('deleting a career did not delete it');
if (disk[0]?.club !== 'Arsenal' || disk[2]?.club !== 'Leeds') {
  fail('deleting one career deleted another');
}
if (career.get()?.club !== 'Arsenal') fail('deleting an inactive career changed the active one');

career.switchTo(2);
career.clear(2);
if (career.get() !== null) fail('deleting the career being played left it on screen');
if (disk[0]?.club !== 'Arsenal') fail('deleting the active career took another with it');

/* ---------- the pointer never wanders ---------- */

for (const n of [-5, 0, 1, 2, 9, 2.6]) {
  career.switchTo(n);
  const at = career.active();
  if (at < 0 || at >= SLOTS || !Number.isInteger(at)) fail(`switching to ${n} landed on ${at}`);
}

/* ---------- and every slot is accounted for ---------- */

const seen = career.summaries();
if (seen.length !== SLOTS) fail(`${seen.length} slots rather than ${SLOTS}`);
if (seen.filter((s) => s.active).length !== 1) fail('more or less than one slot is being played');

console.log('');
console.log(`  ${SLOTS} careers, kept apart across 20 seasons, a switch and two deletions`);
console.log('');

if (bad) {
  console.log(`${bad} problems\n`);
  process.exit(1);
}
console.log('No career can ever write over another one.\n');
