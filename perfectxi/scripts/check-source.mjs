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
if (!store.includes('version: 13')) {
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

console.log(
  failures ? `\n${failures} problems.\n` : '\nEvery source rule holds.\n',
);
process.exit(failures ? 1 : 0);
