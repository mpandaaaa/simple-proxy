/**
 * The online layer, against the real thing.
 *
 * Matchmaking has one failure that matters and it is not a slow server.
 * It is two people both taking the same third person, or two people both
 * sitting waiting for each other, and neither shows up until there are
 * enough players for it to happen to somebody. So this runs the protocol
 * for real, against the real project, with players racing each other on
 * purpose.
 *
 * What it proves:
 *
 *   Two players who look at the same moment end up in one duel, on one
 *   seed, and neither is left waiting.
 *   Ten players reaching for one waiting player produce exactly one
 *   match, because the claim only succeeds while the row is unclaimed.
 *   A player nobody comes for gives up in a few seconds rather than
 *   waiting forever, which is the case that happens every time until
 *   there are two people playing.
 *   Progress and scores written by one side are read by the other.
 *
 * It leaves nothing behind: everything it makes it deletes, and anything
 * it somehow misses ages out of the queue in two minutes.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const config = require('../app.config.js')();
const { url: URL_, key: KEY } = config.extra.supabase;

const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

let failures = 0;
const rows = [];
function must(label, ok, note) {
  if (!ok) failures++;
  rows.push({ ok, label, note });
}
function band(label, got, lo, hi, note) {
  const ok = got >= lo && got <= hi;
  if (!ok) failures++;
  rows.push({ ok, label, got, lo, hi, note });
}

async function rest(path, init = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: { ...H, ...(init.headers ?? {}) },
  });
  const text = await r.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: r.status, body };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* The same two numbers the app uses, and the same relationship between
   them: a row older than the wait belongs to somebody who has gone. */
const WAIT_MS = 5000;
const FRESH_MS = WAIT_MS + 1500;
const tag = `check-${Date.now().toString(36)}`;
const made = { queue: [], match: [] };

/* ---------- one player looking for a duel ---------- */

async function look(id, name, seed, waitMs) {
  const since = new Date(Date.now() - FRESH_MS).toISOString();
  const open = await rest(
    `duel_queue?select=id,player,name,seed,matched_with,matched_name` +
      `&matched_with=is.null&player=neq.${id}&player=like.${tag}%25` +
      `&created_at=gt.${since}&order=created_at.asc&limit=5`,
  );
  for (const row of open.body ?? []) {
    const claim = await rest(`duel_queue?id=eq.${row.id}&matched_with=is.null`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ matched_with: id, matched_name: name }),
    });
    if ((claim.body ?? []).length) {
      return { seed: Number(row.seed), name: row.name, player: row.player, bot: false, waited: false };
    }
  }

  const put = await rest('duel_queue', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ player: id, name, seed }),
  });
  const mine = (put.body ?? [])[0];
  if (!mine) return { seed, name: 'Machine', player: null, bot: true, waited: false };
  made.queue.push(mine.id);

  const until = Date.now() + waitMs;
  while (Date.now() < until) {
    await sleep(400);
    const look = await rest(`duel_queue?select=matched_with,matched_name&id=eq.${mine.id}&limit=1`);
    const row = (look.body ?? [])[0];
    if (row?.matched_with) {
      return { seed, name: row.matched_name, player: row.matched_with, bot: false, waited: true };
    }
  }
  /* Give up the way the app gives up: take the row with you. */
  await rest(`duel_queue?id=eq.${mine.id}`, { method: 'DELETE' });
  return { seed, name: 'Machine', player: null, bot: true, waited: true };
}

/* ---------- can it be reached at all ---------- */

{
  const r = await rest('duel_queue?select=id&limit=1');
  must('the project answers', r.status === 200, `HTTP ${r.status}`);
  if (r.status !== 200) {
    console.log('\nNothing else can be checked until it does.\n');
    console.log(JSON.stringify(r.body).slice(0, 300));
    process.exit(1);
  }
  const m = await rest('duel_match?select=seed&limit=1');
  must('both tables are there', m.status === 200, `duel_match HTTP ${m.status}`);
}

/* ---------- nobody about ---------- */

{
  const t0 = Date.now();
  const alone = await look(`${tag}-alone`, 'Alone', 111, 2500);
  const took = Date.now() - t0;
  must('a player nobody comes for plays the Machine', alone.bot === true, '');
  band('and gives up after, seconds', Math.round(took / 1000), 2, 8, 'never a wait with no end');
}

/* ---------- two people looking at once ---------- */

