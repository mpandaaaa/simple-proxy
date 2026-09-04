import { collectionStore, progressStore, rewardsStore } from '../save';
import { watchForReward } from './ads';

/**
 * What an advert is worth, and how often.
 *
 * Rewarded adverts are the only kind anybody actually chooses, and the
 * only reason to choose one is that it pays. It has to pay enough to be
 * worth ninety seconds and be capped tightly enough that the shop still
 * means something: a coin tap you can hold open is not an economy.
 *
 * They exist in one place, the shop, and nowhere else. Nothing in the
 * Daily, the Weekly or a duel can be bought with an advert, because those
 * are scored against other people and an advert that buys an advantage is
 * not an advert.
 */

/** One free pack every four hours. */
const PACK_GAP_MS = 4 * 60 * 60 * 1000;

/** Four lots of coins a day, and no more. */
const COINS_A_DAY = 4;
const COINS_EACH = 500;

/** Which pack a free one is. The cheapest, so it never undercuts the shop. */
const FREE_PACK = 'pack.bronze';

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** How long until the next free pack, in milliseconds. Nought means now. */
export function untilFreePack(): number {
  try {
    const r = rewardsStore.read();
    return Math.max(0, r.packAt + PACK_GAP_MS - Date.now());
  } catch {
    return 0;
  }
}

/** How many coin rewards are left today. */
export function coinsLeftToday(): number {
  try {
    const r = rewardsStore.read();
    if (r.coinDay !== today()) return COINS_A_DAY;
    return Math.max(0, COINS_A_DAY - r.coinCount);
  } catch {
    return 0;
  }
}

export const COIN_REWARD = COINS_EACH;

export type Paid = { ok: true } | { ok: false; why: 'limit' | 'advert' };

/**
 * Watch one for a free pack.
 *
 * The pack is owed rather than opened here, so it goes through exactly
 * the same door as a pack from a level: the shop opens it, the animation
 * runs, duplicates are sold, and nothing about a free pack is a special
 * case anywhere downstream.
 *
 * The clock is only set once the advert has actually been earned. An
 * advert somebody closed after two seconds pays nothing and costs them
 * nothing.
 */
export async function watchForPack(): Promise<Paid> {
  if (untilFreePack() > 0) return { ok: false, why: 'limit' };
  const earned = await watchForReward();
  if (!earned) return { ok: false, why: 'advert' };
  try {
    const c = collectionStore.read();
    collectionStore.write({ ...c, owed: [...c.owed, FREE_PACK] });
    rewardsStore.update((r) => ({ ...r, packAt: Date.now() }));
    return { ok: true };
  } catch {
    return { ok: false, why: 'advert' };
  }
}

/** Watch one for coins. */
export async function watchForCoins(): Promise<Paid> {
  if (coinsLeftToday() <= 0) return { ok: false, why: 'limit' };
  const earned = await watchForReward();
  if (!earned) return { ok: false, why: 'advert' };
  try {
    progressStore.update((p) => ({ ...p, coins: p.coins + COINS_EACH }));
    rewardsStore.update((r) => {
      const day = today();
      return r.coinDay === day
        ? { ...r, coinCount: r.coinCount + 1 }
        : { ...r, coinDay: day, coinCount: 1 };
    });
    return { ok: true };
  } catch {
    return { ok: false, why: 'advert' };
  }
}

/** "in 2 hours", for the button that cannot be pressed yet. */
export function waitWords(ms: number): string {
  const mins = Math.ceil(ms / 60000);
  if (mins <= 1) return 'in a minute';
  if (mins < 60) return `in ${mins} minutes`;
  const hours = Math.ceil(mins / 60);
  return hours === 1 ? 'in an hour' : `in ${hours} hours`;
}
