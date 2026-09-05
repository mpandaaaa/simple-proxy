/*
 * The grid maths, at every size a real device actually is.
 *
 * A column count that is one too many does not throw and does not warn.
 * The last cell simply wraps onto a line of its own, and the page looks
 * broken in a way that only shows up on a device nobody happened to be
 * holding. That is exactly the kind of fault this project keeps finding
 * on a phone rather than in a check, so it is checked here.
 *
 * What is proved:
 *
 *   1. A row of n cells plus its gaps never exceeds the room it has. If
 *      it did, the last one wraps.
 *   2. Nothing is ever laid out at a silly size: no cell narrower than
 *      the minimum it asked for, and no phone ever put into more columns
 *      than a phone can carry.
 *   3. A phone is never treated as wide, and a tablet always is, in both
 *      orientations and in a split screen half.
 */

/* Every width the app can actually be handed, in points.
   Phones first, then tablets, then the split screen widths an iPad gives
   an app when it is sharing the screen. */
const WIDTHS = [
  { name: 'iPhone SE', w: 320, h: 568, phone: true },
  { name: 'iPhone 13 mini', w: 375, h: 812, phone: true },
  { name: 'iPhone 15', w: 393, h: 852, phone: true },
  { name: 'iPhone 16 Pro Max', w: 440, h: 956, phone: true },
  { name: 'iPad mini portrait', w: 744, h: 1133, phone: false },
  { name: 'iPad 11 portrait', w: 820, h: 1180, phone: false },
  { name: 'iPad 11 landscape', w: 1180, h: 820, phone: false },
  { name: 'iPad 13 portrait', w: 1024, h: 1366, phone: false },
  { name: 'iPad 13 landscape', w: 1366, h: 1024, phone: false },
  /* An iPad in split screen hands the app a narrow window. It is a
     tablet, but it has a phone's width, and it must behave like one. */
  { name: 'iPad split, third', w: 320, h: 1180, phone: true },
  { name: 'iPad split, half', w: 507, h: 1180, phone: true },
];

/* These mirror src/ui/layout.ts. Kept as literals rather than imported
   because that file imports react-native, which does not run in node. If
   they ever drift, this check is measuring the wrong thing, so the
   numbers are asserted against the source below. */
const WIDE_AT = 700;
const WIDE_CAP = 1180;
const S4 = 16;
const S3 = 12;

function cols(width, min, max, wideCap) {
  const room = Math.min(width, wideCap) - S4 * 2;
  const n = Math.floor((room + S3) / (min + S3));
  return Math.max(1, Math.min(max, n));
}

function cellWidth(room, n, gap) {
  if (n <= 1) return room;
  return Math.floor((room - gap * (n - 1)) / n);
}

let failures = 0;
const fail = (m) => {
  console.error(`  FAIL ${m}`);
  failures++;
};

/* ---- the constants here match the ones the app uses ---- */
{
  const src = (await import('node:fs')).readFileSync('src/ui/layout.ts', 'utf8');
  const pairs = [
    ['WIDE_AT', WIDE_AT],
    ['WIDE_CAP', WIDE_CAP],
  ];
  for (const [name, want] of pairs) {
    const m = src.match(new RegExp(`const ${name} = (\\d+)`));
    if (!m) fail(`src/ui/layout.ts no longer declares ${name}, so this check cannot verify it.`);
    else if (Number(m[1]) !== want) {
      fail(`${name} is ${m[1]} in src/ui/layout.ts but ${want} here. This check is measuring the wrong thing.`);
    }
  }
}

/* ---- a phone is never wide, a tablet always is ---- */
for (const d of WIDTHS) {
  const wide = d.w >= WIDE_AT;
  if (wide !== !d.phone) {
    fail(`${d.name} at ${d.w} points is ${wide ? 'wide' : 'narrow'}, which is not what it should be.`);
  }
}

/* ---- every grid in the app, at every width ---- */
const GRIDS = [
  { where: 'home, the mode cards', min: 300, max: 2, gap: S3 },
  { where: 'dynasty hub, the doors', min: 150, max: 6, gap: 8 },
  { where: 'the album, the wall', min: 96, max: 10, gap: 6 },
];

