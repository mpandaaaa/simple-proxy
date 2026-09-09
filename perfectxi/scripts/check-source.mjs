/**
 * Rules about the code that a type checker cannot see.
 *
 * Every one of these is here because it went wrong on a real phone. They
 * are cheap greps, not a linter, and they only cover mistakes that have
 * actually been made.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

const files = [...walk('src'), ...walk('app')];
let failures = 0;
const fail = (msg) => {
  console.log('  FAIL ' + msg);
  failures++;
};

/*
 * Comments blanked out, so a rule never matches a word inside the note
 * that explains it. Two rules passed while broken for exactly that
 * reason: one found supportedOrientations in the comment describing the
 * prop it was looking for.
 *
 * Walked character by character rather than matched with a regular
 * expression: the escape for a newline does not survive being written
 * through a shell, and a stripper that silently stops working takes
 * every rule that uses it down with it.
 */
function noComments(src) {
  let out = '';
  let mode = 0; // 0 code, 1 line comment, 2 block comment
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const d = src[i + 1];
    if (mode === 0) {
      if (c === '/' && d === '/') { mode = 1; out += '  '; i++; continue; }
      if (c === '/' && d === '*') { mode = 2; out += '  '; i++; continue; }
      out += c;
    } else if (mode === 1) {
      if (c === String.fromCharCode(10)) { mode = 0; out += c; } else out += ' ';
    } else {
      if (c === '*' && d === '/') { mode = 0; out += '  '; i++; continue; }
      out += c === String.fromCharCode(10) ? c : ' ';
    }
  }
  return out;
}

/* ---- 1. the redirect that hijacked the end of a run, twice ---- */
for (const f of files) {
  if (f.endsWith(join('game', 'run.ts'))) continue;
  const src = readFileSync(f, 'utf8');
  if (/if\s*\(!run\)\s*router\.replace/.test(src)) {
    fail(`${f} redirects on an empty run. Use useRequireRun, which knows the difference between never having a run and a run that has just finished.`);
  }
}
for (const f of files.filter((f) => f.includes(join('app', 'draft')))) {
  const src = readFileSync(f, 'utf8');
  if (/\buseRun\(\)/.test(src) && !/useRequireRun\(\)/.test(src) && /router\.replace/.test(src)) {
    fail(`${f} uses useRun and redirects. It should use useRequireRun.`);
  }
}

/* ---- 2. numbers cut off, because a line height was too tight ---- */
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/fontSize:\s*([0-9.]+)/);
    if (!m) continue;
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      // A closing brace ends the style object. Anything past it belongs to
      // a different style and the two numbers have nothing to do with each
      // other, which is what made this rule cry wolf.
      if (lines[j].includes('}')) break;
      const lh = lines[j].match(/lineHeight:\s*([0-9.]+)/);
      if (!lh) continue;
      const ratio = Number(lh[1]) / Number(m[1]);
      if (ratio < 1.18) {
        fail(`${f}:${i + 1} font ${m[1]} in a ${lh[1]} line. Anything under 1.18 clips its own descenders.`);
      }
      break;
    }
  }
}

/* ---- 3. em dashes, which are not used anywhere in this product ---- */
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const lines = src.split(/\r?\n/);
  lines.forEach((l, i) => {
    // In a string that reaches a screen, not in a comment.
    if (l.includes('—') && !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//')) {
      fail(`${f}:${i + 1} has an em dash in code that can reach the screen.`);
    }
  });
}

/* ---- 4. a save whose shape is read but never checked ---- */
const store = readFileSync(join('src', 'save', 'dynasty.ts'), 'utf8');
if (!store.includes('version: 14')) {
  fail('src/save/dynasty.ts changed version. Every bump needs a migration, and check-save has to know about it.');
}

/* ---- 5. navigating without the guard, which opened pages twice ---- */
{
  const offenders = [];
  for (const f of walk('app').concat(walk('src'))) {
    if (f.endsWith(join('src', 'game', 'nav.ts'))) continue;
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/router\.(push|replace|navigate|dismissTo|dismissAll)\(/g)) {
      offenders.push(`${f} uses router.${m[1]}`);
    }
  }
  for (const o of offenders) {
    fail(`${o}. Everything navigates through src/game/nav.ts or the same page opens twice.`);
  }
}

