import { defineStore } from './storage';

/**
 * What watching adverts has already paid out.
 *
 * Rewarded adverts are only worth having if they are limited. Without a
 * limit the coin economy is not an economy, it is a tap you hold open,
 * and every price in the shop stops meaning anything.
 */

export type Rewards = {
  /** when the last free pack was taken */
  packAt: number;
  /** the day the coin count belongs to, as YYYY-MM-DD */
  coinDay: string;
  /** how many coin rewards have been taken that day */
  coinCount: number;
};

const fallback: Rewards = { packAt: 0, coinDay: '', coinCount: 0 };

function isRewards(v: unknown): v is Rewards {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Rewards;
  return (
    typeof r.packAt === 'number' &&
    typeof r.coinDay === 'string' &&
    typeof r.coinCount === 'number'
  );
}

export const rewardsStore = defineStore<Rewards>({
  key: 'rewards',
  version: 1,
  fallback,
  validate: isRewards,
});
