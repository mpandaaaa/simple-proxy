import { net } from './client';
import { me } from '../save/me';
import { handleFor } from '../engine';

/**
 * Finding somebody to draft against.
 *
 * The whole of matchmaking rests on the property the offline duel already
 * relied on: a seed fully determines a spin sequence. So two people do
 * not have to stay in step with each other, or even stay connected. They
 * have to agree on one number. Everything after that is the same draft
 * both of them would have played alone.
 *
 * Which is why this is a queue and not a session. You look for somebody
 * already waiting and take their seed. If nobody is waiting you put your
 * own seed down and wait a few seconds. If nobody comes, you pick up your
 * seed and play the Machine on it, and the duel is exactly as real: the
 * same boards, in the same order, that a person would have seen.
 *
 * Nothing here can hang. Every call is raced against a clock in `net`,
 * and the worst case is the Machine, which is the case that works with
 * the phone in flight mode.
 */

export type Match = {
  /** the sequence both of you draft */
  seed: number;
  /** who is in the other chair */
  name: string;
  /** their device id, or null when the game is filling the chair */
  player: string | null;
  /** true when nobody was found */
  bot: boolean;
  /** true when you were the one already waiting */
  waited: boolean;
};

type QueueRow = {
  id: string;
  player: string;
  name: string;
  seed: number;
  matched_with: string | null;
  matched_name: string | null;
};

/** A seed nobody else is going to pick. */
function freshSeed(): number {
  return Math.floor(Math.random() * 0x100000000) >>> 0;
}

/**
 * How long to wait for somebody to take your seed before giving up.
 *
 * Five seconds. Long enough that two people who open the app in the same
 * few seconds find each other, short enough that the far more common
 * case, nobody there at all, is not a wait.
 */
const WAIT_MS = 5000;
const POLL_MS = 700;

/**
 * How long a row counts as somebody still sitting there.
 *
 * This has to be a little more than the wait and no more, and it was
 * twenty five seconds, which was wrong in a way that only shows up with
 * two people. Somebody gives up after five seconds and goes off to play
 * the Machine. Their row is still in the queue. For the next twenty
 * seconds anybody arriving takes it, is told they have found a person,
 * and drafts against an empty chair while the strip along the top of
 * their board never moves.
 *
 * A row older than the wait belongs to somebody who has already gone, so
 * it is never claimed. The row is deleted on the way out as well, and
 * this is what makes the deletion not have to succeed.
 */
const FRESH_MS = WAIT_MS + 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Find an opponent.
 *
 * Three steps, in this order, because the order is what stops two people
 * both waiting for each other.
 *
 *   1. Is somebody already waiting? Take their seed, and claim their row
 *      so that nobody else takes it too. The claim is a conditional
 *      update: it only succeeds if the row is still unclaimed, so two
 *      people reaching for the same person cannot both win.
 *   2. Nobody waiting. Put your own seed down and watch it for a few
 *      seconds to see if somebody takes it.
 *   3. Still nobody. Pick your row back up and play the Machine.
 *
 * `onStatus` is for the screen, so a wait looks like a wait.
 */