/* ---- 6. a route that does not exist, which draws nothing at all ---- */
{
  const routes = new Set();
  for (const f of walk('app')) {
    if (!f.endsWith('.tsx')) continue;
    let r = f
      .slice('app'.length)
      .replace(/\\/g, '/')
      .replace(/\.tsx$/, '');
    if (r.endsWith('/index')) r = r.slice(0, -'/index'.length) || '/';
    if (r.endsWith('_layout')) continue;
    routes.add(r);
  }
  for (const f of walk('app').concat(walk('src'))) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\b(?:go|swap|upTo)\('(\/[^']*)'\)/g)) {
      const target = m[1].split('?')[0].replace(/\/$/, '') || '/';
      if (!routes.has(target)) {
        fail(`${f} navigates to ${m[1]}, and there is no screen at ${target}.`);
      }
    }
  }
}

/* ---- 7. a saved record whose version moved without a migration ---- */
{
  for (const f of walk(join('src', 'save'))) {
    const src = readFileSync(f, 'utf8');
    const v = src.match(/version:\s*(\d+)/);
    if (!v || Number(v[1]) <= 1) continue;
    if (!src.includes('migrations:')) {
      fail(`${f} is at version ${v[1]} with no migrations. An old save would be thrown away.`);
    }
  }
}

/* ---- 8. a setting that is stored and never read ---- */
{
  const settings = readFileSync(join('src', 'save', 'settings.ts'), 'utf8');
  const block = settings.match(/export type Settings = \{([\s\S]*?)\n\};/);
  if (block) {
    const keys = [...block[1].matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
    const everywhere = walk('app')
      .concat(walk('src'))
      .filter((f) => !f.endsWith(join('src', 'save', 'settings.ts')))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    for (const k of keys) {
      if (!everywhere.includes(k)) {
        fail(`settings.${k} is saved and nothing ever reads it. A switch that does nothing is worse than no switch.`);
      }
    }
  }
}

/* ---- 9. anything left behind that should not ship ---- */
{
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const lines = src.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/\bconsole\.(log|warn|error|debug)\s*\(/.test(l)) {
        fail(`${f}:${i + 1} logs to the console. Nothing in the app should.`);
      }
      if (/\b(TODO|FIXME|HACK)\b/.test(l) && !/placeholder=/.test(l)) {
        fail(`${f}:${i + 1} has a ${l.match(/\b(TODO|FIXME|HACK)\b/)[1]} in it.`);
      }
    }
  }
}

/* ---- 10. a mode you cannot get out of ---- */
{
  /* Back out of a hub reaches Home, because a hub is the front door of
     its mode. Going back to the screen that picked the side instead is
     how you end up looking at two of the same page. */
  for (const f of files) {
    if (!/hub\.tsx$/.test(f)) continue;
    const src = readFileSync(f, 'utf8');
    if (/onBack=\{\(\) => back\(\)\}/.test(src)) {
      fail(`${f} goes back rather than home. A hub is the front door of its mode.`);
    }
  }
}

/* ---- 11. a heading lower cased into a sentence ---- */
{
  /* "Champions League, top four" is a heading. It has a proper noun and a
     comma in it, and lower casing it gave "They would want you to
     champions league, top four", which is not English. Anything with two
     forms carries both rather than mangling one into the other. */
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(\w*(?:objective|heading|title)\w*)\.toLowerCase\(\)/gi)) {
      fail(`${f} lower cases ${m[1]}, which is a heading. Carry a clause instead.`);
    }
  }
}