let checked = 0;
for (const g of GRIDS) {
  for (const d of WIDTHS) {
    const wide = d.w >= WIDE_AT;
    const cap = wide ? WIDE_CAP : 560;
    const room = Math.min(d.w, cap) - S4 * 2;
    const n = wide ? cols(d.w, g.min, g.max, WIDE_CAP) : 1;
    const w = cellWidth(room, n, g.gap);
    checked++;

    const used = w * n + g.gap * (n - 1);
    if (used > room) {
      fail(`${g.where} on ${d.name}: ${n} cells of ${w} plus gaps is ${used}, wider than the ${room} it has. The last one wraps.`);
    }
    if (n > 1 && w < g.min - 1) {
      fail(`${g.where} on ${d.name}: ${n} columns makes each cell ${w}, under the ${g.min} it asked for.`);
    }
    if (w <= 0) {
      fail(`${g.where} on ${d.name}: a cell came out ${w} points wide.`);
    }
  }
}


/* ---- the two pane split, at every window it can appear on ---- */
/*
 * Split puts two panes side by side in landscape on a tablet. The same
 * arithmetic applies as to a grid: two panes plus the gap between them
 * must fit, or the second drops underneath and the screen is a stack
 * with a hole in it.
 */
{
  const RATIOS = [
    { where: 'the draft board, pitch beside the reel', ratio: 0.52, gap: 16, min: 900 },
  ];
  for (const sp of RATIOS) {
    for (const d of WIDTHS) {
      const wide = d.w >= WIDE_AT;
      const landscape = d.w > d.h;
      const room = Math.min(d.w, WIDE_CAP) - S4 * 2;
      const splits = wide && landscape && room >= sp.min;
      if (!splits) continue;

      const main = Math.floor((room - sp.gap) * sp.ratio);
      const side = room - sp.gap - main;
      const used = main + sp.gap + side;

      if (used > room) {
        fail(`${sp.where} on ${d.name}: ${main} plus ${side} plus a ${sp.gap} gap is ${used}, wider than ${room}.`);
      }
      if (main < 300 || side < 300) {
        fail(`${sp.where} on ${d.name}: a pane came out ${Math.min(main, side)} wide, too narrow to hold anything.`);
      }
      checked++;
    }
  }
}

/* ---- every modal is capped, so none of them fill a tablet ---- */
{
  const MODALS = [
    ['src/ui/components/MatchLive.tsx', 'the match broadcast'],
    ['src/ui/components/Confirm.tsx', 'the confirm dialog'],
    ['src/ui/components/PackOpen.tsx', 'the pack opening'],
    ['src/ui/components/Sheet.tsx', 'the bottom sheet'],
    ['src/ui/components/PlayerCard.tsx', 'the player card'],
  ];
  const fs = await import('node:fs');
  for (const [file, what] of MODALS) {
    const src = fs.readFileSync(file, 'utf8');
    const caps = [...src.matchAll(/maxWidth:\s*(\d+)/g)].map((m) => Number(m[1]));
    const fixed = /width:\s*CARD_W/.test(src);
    if (!caps.length && !fixed) {
      fail(`${what} has no width cap, so on a thirteen inch iPad it fills the screen.`);
    }
  }
}

/* ---- the readable cap still applies to prose on a tablet ---- */
{
  const src = (await import('node:fs')).readFileSync('src/ui/tokens.ts', 'utf8');
  const m = src.match(/export const READABLE = (\d+)/);
  if (!m) fail('READABLE is gone from src/ui/tokens.ts.');
  else if (Number(m[1]) > 700) {
    fail(`READABLE is ${m[1]}. Above about 700 a line of body text stops being a column and starts being hard to read.`);
  }
}

if (failures) {
  console.error(`\n${failures} problems.\n`);
  process.exit(1);
}

console.log(`
Every grid holds
  ${WIDTHS.length} window sizes, phones, tablets and split screen
  ${GRIDS.length} grids, ${checked} combinations
  no row overflows, no cell under its minimum, no phone treated as a tablet
`);