export async function findMatch(onStatus?: (what: string) => void): Promise<Match> {
  const self = me();
  const mySeed = freshSeed();

  const machine = (seed: number, waited: boolean): Match => ({
    seed,
    name: handleFor(seed),
    player: null,
    bot: true,
    waited,
  });

  /* Offline, or nothing configured. Straight to the Machine, with no
     pause pretending to look for somebody who cannot be there. */
  onStatus?.('Looking for somebody');

  /* ---- 1. somebody already waiting ---- */
  const since = new Date(Date.now() - FRESH_MS).toISOString();
  const open = await net(
    (db) =>
      db
        .from('duel_queue')
        .select('id, player, name, seed, matched_with, matched_name')
        .is('matched_with', null)
        .neq('player', self.id)
        .gt('created_at', since)
        .order('created_at', { ascending: true })
        .limit(5),
    5000,
  );

  const rows = ((open as { data?: QueueRow[] } | null)?.data ?? []) as QueueRow[];
  for (const row of rows) {
    /* Claim it. The `is null` in the filter is the whole safety: two
       people reaching for the same waiting player cannot both come back
       with a row, because the second update matches nothing. */
    const claimed = await net(
      (db) =>
        db
          .from('duel_queue')
          .update({ matched_with: self.id, matched_name: self.name })
          .eq('id', row.id)
          .is('matched_with', null)
          .select('id, player, name, seed, matched_with, matched_name'),
      5000,
    );
    const got = ((claimed as { data?: QueueRow[] } | null)?.data ?? []) as QueueRow[];
    if (got.length) {
      onStatus?.('Opponent found');
      return {
        seed: Number(row.seed) >>> 0,
        name: row.name,
        player: row.player,
        bot: false,
        waited: false,
      };
    }
  }

  /* ---- 2. sit down and wait ---- */
  const put = await net(
    (db) =>
      db
        .from('duel_queue')
        .insert({ player: self.id, name: self.name, seed: mySeed })
        .select('id'),
    5000,
  );
  const mine = ((put as { data?: { id: string }[] } | null)?.data ?? [])[0];
  if (!mine) {
    /* Could not even join the queue. Nothing is wrong with the game, only
       with the network, and the game does not need the network. */
    return machine(mySeed, false);
  }

  onStatus?.('Waiting for somebody');
  const until = Date.now() + WAIT_MS;
  while (Date.now() < until) {
    await sleep(POLL_MS);
    const look = await net(
      (db) => db.from('duel_queue').select('matched_with, matched_name').eq('id', mine.id).limit(1),
      3000,
    );
    const row = ((look as { data?: QueueRow[] } | null)?.data ?? [])[0];
    if (row?.matched_with) {
      onStatus?.('Opponent found');
      /* Tidy up behind us. Failing to is harmless: the row ages out of
         being claimable in a second and a half. */
      void net((db) => db.from('duel_queue').delete().eq('id', mine.id), 3000);
      return {
        seed: mySeed,
        name: row.matched_name ?? 'Somebody',
        player: row.matched_with,
        bot: false,
        waited: true,
      };
    }
  }

  /* ---- 3. nobody came ----
     Waited for, rather than fired off, so that by the time this player is
     drafting against the Machine there is nothing in the queue with their
     name on it for somebody else to walk into. */
  await net((db) => db.from('duel_queue').delete().eq('id', mine.id), 3000);
  return machine(mySeed, true);
}

/* ---------- what the other one is doing ---------- */

export type Progress = {
  filled: number;
  last: string | null;
  pts: number | null;
  rating: number | null;
};

/**
 * Which side of the match row you are.
 *
 * The person who was already waiting owns the seed, so they are A and the
 * one who took it is B. Both of them work that out from the same fact
 * without having to be told, which is what lets a match row be created by
 * whoever gets there first.
 */
function side(waited: boolean): 'a' | 'b' {
  return waited ? 'a' : 'b';
}

/** Open the row both of you write to. Safe to call twice. */
export async function openMatch(match: Match): Promise<void> {
  if (match.bot) return;
  const self = me();
  const mineIsA = match.waited;
  await net(
    (db) =>
      db.from('duel_match').upsert(
        {
          seed: match.seed,
          a_player: mineIsA ? self.id : match.player,
          a_name: mineIsA ? self.name : match.name,
          b_player: mineIsA ? match.player : self.id,
          b_name: mineIsA ? match.name : self.name,
        },
        { onConflict: 'seed', ignoreDuplicates: true },
      ),
    5000,
  );
}

/** Tell them where you are up to. Fire and forget: a lost update is a tick. */
export function pushProgress(match: Match, filled: number, last: string | null): void {
  if (match.bot) return;
  const s = side(match.waited);
  void net(
    (db) =>
      db
        .from('duel_match')
        .update({ [`${s}_filled`]: filled, [`${s}_last`]: last })
        .eq('seed', match.seed),
    5000,
  );
}

/** And what you finished on. */
export function pushResult(match: Match, pts: number, rating: number): void {
  if (match.bot) return;
  const s = side(match.waited);
  void net(
    (db) =>
      db
        .from('duel_match')
        .update({ [`${s}_pts`]: pts, [`${s}_rating`]: rating })
        .eq('seed', match.seed),
    6000,
  );
}

/** Where they are up to, or null if the answer did not arrive in time. */
export async function pullProgress(match: Match): Promise<Progress | null> {
  if (match.bot) return null;
  /* Theirs is the side you are not. */
  const s = side(!match.waited);
  const got = await net(
    (db) =>
      db
        .from('duel_match')
        .select(`${s}_filled, ${s}_last, ${s}_pts, ${s}_rating`)
        .eq('seed', match.seed)
        .limit(1),
    4000,
  );
  const row = ((got as { data?: Record<string, unknown>[] } | null)?.data ?? [])[0];
  if (!row) return null;
  return {
    filled: Number(row[`${s}_filled`] ?? 0),
    last: (row[`${s}_last`] as string | null) ?? null,
    pts: row[`${s}_pts`] == null ? null : Number(row[`${s}_pts`]),
    rating: row[`${s}_rating`] == null ? null : Number(row[`${s}_rating`]),
  };
}
