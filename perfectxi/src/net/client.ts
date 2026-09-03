import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

/**
 * The one connection out.
 *
 * Everything the app sends or fetches goes through here, and there is
 * exactly one rule about it: the game must work with the connection dead.
 * Perfect XI is a free offline game that happens to have an online layer,
 * not an online game. A duel with nobody on the other end is played
 * against the Machine, a leaderboard that will not load shows the scores
 * on this phone, and no screen ever spins forever waiting on a server.
 *
 * So every call here has a timeout, every call returns null rather than
 * throwing, and nothing above this file has a catch block in it.
 */

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabase?: { url?: string; key?: string };
};

const URL = extra.supabase?.url ?? '';
const KEY = extra.supabase?.key ?? '';

/** True when the app was built with somewhere to connect to. */
export const ONLINE_CONFIGURED = Boolean(URL && KEY);

let client: SupabaseClient | null = null;

/**
 * The client, made the first time it is wanted.
 *
 * Not at import time. Building it costs a few milliseconds and opens a
 * connection, and a player who never taps Find an opponent should never
 * pay for either.
 *
 * Auth is off on purpose. There are no accounts, no email, no password
 * and nothing to lose: a player is a random id made on this phone, and
 * the only thing it is ever attached to is a duel and a score.
 */
export function supabase(): SupabaseClient | null {
  if (!ONLINE_CONFIGURED) return null;
  if (!client) {
    client = createClient(URL, KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { headers: { 'x-perfectxi': '1' } },
    });
  }
  return client;
}

/**
 * Run something against the server, or give up.
 *
 * A phone on a train has a connection that resolves in ninety seconds,
 * which is the same as no connection at all but worse, because the
 * screen sits there. Everything is raced against a clock and a slow
 * answer is treated as no answer.
 */
export async function net<T>(
  work: (db: SupabaseClient) => PromiseLike<T>,
  ms = 6000,
): Promise<T | null> {
  const db = supabase();
  if (!db) return null;
  try {
    return await Promise.race([
      Promise.resolve(work(db)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
  } catch {
    return null;
  }
}

/**
 * Is there anything on the other end?
 *
 * A cheap read that touches the smallest table there is. Used by the one
 * place that has to say "online" or "offline" to a person, and nowhere
 * else: everything else simply carries on when a call comes back null.
 */
export async function reachable(): Promise<boolean> {
  const got = await net(
    (db) => db.from('duel_queue').select('id', { count: 'exact', head: true }),
    4000,
  );
  return Boolean(got && !(got as { error?: unknown }).error);
}
