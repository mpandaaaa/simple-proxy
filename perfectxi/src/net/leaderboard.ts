import { supabase, net } from './client';
import { ENGINE_VERSION, type SubmittedPick } from '../engine';

/**
 * The board, from the phone's side.
 *
 * Two calls. One sends a finished run to be checked, one asks what a
 * board says. Neither is ever required for the game to work: a Daily is
 * played, scored and remembered entirely on the device, and this is
 * something that happens afterwards if there is a connection.
 *
 * The phone cannot write to the table. It has no permission to, by
 * design, so submitting means asking a function on the server to replay
 * the run and decide for itself. That is the whole reason the board is
 * worth looking at: nothing on it is a number somebody typed.
 *
 * Nothing here throws and nothing here blocks. A submission that fails
 * is a submission that failed, and the player still has their season.
 */

export type BoardRow = {
  handle: string;
  pts: number;
  gf: number;
  ga: number;
  rating: number;
  /** true when this row is the person looking at it */
  you: boolean;
};

export type SubmitResult =
  | { ok: true; pts: number; rating: number }
  /** refused, with the reason the server gave, for telling the player */
  | { ok: false; why: string };

/**
 * Is there a board on the other end at all?
 *
 * Asked before a way in to it is offered. A button that leads to
 * "no connection" every single time is not an online feature having a
 * bad day, it is a feature that does not work, and it is the kind of
 * thing an App Store reviewer taps first.
 *
 * So the way in appears only once this has said yes. If the table is not
 * there, or the connection is not, nobody is offered a door that opens
 * onto nothing, and the game is exactly what it was before: a Daily
 * played, scored and kept on the phone.
 *
 * The cheapest question there is: how many rows, without fetching any.
 */
export async function boardLive(): Promise<boolean> {
  const got = await net(
    (db) => db.from('leaderboard').select('player', { count: 'exact', head: true }).limit(1),
    5000,
  );
  return Boolean(got && !(got as { error?: unknown }).error);
}

/** The name of the board a Daily belongs to. */
export function dailyBoard(n: number): string {
  return `daily-${n}`;
}

/**
 * Send a finished run to be checked.
 *
 * The score is sent, but only so the server can disagree with it. Every
 * number that ends up on the board is one the server worked out by
 * replaying the picks, so there is nothing to gain by sending a better
 * one than was scored.
 */
export async function submitRun(input: {
  board: string;
  player: string;
  handle: string;
  picks: SubmittedPick[];
  pts: number;
  gf: number;
  ga: number;
}): Promise<SubmitResult> {
  const db = supabase();
  if (!db) return { ok: false, why: 'offline' };

  const body = {
    board: input.board,
    engine: ENGINE_VERSION,
    player: input.player,
    handle: input.handle,
    picks: input.picks,
    claim: { pts: input.pts, gf: input.gf, ga: input.ga },
  };

  const got = await net(
    (client) => client.functions.invoke('submit-run', { body }),
    9000,
  );

  if (!got) return { ok: false, why: 'offline' };
  if (got.error) return { ok: false, why: 'offline' };

  const data = got.data as { ok?: boolean; why?: string; pts?: number; rating?: number } | null;
  if (!data || !data.ok) return { ok: false, why: data?.why ?? 'refused' };

  return { ok: true, pts: data.pts ?? input.pts, rating: data.rating ?? 0 };
}

/**
 * What a board says, best first.
 *
 * Ordered on the server so every phone sees the same order, including
 * the way a tie is broken: points, then goal difference, then goals
 * scored, then whoever got there first. A tie broken differently on two
 * phones is a bug somebody will notice and nobody can explain.
 */
export async function fetchBoard(
  board: string,
  me: string,
  limit = 50,
): Promise<BoardRow[] | null> {
  const got = await net(
    (db) =>
      db
        .from('leaderboard')
        .select('handle, pts, gf, ga, rating, player')
        .eq('board', board)
        .eq('engine', ENGINE_VERSION)
        .order('pts', { ascending: false })
        .order('gf', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(limit),
    7000,
  );

  if (!got || got.error || !got.data) return null;

  const rows = got.data as {
    handle: string; pts: number; gf: number; ga: number; rating: number; player: string;
  }[];

  /*
   * Goal difference is worked out here rather than asked for, because it
   * is not a column: ordering by it would mean an expression in the
   * query, and the two would then have to agree. Points and goals scored
   * come from the server already sorted, and this only settles rows that
   * are level on both.
   */
  return rows
    .slice()
    .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf)
    .map((r) => ({
      handle: r.handle,
      pts: r.pts,
      gf: r.gf,
      ga: r.ga,
      rating: r.rating,
      you: r.player === me,
    }));
}

/**
 * Where somebody came, out of how many.
 *
 * Counted rather than read off the list, because the list is capped and
 * the person asking may be below the cap.
 */
export async function myPlace(
  board: string,
  me: string,
): Promise<{ place: number; of: number } | null> {
  const mine = await net(
    (db) =>
      db
        .from('leaderboard')
        .select('pts')
        .eq('board', board)
        .eq('engine', ENGINE_VERSION)
        .eq('player', me)
        .maybeSingle(),
    6000,
  );
  if (!mine || mine.error || !mine.data) return null;
  const pts = (mine.data as { pts: number }).pts;

  const ahead = await net(
    (db) =>
      db
        .from('leaderboard')
        .select('player', { count: 'exact', head: true })
        .eq('board', board)
        .eq('engine', ENGINE_VERSION)
        .gt('pts', pts),
    6000,
  );
  const total = await net(
    (db) =>
      db
        .from('leaderboard')
        .select('player', { count: 'exact', head: true })
        .eq('board', board)
        .eq('engine', ENGINE_VERSION),
    6000,
  );

  if (!ahead || !total) return null;
  return {
    place: ((ahead as { count: number | null }).count ?? 0) + 1,
    of: (total as { count: number | null }).count ?? 0,
  };
}
