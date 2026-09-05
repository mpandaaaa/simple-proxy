/*
 * The engine, packaged for the server that checks runs.
 *
 * Supabase edge functions run on Deno, which loads ES modules and wants
 * every relative import to name the file it means, extension and all.
 * TypeScript writes ES modules happily and writes those imports without
 * an extension, because that is what bundlers expect. So the gap between
 * the two is one rewrite, done here, rather than a bundler added to the
 * project for the sake of it.
 *
 * The point of doing this at all is that the server must check a run
 * with the same code that played it. Not a translation, not a
 * reimplementation in SQL, the same functions. Anything else drifts, and
 * the day it drifts an honest player is told their season did not happen.
 *
 *     node scripts/build-edge.mjs
 *
 * It is run by npm run edge, and npm run leaderboard checks the output is
 * in step with the source rather than left behind by it.
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, writeFileSync, statSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join('supabase', 'functions', '_engine');

/* Start clean, so a file deleted from src can never linger on the server. */
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

console.log('compiling the engine as ES modules');
/* The compiler is called by its own path rather than through npx. On
   Windows spawning npx.cmd fails outright with EINVAL, and there is no
   reason to go through a launcher to reach a file we already have. */
const require_ = createRequire(import.meta.url);
const tsc = require_.resolve('typescript/lib/tsc.js');
execFileSync(process.execPath, [tsc, '-p', 'tsconfig.edge.json'], { stdio: 'inherit' });

/* ---- name every relative import, the way Deno needs ---- */

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

/*
 * Only the specifier is touched, and only when it starts with a dot and
 * has no extension already. A bare import like 'node:fs' is left alone,
 * and so is anything that already names a file.
 */
const RELATIVE = /(\bfrom\s*|\bimport\s*\(\s*)(['"])(\.[^'"]*)\2/g;

let rewritten = 0;
const files = walk(OUT);

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const next = src.replace(RELATIVE, (whole, lead, q, spec) => {
    if (/\.[a-z]+$/i.test(spec)) return whole;
    rewritten++;
    return lead + q + spec + '.js' + q;
  });
  if (next !== src) writeFileSync(f, next);
}

console.log(`  ${files.length} files, ${rewritten} imports named`);
console.log(`  written to ${OUT}`);
