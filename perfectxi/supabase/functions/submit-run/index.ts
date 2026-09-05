/*
 * The only thing that may write to the leaderboard.
 *
 * A phone sends the run it played. This replays it with the same engine
 * that played it, and writes a row only if the season it produces is the
 * season the phone claims. Nothing the phone says about its score, its
 * players or their ratings is ever stored: every number in the row is
 * one this function worked out for itself.
 *
 * The database refuses writes from anybody else. There is no insert
 * policy on the table at all, which with row level security on means no
 * client can write to it whatever key they hold. This function uses the
 * service role, and it is the only thing that does.
 *
 * Deployed with:
 *
 *     npm run edge                                 packages the engine
 *     npx supabase functions deploy submit-run     sends it up
 *
 * The engine under _engine is generated. It is never edited by hand: it
 * is the same code the app runs, compiled, so the two can never drift
 * into disagreeing about what a season does.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { dailyFor, verifySubmission } from '../_engine/engine/index.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Only the characters that can actually be seen.
 *
 * Written by code point rather than as a regular expression on purpose.
 * A character class for the control range is exactly the kind of pattern
 * that gets mangled passing through a shell or an editor, and a mangled
 * one here reads as a range of ordinary punctuation and quietly deletes
 * the wrong things. This cannot be misread.
 */
function printable(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x20 || c === 0x7f) continue;          // control characters
    if (c >= 0x200b && c <= 0x200f) continue;      // zero width and direction marks
    if (c >= 0x202a && c <= 0x202e) continue;      // direction overrides
    out += ch;
  }
  return out;
}

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

/**
 * The puzzle a board name refers to.
 *
 * The seed and the rules come from the board's own number, never from
 * the submission. A phone that could choose its own config could choose
 * an easy one and beat everybody honestly.
 */
function puzzleFor(board: string): { seed: number; config: unknown } | null {
  const m = /^daily-(\d{1,7})$/.exec(board);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isInteger(n) || n < 1) return null;
  const puzzle = dailyFor(n);
  return { seed: puzzle.seed, config: puzzle.config };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { ok: false, why: 'method' });

  let sub: Record<string, unknown>;
  try {
    sub = await req.json();
  } catch {
    return reply(400, { ok: false, why: 'shape' });
  }

  /* ---- the cheap refusals, before any work is done ---- */

  const board = typeof sub.board === 'string' ? sub.board : '';
  const player = typeof sub.player === 'string' ? sub.player : '';
  const handleRaw = typeof sub.handle === 'string' ? sub.handle : '';

  if (!board || board.length > 40) return reply(400, { ok: false, why: 'board' });
  if (!player || player.length > 64) return reply(400, { ok: false, why: 'player' });

  /*
   * The handle is the one piece of free text on the whole board, so it is
   * the one thing that could carry something nobody wants to read. It is
   * trimmed, capped at the length the app allows, and stripped of
   * anything that is not printable. Whether it is a name somebody should
   * be allowed is not decidable here and is not attempted.
   */
  const handle = printable(handleRaw).trim().slice(0, 18);
  if (!handle) return reply(400, { ok: false, why: 'handle' });

  const puzzle = puzzleFor(board);
  if (!puzzle) return reply(400, { ok: false, why: 'board' });

  /* ---- and then the run itself, replayed ---- */

  let verdict;
  try {
    verdict = verifySubmission(
      sub as never,
      puzzle.seed,
      puzzle.config as never,
    );
  } catch (e) {
    /* A submission shaped badly enough to break the replay is refused
       rather than allowed to take the function down. */
    return reply(400, { ok: false, why: 'shape' });
  }

  if (!verdict.ok) return reply(400, { ok: false, why: verdict.why });

  /* ---- one row per player per board, and only if it is better ---- */

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  const row = {
    board,
    player,
    handle,
    pts: verdict.pts,
    gf: verdict.gf,
    ga: verdict.ga,
    rating: verdict.rating,
    engine: (sub as { engine: number }).engine,
    picks: sub.picks,
  };

  /*
   * A Daily is one attempt, so in practice this only ever inserts. The
   * upsert is here so that a submission lost to a dead network and sent
   * again does not fail, and so a second attempt can never replace a
   * better first one with a worse one.
   */
  const { data: existing } = await db
    .from('leaderboard')
    .select('pts, gf, ga')
    .eq('board', board)
    .eq('player', player)
    .maybeSingle();

  const better =
    !existing ||
    verdict.pts > existing.pts ||
    (verdict.pts === existing.pts &&
      verdict.gf - verdict.ga > existing.gf - existing.ga);

  if (!better) return reply(200, { ok: true, kept: 'existing' });

  const { error } = await db
    .from('leaderboard')
    .upsert(row, { onConflict: 'board,player' });

  if (error) return reply(500, { ok: false, why: 'store' });

  return reply(200, {
    ok: true,
    pts: verdict.pts,
    gf: verdict.gf,
    ga: verdict.ga,
    rating: verdict.rating,
  });
});