/* ---- 12. an ordinary function called on the UI thread ---- */
{
  /* useAnimatedStyle runs its body on the UI thread as a worklet, and a
     worklet may only call other worklets. Calling a plain helper in
     there does not fail to compile, does not warn, and takes the whole
     app down on the device the moment the animation runs.

     It happened once, in the pack wrapper: alpha() built a glow colour
     inside the style, and the app crashed as soon as a pack was opened.
     Nothing on the page looked wrong.

     Colours are worked out on the JavaScript thread and handed in, and
     the worklet moves between them with interpolateColor, which is a
     worklet itself. */
  /* Written with indexOf rather than a regular expression on purpose:
     the escaping needed for a word boundary does not survive being
     passed through a shell, and a check that silently stops working is
     worse than no check. */
  const calls = (body, name) => {
    let i = body.indexOf(name);
    while (i >= 0) {
      const before = i === 0 ? ' ' : body[i - 1];
      const after = body.slice(i + name.length).trimStart()[0];
      const wordish = /[A-Za-z0-9_$.]/;
      if (!wordish.test(before) && after === '(') return true;
      i = body.indexOf(name, i + 1);
    }
    return false;
  };

  const HELPERS = [
    'alpha', 'clubColour', 'positionColor', 'rarityTint', 'wear',
    'lastName', 'cardValue', 'readable', 'shade', 'tintFor',
  ];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    let at = 0;
    for (;;) {
      const start = src.indexOf('useAnimatedStyle(', at);
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
      const body = src.slice(start, end);
      for (const h of HELPERS) {
        if (calls(body, h)) {
          const line = src.slice(0, start).split(String.fromCharCode(10)).length;
          fail(
            f + ':' + line + ' calls ' + h + '() inside useAnimatedStyle. ' +
            'That runs on the UI thread and will crash. Work the value out above and pass it in.',
          );
        }
      }
      at = end;
    }
  }
}

/* ---- 13. a check script quietly broken by a stray control character ---- */
{
  /* This has happened three times and each time it disabled a rule
     silently. Writing a regular expression through a shell can turn the
     two characters backslash b into one backspace character. The file
     still parses, the regex still runs, and it matches nothing ever
     again, so the rule reports success forever.

     Nothing in this project should contain a raw control character, so
     any of them is that fault or something equally wrong. */
  const BAD = [7, 8, 11, 12];
  const NAMES = { 7: 'bell', 8: 'backspace', 11: 'vertical tab', 12: 'form feed' };
  const scripts = readdirSync('scripts').filter((n) => n.endsWith('.mjs'));

  for (const name of [...scripts.map((n) => 'scripts/' + n), ...files]) {
    const src = readFileSync(name, 'utf8');
    for (const c of BAD) {
      const at = src.indexOf(String.fromCharCode(c));
      if (at >= 0) {
        const line = src.slice(0, at).split(String.fromCharCode(10)).length;
        fail(
          `${name}:${line} contains a raw ${NAMES[c]} character. That is usually a regular expression whose backslash was eaten, which makes the rule match nothing and pass forever.`,
        );
      }
    }
  }
}

/* ---- 14. a modal that cannot turn, and a size read once ---- */
{
  /* React Native defaults a modal's supportedOrientations to portrait
     alone. On a phone that is invisible, because the app is portrait
     anyway. On an iPad held sideways the modal comes up rotated in a
     squeezed window while everything behind it stays landscape, which is
     what happened to the player card. All five modals in the app had it
     and none of them looked wrong. */
  /* Comments are blanked before looking, because the word appears in the
     note explaining why the prop is there. Without this, deleting the
     prop and leaving the comment passed, which is exactly the shape of
     edit somebody makes. */
  /* Comments are blanked before looking, because the word appears in the
     note explaining why the prop is there. Without this, deleting the
     prop and leaving the comment passed, which is exactly the shape of
     edit somebody makes.

     Walked character by character rather than matched with a regular
     expression: the escape for a newline does not survive being written
     through a shell, and a stripper that silently stops working takes

  for (const f of files) {
    const src = noComments(readFileSync(f, 'utf8'));
    let at = 0;
    for (;;) {
      const i = src.indexOf('<Modal', at);
      if (i < 0) break;
      const end = src.indexOf('>', i);
      const tag = src.slice(i, end < 0 ? src.length : end);
      if (!tag.includes('supportedOrientations')) {
        const line = src.slice(0, i).split(String.fromCharCode(10)).length;
        fail(
          `${f}:${line} opens a Modal without supportedOrientations, so it is portrait only and comes up rotated on an iPad held sideways.`,
        );
      }
      at = i + 6;
    }
  }

  /* Dimensions.get reads the window once and never hears about a
     rotation. useWindowDimensions re-renders. On a phone locked to
     portrait the two are the same thing, which is exactly why the wrong
     one survives until a tablet turns. */
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const lines = src.split(String.fromCharCode(10));
    lines.forEach((l, i) => {
      if (l.includes('Dimensions.get(') && !l.trimStart().startsWith('*')) {
        fail(
          `${f}:${i + 1} reads Dimensions.get, which is measured once and never updates when an iPad is turned. Use useWindowDimensions.`,
        );
      }
    });
  }
}

