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
if (!store.includes('version: 5')) {
  fail('src/save/dynasty.ts changed version. Every bump needs a migration, and check-save has to know about it.');
}

console.log(
  failures ? `\n${failures} problems.\n` : '\nEvery source rule holds.\n',
);
process.exit(failures ? 1 : 0);