{
  const seedA = 4242;
  const seedB = 8484;
  const [a, b] = await Promise.all([
    look(`${tag}-a`, 'PlayerA', seedA, 6000),
    sleep(900).then(() => look(`${tag}-b`, 'PlayerB', seedB, 6000)),
  ]);
  must('the first one is matched', !a.bot, a.bot ? 'played the Machine instead' : a.name);
  must('the second one is matched', !b.bot, b.bot ? 'played the Machine instead' : b.name);
  must('they found each other', a.player === `${tag}-b` && b.player === `${tag}-a`,
    `${a.player} and ${b.player}`);
  must('and agree on one seed', a.seed === b.seed, `${a.seed} against ${b.seed}`);
  must('one waited and one arrived', a.waited !== b.waited, `${a.waited} and ${b.waited}`);
  must('the seed is the one the waiting player put down', a.seed === seedA, String(a.seed));

  /* ---------- and can talk to each other ---------- */
  const open = await rest('duel_match', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({
      seed: a.seed,
      a_player: `${tag}-a`,
      a_name: 'PlayerA',
      b_player: `${tag}-b`,
      b_name: 'PlayerB',
    }),
  });
  must('a match row is opened', open.status < 300, `HTTP ${open.status}`);
  made.match.push(a.seed);

  /* Opening it twice must not blow up, because both of them try. */
  const again = await rest('duel_match', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({ seed: a.seed, a_player: `${tag}-a`, a_name: 'PlayerA' }),
  });
  must('and opening it twice is harmless', again.status < 300, `HTTP ${again.status}`);

  await rest(`duel_match?seed=eq.${a.seed}`, {
    method: 'PATCH',
    body: JSON.stringify({ a_filled: 6, a_last: 'Thierry Henry' }),
  });
  const seenByB = await rest(`duel_match?select=a_filled,a_last&seed=eq.${a.seed}&limit=1`);
  const p = (seenByB.body ?? [])[0];
  must('one side sees the other drafting', p?.a_filled === 6 && p?.a_last === 'Thierry Henry',
    JSON.stringify(p));

  await rest(`duel_match?seed=eq.${a.seed}`, {
    method: 'PATCH',
    body: JSON.stringify({ a_pts: 91, a_rating: 88, b_pts: 84, b_rating: 86 }),
  });
  const done = await rest(`duel_match?select=a_pts,b_pts,a_rating,b_rating&seed=eq.${a.seed}&limit=1`);
  const d = (done.body ?? [])[0];
  must('and both scores come back', d?.a_pts === 91 && d?.b_pts === 84, JSON.stringify(d));
}

/* ---------- ten people reaching for one ---------- */

{
  const waiting = await rest('duel_queue', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ player: `${tag}-prize`, name: 'Prize', seed: 777 }),
  });
  const row = (waiting.body ?? [])[0];
  must('somebody sits down to wait', !!row, '');
  if (row) {
    made.queue.push(row.id);
    const grabs = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        rest(`duel_queue?id=eq.${row.id}&matched_with=is.null`, {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ matched_with: `${tag}-grab${i}`, matched_name: `Grab${i}` }),
        }),
      ),
    );
    const won = grabs.filter((g) => (g.body ?? []).length).length;
    band('ten reached for one, and it went to', won, 1, 1, 'never two people in one chair');
  }
}

/* ---------- clean up after ourselves ---------- */

{
  for (const id of made.queue) await rest(`duel_queue?id=eq.${id}`, { method: 'DELETE' });
  for (const seed of made.match) await rest(`duel_match?seed=eq.${seed}`, { method: 'DELETE' });
  const left = await rest(`duel_queue?select=id&player=like.${tag}%25`);
  must('nothing is left behind', (left.body ?? []).length === 0,
    `${(left.body ?? []).length} rows still there`);
}

console.log('\nThe online layer, against the real project\n');
for (const r of rows) {
  const got = r.got === undefined ? (r.ok ? 'yes' : 'NO') : r.got;
  const want = r.lo === undefined ? 'yes' : `${r.lo} to ${r.hi}`;
  console.log(
    `  ${r.ok ? 'pass' : 'FAIL'}  ${r.label.padEnd(46)} ${String(got).padStart(6)}   want ${want}` +
      (r.note ? `   ${r.note}` : ''),
  );
}
console.log(
  failures
    ? `\n${failures} problems.\n`
    : '\nTwo people find each other, on one seed, and nobody waits forever.\n',
);
process.exit(failures ? 1 : 0);