/* ---- 15. the colour behind the screens ---- */
{
  /* Navigation keeps its own theme, and without one it uses the light
     default whose background is rgb(242, 242, 242). That colour sits
     under every screen, invisible until something moves and shows an
     edge of it, which is what the white border was for five attempts.

     Painting the root view, the gesture root or the safe area provider
     does not reach it, because the navigation container is its own layer
     inside all of them. */
  const layout = readFileSync(join('app', '_layout.tsx'), 'utf8');
  if (!layout.includes('<ThemeProvider')) {
    fail('app/_layout.tsx sets no navigation theme, so the colour behind every screen is the light default, rgb(242, 242, 242).');
  }
  if (!layout.includes('background: color.bg')) {
    fail('app/_layout.tsx has a navigation theme whose background is not the app ground, so a light strip can show behind a moving screen.');
  }
}

/* ---- 16. a share sheet with nothing to point at ---- */
{
  /* On a phone the share sheet slides up from the bottom and where it
     came from does not arise. On an iPad it is a popover, and given
     nothing to point at iOS puts it in a corner with its arrow aimed at
     empty space, which reads as a bug in the app. src/ui/share.ts hands
     it the button that opened it, and is the only place allowed to call
     the sheet directly. */
  for (const f of files) {
    if (f.endsWith(join('src', 'ui', 'share.ts'))) continue;
    const src = readFileSync(f, 'utf8');
    if (src.includes('Share.share(')) {
      fail(`${f} opens a share sheet directly. Use shareFrom from src/ui/share.ts, which gives it something to point at on an iPad.`);
    }
    if (src.includes('Sharing.shareAsync(') && !src.includes('anchorRect')) {
      fail(`${f} shares a file without an anchor, so the sheet points at nothing on an iPad.`);
    }
  }
}

/* ---- 17. a scroll view that eats the first tap after typing ---- */
{
  /* A ScrollView dismisses the keyboard on a tap and does not pass it on,
     so after typing a duel code the first press on Play does nothing, and
     after searching for a club the first tap on it does nothing. Every
     screen with a field had this and none of them looked wrong.

     "handled" keeps the tap for anything that can take it and still
     dismisses the keyboard when it lands on nothing.

     Applied everywhere rather than only where a field exists today: a
     field added later to a screen without it brings the bug back
     silently. */
  for (const f of files) {
    const src = noComments(readFileSync(f, 'utf8'));
    for (const tag of ['<ScrollView', '<FlashList']) {
      let at = 0;
      for (;;) {
        const i = src.indexOf(tag, at);
        if (i < 0) break;
        /* a type argument, not an element: useRef<ScrollView> */
        const before = src.slice(Math.max(0, i - 12), i);
        if (before.includes('useRef') || before.includes('RefObject')) {
          at = i + 1;
          continue;
        }
        const end = src.indexOf('>', i);
        const head = src.slice(i, end < 0 ? src.length : end);
        if (!head.includes('keyboardShouldPersistTaps')) {
          const line = src.slice(0, i).split(String.fromCharCode(10)).length;
          fail(
            `${f}:${line} scrolls without keyboardShouldPersistTaps, so the first tap after typing is swallowed instead of reaching what it hit.`,
          );
        }
        at = (end < 0 ? i : end) + 1;
      }
    }
  }
}

