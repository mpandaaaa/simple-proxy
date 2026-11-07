/**
 * Loads the original web game's main script into a Node vm with a fake
 * browser around it, so its real functions and data can be called from Node.
 *
 * Used for two things:
 *   1. extract-db.mjs reads the finished data tables out of it.
 *   2. The parity tests run the original engine next to the port and
 *      require identical results.
 *
 * Nothing here ships in the app.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const WEB_DIR = path.resolve(here, '../../source/web');

/** An object that absorbs any DOM call: every property and call returns itself. */
function blackhole() {
  const target = function () {};
  const p = new Proxy(target, {
    get(_t, k) {
      if (k === Symbol.toPrimitive) return () => '';
      if (k === Symbol.iterator) return function* () {};
      if (k === 'length') return 0;
      if (k === 'then') return undefined; // never look like a promise
      if (k === 'toString' || k === 'valueOf') return () => '';
      return p;
    },
    set() { return true; },
    apply() { return p; },
    construct() { return p; },
    has() { return true; },
  });
  return p;
}

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

/** Pull the inline <script> that defines `var SQUADS=` out of index.html. */
export function mainScriptSource() {
  const html = fs.readFileSync(path.join(WEB_DIR, 'index.html'), 'utf8');
  const start = html.indexOf('var SQUADS=');
  if (start < 0) throw new Error('index.html: could not find var SQUADS=');
  const open = html.lastIndexOf('<script>', start);
  const close = html.indexOf('</script>', start);
  if (open < 0 || close < 0) throw new Error('index.html: main script tags not found');
  return html.slice(open + '<script>'.length, close);
}

/**
 * Create a sandbox with the web game loaded.
 * @param {{ random?: () => number }} opts  replace Math.random for determinism
 */
export function loadWebGame(opts = {}) {
  const doc = blackhole();
  const sandbox = {
    console,
    document: doc,
    navigator: { userAgent: 'node', vibrate: () => false, standalone: false },
    location: { protocol: 'http:', hostname: 'localhost', href: 'http://localhost/', search: '', hash: '' },
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage(),
    // Timers never fire: nothing should run behind the test's back.
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    getComputedStyle: () => blackhole(),
    addEventListener: () => {},
    removeEventListener: () => {},
    scrollTo: () => {},
    alert: () => {},
    confirm: () => false,
    prompt: () => null,
    fetch: () => Promise.reject(new Error('no network in sandbox')),
    performance: { now: () => 0 },
    Image: function () { return blackhole(); },
    AudioContext: undefined,
    webkitAudioContext: undefined,
    name: '',
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 3,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  const ctx = vm.createContext(sandbox);
  if (opts.random) {
    vm.runInContext('Math.random = __rnd;', Object.assign(ctx, { __rnd: opts.random }));
  }
  vm.runInContext(mainScriptSource(), ctx, { filename: 'web/index.html#main' });
  return ctx;
}
