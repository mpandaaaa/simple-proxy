import { net } from './client';
import type { Match } from './lobby';
import type { H2HPick, Side } from '../engine';

/**
 * Two phones drafting off one board.
 *
 * They never send each other a state. They send picks, numbered, into an
 * append only list, and each of them rebuilds the whole match from the
 * seed and the list. That is the only design that survives a phone going
 * through a tunnel: a device that missed four picks catches up completely
 * on the next read, and there is no such thing as the two of them
 * disagreeing about whose turn it is, because neither of them is telling
 * the other whose turn it is.
 *
 * The pick number is the primary key, so two writes of pick eleven cannot
 * both land. That is what makes the shot clock safe: when somebody's time
 * runs out, both phones work out the same forced pick and both try to
 * write it, and exactly one of them succeeds. Either way the match moves
 * on and both of them see the same thing.
 */

export type NetPick = { n: number; side: Side; name: string; slot: number };

/**
 * Put a pick on the list.
 *
 * True when it landed, false when somebody else got there first with that
 * number, which is not an error: it means the match has already moved on
 * and the next read will say how.
 */
export async function sendPick(match: Match, pick: NetPick): Promise<boolean> {
  if (match.bot) return true;
  const got = await net(
    (db) =>
      db.from('duel_pick').insert({
        seed: match.seed,
        n: pick.n,
        side: pick.side,
        name: pick.name,
        slot: pick.slot,
      }),
    6000,
  );
  if (!got) return false;
  return !(got as { error?: unknown }).error;
}

/** Every pick made in this match so far, in order. */
export async function fetchPicks(match: Match): Promise<H2HPick[] | null> {
  if (match.bot) return null;
  const got = await net(
    (db) =>
      db
        .from('duel_pick')
        .select('n, side, name, slot')
        .eq('seed', match.seed)
        .order('n', { ascending: true }),
    5000,
  );
  const data = (got as { data?: NetPick[] } | null)?.data;
  if (!data) return null;
  return data.map((p) => ({
    n: p.n,
    side: p.side === 'a' ? 'a' : 'b',
    round: 0,
    name: p.name,
    slot: p.slot,
  }));
}

/* ---------- the season, and the rematch ---------- */

/** Everything the other one's half of the review needs. */
export type SeasonCard = {
  name: string;
  rating: number;
  pts: number;
  position: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  cleanSheets: number;
  national: boolean;
  continental: boolean;
  score: number;
  grade: string;
  /** the XI, so the two teams can be shown side by side */
  xi: { n: string; pos: string; rtg: number; club: string; season: string }[];
};

export async function sendSeason(match: Match, side: Side, card: SeasonCard): Promise<void> {
  if (match.bot) return;
  await net(
    (db) =>
      db
        .from('duel_match')
        .update({ [`${side}_season`]: card, [`${side}_pts`]: card.pts, [`${side}_rating`]: card.rating })
        .eq('seed', match.seed),
    8000,
  );
}

export async function fetchSeason(match: Match, side: Side): Promise<SeasonCard | null> {
  if (match.bot) return null;
  const got = await net(
    (db) => db.from('duel_match').select(`${side}_season`).eq('seed', match.seed).limit(1),
    5000,
  );
  const row = ((got as { data?: Record<string, unknown>[] } | null)?.data ?? [])[0];
  const card = row?.[`${side}_season`];
  return (card as SeasonCard) ?? null;
}

export type RematchState = {
  mine: boolean;
  theirs: boolean;
  seed: number | null;
};

/**
 * Ask for another one.
 *
 * Both have to say yes. The seed for the next match is put up by whoever
 * asks first and taken by the other, which is the same trick the queue
 * uses and for the same reason: agreeing on one number is the whole of
 * agreeing on a match.
 */
export async function askRematch(match: Match, side: Side, seed: number): Promise<void> {
  if (match.bot) return;
  /* The seed goes up only if nobody has put one there. A second asker's
     update matches no row, so they keep the one already agreed. */
  await net(
    (db) =>
      db
        .from('duel_match')
        .update({ rematch_seed: seed })
        .eq('seed', match.seed)
        .is('rematch_seed', null),
    5000,
  );
  await net(
    (db) =>
      db
        .from('duel_match')
        .update({ [`${side}_rematch`]: true })
        .eq('seed', match.seed),
    5000,
  );
}

export async function pollRematch(match: Match, side: Side): Promise<RematchState | null> {
  if (match.bot) return null;
  const got = await net(
    (db) =>
      db
        .from('duel_match')
        .select('a_rematch, b_rematch, rematch_seed')
        .eq('seed', match.seed)
        .limit(1),
    4000,
  );
  const row = ((got as { data?: Record<string, unknown>[] } | null)?.data ?? [])[0];
  if (!row) return null;
  const other = side === 'a' ? 'b' : 'a';
  return {
    mine: row[`${side}_rematch`] === true,
    theirs: row[`${other}_rematch`] === true,
    seed: row.rematch_seed == null ? null : Number(row.rematch_seed) >>> 0,
  };
}