/* ---- 18. work done on a state that is only a moment ---- */
{
  /* On iOS 'inactive' is not a state the app rests in, it is a moment:
     the app switcher, control centre, any system alert, a notification
     pulled down, and briefly during launch. Doing real work on it means
     doing that work every time somebody glances away.

     Backing up on it froze the app. A snapshot reads every store and
     turns the lot into JSON, JSON.stringify is synchronous, and flicking
     in and out queued several at once on the same thread. */
  const layout = noComments(readFileSync(join('app', '_layout.tsx'), 'utf8'));
  /* A wide window on purpose. Comments are blanked rather than removed,
     so the note explaining this very rule still occupies its own length
     in the text, and a short window stopped before reaching the code it
     was meant to read. */
  const m = layout.match(/AppState\.addEventListener\([\s\S]{0,1600}/);
  if (m && m[0].includes('inactive')) {
    fail(
      "app/_layout.tsx does work on the 'inactive' app state. On iOS that fires for the app switcher, control centre and any system alert, so the work happens every time somebody glances away. Use 'background', which is the app actually leaving.",
    );
  }
}

/* ---- 19. a start that can fail, and an answer thrown away ---- */
{
  /* startUclFromDynasty returns null when the career has fewer than
     eleven starters, and the screen ignored it: the campaign never
     began, the code navigated anyway, the next screen found no run and
     offered to pick somebody else's club. A career with one empty shirt
     was quietly told to abandon its own.

     Anything that can answer null has to be asked. */
  const CAN_FAIL = ['startUclFromDynasty', 'startWorldCupFromDynasty', 'startCupFromDynasty'];
  for (const f of files) {
    const src = noComments(readFileSync(f, 'utf8'));
    const lines = src.split(String.fromCharCode(10));
    lines.forEach((l, i) => {
      for (const fn of CAN_FAIL) {
        const at = l.indexOf(fn + '(');
        if (at < 0) continue;
        const lead = l.slice(0, at);
        /* the declaration itself, or an import of it, is not a call */
        if (lead.includes('import') || lead.includes('function') || lead.includes('export')) {
          continue;
        }
        const before = l.slice(0, at);
        /* assigned, returned or tested: the answer is being used */
        if (/[=(]\s*$|return\s*$|!\s*$/.test(before.trimEnd() + ' '.repeat(0)) ||
            before.includes('=') || before.includes('return') || before.includes('!')) {
          continue;
        }
        fail(
          `${f}:${i + 1} calls ${fn} and throws the answer away. It returns null when the squad cannot field a side, and ignoring that sends somebody to a screen with nothing on it.`,
        );
      }
    });
  }
}

/* ---- 20. the two things Apple refused the first build for ---- */
{
  /* Both were config rather than gameplay, and both were invisible on a
     phone. They cost a review cycle, so each one gets a rule. */

  const cfg = readFileSync('app.config.js', 'utf8');

  /* expo-audio declares the "audio" background mode unless it is told
     not to. That tells iOS the app keeps playing when it is not on
     screen. This one plays a tick when you pick a player. A reviewer
     checked, heard silence, and refused it under guideline 2.5.4. */
  const audio = cfg.match(/'expo-audio'[\s\S]{0,400}/);
  if (!audio || !/enableBackgroundPlayback:\s*false/.test(audio[0])) {
    fail(
      'app.config.js must pass enableBackgroundPlayback: false to expo-audio. Without it the build claims the audio background mode it does not use, which is guideline 2.5.4 and a rejection.',
    );
  }

  /* The tracking sheet cannot be presented while the splash is up. iOS
     does not say so: the call returns undetermined and nothing appears.
     Asking from an effect with no dependencies asks too early, once, and
     never again. Guideline 2.1, rejected. */
  const layout = readFileSync('app/_layout.tsx', 'utf8');
  const at = layout.indexOf('startAds()');
  if (at < 0) {
    fail('app/_layout.tsx no longer starts the adverts, so nothing ever asks about tracking.');
  } else {
    const around = layout.slice(Math.max(0, at - 400), at + 200);
    if (!/ready\s*\|\|\s*error/.test(around)) {
      fail(
        'app/_layout.tsx calls startAds without waiting for the splash to come down. iOS will not show the tracking sheet over a splash screen and does not report that it refused, so the app declares App Tracking Transparency and never asks. Guideline 2.1, and a rejection.',
      );
    }
  }

  /* And the ask itself has to survive the sheet not appearing. */
  const ads = readFileSync('src/game/ads.ts', 'utf8');
  if (!/AppState/.test(ads)) {
    fail(
      'src/game/ads.ts must wait for the app to be active before asking about tracking. iOS silently declines to present the sheet otherwise.',
    );
  }
}

console.log(
  failures ? `\n${failures} problems.\n` : '\nEvery source rule holds.\n',
);
process.exit(failures ? 1 : 0);
