/*
 * A sweep for the kinds of fault that reach a phone.
 *
 * Not a linter and not a style check. Every pattern here is a class of
 * bug that compiles cleanly, warns about nothing, and then does
 * something wrong on a device: a crash, a blank screen, a row that wraps
 * on one size and not another, a card clipped off the edge.
 *
 * Two of them have already happened in this project:
 *
 *   an ordinary function called inside useAnimatedStyle, which runs on
 *   the UI thread and took the app down when a pack was opened
 *
 *   a width in percent next to a gap, where four cells at twenty five
 *   percent plus three gaps is wider than the row and the last one wraps
 *
 * What is NOT in here matters more than what is. A first version also
 * flagged duplicate React keys and every division by a list length.
 * Between them they produced twenty eight findings and every single one
 * was a false positive: a league table keyed by club name has twenty
 * unique clubs, a match keyed by its number is unique, and every
 * division was already guarded a few lines above in a form the checker
 * did not recognise. Both rules are gone rather than tuned, because a
 * checker that cries wolf is worse than no checker at all: the next real
 * finding gets skimmed past along with the noise.
 *
 * What is left is only what can be decided from the text with certainty.
 *
 *     node scripts/audit.mjs
 *     node scripts/audit.mjs --crash     only what can take the app down
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const only = process.argv.includes('--crash') ? 'CRASH' : null;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const files = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'src'))];
const findings = [];

const note = (rank, file, line, what, why) =>
  findings.push({ rank, file: relative(ROOT, file), line, what, why });

const lineAt = (src, i) => src.slice(0, i).split('\n').length;

/** Blank out comments and strings so a pattern is never matched in prose. */
function code(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/`(?:[^`\\]|\\.)*`/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/'(?:[^'\\\n]|\\.)*'/g, (m) => ' '.repeat(m.length))
    .replace(/"(?:[^"\\\n]|\\.)*"/g, (m) => ' '.repeat(m.length));
}

/** The body of every call to `name(`, with the offset it starts at. */
function bodies(src, name) {
  const out = [];
  let at = 0;
  for (;;) {
    const start = src.indexOf(name + '(', at);
    if (start < 0) break;
    let depth = 0;
    let end = src.length;
    for (let i = src.indexOf('(', start); i < src.length; i++) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    out.push({ start, body: src.slice(start, end) });
    at = end + 1;
  }
  return out;
}

/** Is `name` called as a function here, rather than part of a longer word? */
function calls(body, name) {
  let i = body.indexOf(name);
  while (i >= 0) {
    const before = i === 0 ? ' ' : body[i - 1];
    const after = body.slice(i + name.length).trimStart()[0];
    if (!/[A-Za-z0-9_$.]/.test(before) && after === '(') return true;
    i = body.indexOf(name, i + 1);
  }
  return false;
}

/* ============ 1. ordinary code on the UI thread ============ */
/*
 * A worklet may only call other worklets. Calling anything else does not
 * fail to compile, warns about nothing, and takes the app down when the
 * animation runs. This is the fault that crashed the pack screen.
 */
{
  const WORKLETS = [
    'useAnimatedStyle', 'useAnimatedProps', 'useDerivedValue',
    'useAnimatedScrollHandler', 'useAnimatedReaction', 'runOnUI',
  ];
  const HELPERS = [
    'alpha', 'clubColour', 'positionColor', 'rarityTint', 'wear', 'vivid',
    'lastName', 'cardValue', 'readable', 'shade', 'tintFor', 'commas',
    'surname', 'rarityColour', 'haptic', 'sfx',
  ];
  for (const f of files) {
    const src = code(readFileSync(f, 'utf8'));
    for (const w of WORKLETS) {
      for (const { start, body } of bodies(src, w)) {
        for (const h of HELPERS) {
          if (calls(body, h)) {
            note('CRASH', f, lineAt(src, start),
              h + '() called inside ' + w,
              'That body runs on the UI thread as a worklet, and a worklet may only call other worklets. Work the value out above and pass it in.');
          }
        }
      }
    }
  }
}

/* ============ 2. a hook after an early return ============ */
/*
 * React needs the same hooks in the same order on every render, so a
 * hook skipped by an early return throws on the render after the branch
 * changes.
 *
 * Two false positives were designed out of this. Any new function resets
 * the state, because `const X = memo(function Y(` was missed at first
 * and carried a return from one component into the next. And a hook on
 * the same line as the return is fine, because `return
 * useSyncExternalStore(...)` is both at once and is correct: nine of
 * those were reported before that was allowed for.
 */
{
  const HOOK = /(useState|useEffect|useMemo|useCallback|useRef|useLayout|useWindowDimensions|useSharedValue|useAnimatedStyle|useSafeAreaInsets|useReduceMotion|useSyncExternalStore|useLocalSearchParams|usePathname)\s*\(/;
  const OPENS = /(function\s|=>|memo\(|forwardRef\()/;
  /* a bare return, and the far commoner one liner `if (x) return null;` */
  const RETURNS = /(^|;|\)\s)\s*return\b/;

  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const lines = code(src).split('\n');
    let depth = 0;
    let returnedAt = 0;

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const opensScope = OPENS.test(l);
      if (opensScope) returnedAt = 0;

      const opens = (l.match(/\{/g) || []).length;
      const closes = (l.match(/\}/g) || []).length;

      if (depth === 1 && RETURNS.test(l) && !/=>/.test(l) && !opensScope) {
        returnedAt = i + 1;
      }

      if (returnedAt && returnedAt !== i + 1 && depth === 1 &&
          HOOK.test(l) && !opensScope) {
        note('CRASH', f, i + 1,
          'a hook here, after the return on line ' + returnedAt,
          'React needs the same hooks in the same order every render. This one is skipped when that return fires, and the render after it throws.');
        returnedAt = 0;
      }

      depth += opens - closes;
      if (depth <= 0) { depth = 0; returnedAt = 0; }
    }
  }
}

/* ============ 3. a width in percent beside a gap ============ */
/*
 * Four cells at twenty five percent plus three gaps is wider than the
 * row, so the fourth wraps onto a line of its own. It looks right at one
 * window size and broken at another, which is the worst way to find it.
 *
 * Scoped to a single style object, which is the whole difficulty. A gap
 * on the row is the space between cells and is the fault. A gap on the
 * cell is the space between that cell's own children and is fine. A
 * first version searched a window of four hundred characters either
 * side, could not tell the two apart, and reported eleven rows of which
 * every one was innocent: the commonest shape in this app is a row with
 * no gap holding cells that each have one.
 */
{
  /** The `{ ... }` object literal that starts at or after `from`. */
  function objectAt(src, from) {
    const open = src.indexOf('{', from);
    if (open < 0) return '';
    let depth = 0;
    for (let i = open; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) return src.slice(open, i + 1);
      }
    }
    return '';
  }

  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const clean = code(src);
    const re = /flexWrap:/g;
    let m;
    while ((m = re.exec(clean))) {
      /* walk back to the brace this property lives in */
      let open = -1;
      let depth = 0;
      for (let i = m.index; i >= 0; i--) {
        if (src[i] === '}') depth++;
        else if (src[i] === '{') {
          if (depth === 0) { open = i; break; }
          depth--;
        }
      }
      if (open < 0) continue;
      const row = objectAt(src, open);
      if (!/flexWrap:\s*'wrap'/.test(row)) continue;

      /* only a gap on the row itself counts */
      const gap = row.match(/(?:^|[,{]\s*)gap:\s*(\d+|space\.\w+)/);
      if (!gap) continue;

      /* and the cells that go in it, which are the sibling styles */
      const sheet = objectAt(src, src.lastIndexOf('StyleSheet.create', open));
      const pct = sheet.match(/width:\s*'(\d+(?:\.\d+)?)%'/);
      if (!pct) continue;

      /*
       * Do the arithmetic rather than guess.
       *
       * How many the author meant per row is the most that fit at that
       * percentage. Then check whether that many, plus the gaps between
       * them, actually fit in the narrowest room the app is ever given:
       * 288 points, an iPhone SE less the page padding.
       *
       * Only flagging a real overflow is the point. Flagging every three
       * across grid with a gap reported two rows that were correct, and
       * that is how a checker stops being read.
       */
      const w = Number(pct[1]);
      const per = Math.floor(100 / w);
      if (per < 2) continue;

      const px = /^\d+$/.test(gap[1])
        ? Number(gap[1])
        : { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s7: 32 }[gap[1].split('.')[1]] ?? 8;

      const ROOM = 288;
      const used = ROOM * (w / 100) * per + px * (per - 1);
      if (used > ROOM) {
        note('WRONG', f, lineAt(src, m.index),
          per + " cells at " + w + "% with a " + px + " point gap need " +
          used.toFixed(1) + " of the " + ROOM + " an iPhone SE has",
          'The last cell drops to a line of its own on that phone and nowhere else, which is how it stays unnoticed. Lower the percentage, or work the width out in points.');
      }
    }
  }
}

/* ============ 4. a fixed width that cannot fit the narrowest window == */
/*
 * The narrowest window this app is ever handed is 320 points: an iPhone
 * SE, and also an iPad sharing its screen three ways. Anything wider
 * than that minus the page padding is clipped, and clipping is silent.
 */
{
  const NARROWEST = 320;
  const PADDING = 32;
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const clean = code(src);
    const re = /\bwidth:\s*(\d{3,})\b/g;
    let m;
    while ((m = re.exec(clean))) {
      const w = Number(m[1]);
      if (w > NARROWEST - PADDING) {
        note('WRONG', f, lineAt(src, m.index),
          'a fixed width of ' + w + ' points',
          'The narrowest window this app is handed is ' + NARROWEST + ' points, an iPhone SE or an iPad split three ways. Anything wider is clipped, and clipping is silent.');
      }
    }
  }
}

/* ============ what was found ============ */
const RANKS = ['CRASH', 'WRONG'];
const shown = only ? findings.filter((f) => f.rank === only) : findings;
shown.sort((a, b) =>
  RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank) || a.file.localeCompare(b.file));

if (!shown.length) {
  console.log('\nNothing found across ' + files.length + ' files.\n');
  process.exit(0);
}

let last = '';
for (const f of shown) {
  if (f.rank !== last) {
    console.log('\n' + '='.repeat(60) + '\n' + f.rank + '\n' + '='.repeat(60));
    last = f.rank;
  }
  console.log('\n' + f.file + ':' + f.line);
  console.log('  ' + f.what);
  console.log('  ' + f.why);
}

const counts = RANKS
  .map((r) => findings.filter((x) => x.rank === r).length + ' ' + r)
  .join(', ');
console.log('\n' + '='.repeat(60));
console.log(findings.length + ' findings across ' + files.length + ' files: ' + counts);
console.log('='.repeat(60) + '\n');

/* A crash fails the build. Anything else is a report to read. */
process.exit(findings.some((f) => f.rank === 'CRASH') ? 1 : 0);
