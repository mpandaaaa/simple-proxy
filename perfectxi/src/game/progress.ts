import {
  cardById,
  cardForPick,
  cosmeticById,
  levelFor,
  openPack,
  packById,
  rewardsBetween,
  seasonCoins,
  seasonXp,
  setState,
  milestoneState,
  mulberry32,
  SETS,
  MILESTONES,
  unlockedByLevel,
  type Card,
  type LevelReward,
  type Slot,
} from '../engine';
import { collectionStore, addCards, looksStore, owned, progressStore } from '../save';

/**
 * Everything that hands something over.
 *
 * One file, because a currency with two places that can add to it has a
 * bug in it already. Screens ask for a thing to happen and are told what
 * happened; none of them works out a price, a level or an experience
 * total for itself.
 *
 * Everything here is written to be safe to call twice. A season that is
 * banked again pays nothing the second time, a set already claimed pays
 * nothing, and a purchase that cannot be afforded changes nothing at all
 * rather than half of it.
 */

export type SeasonAward = {
  xp: number;
  coins: number;
  levelBefore: number;
  levelAfter: number;
  /** what the levels crossed handed over */
  rewards: LevelReward[];
  /** the footballers from this XI that are new to the collection */
  newCards: Card[];
  /** and how many of the eleven were already in it */
  known: number;
};

/**
 * Bank a finished season.
 *
 * The XI is kept before the level is worked out, so a set finished by
 * the last game of a season is finished on the page that season ends on
 * rather than the next time the app opens.
 */
export function awardSeason(args: {
  pts: number;
  position: number;
  squad: readonly Slot[];
}): SeasonAward {
  const { pts, position, squad } = args;
  const xp = seasonXp(pts, position);
  const base = seasonCoins(pts, position);

  /* ---- the footballers ---- */
  const ids: string[] = [];
  for (const s of squad) {
    if (!s.player) continue;
    const id = cardForPick(s.player);
    if (id) ids.push(id);
  }
  const before = collectionStore.read();
  const { next, added } = addCards(before, ids);
  if (added.length) collectionStore.write(next);
  const newCards = added.map((id) => cardById(id)).filter((c): c is Card => c !== null);

  /* ---- the level ---- */
  const p = progressStore.read();
  const levelBefore = levelFor(p.xp);
  const nowXp = p.xp + xp;
  const levelAfter = levelFor(nowXp);
  const rewards = rewardsBetween(levelBefore, levelAfter);
  const fromLevels = rewards.reduce((a, r) => a + r.coins, 0);

  /* A pack won from a level is owed rather than opened, so it is opened
     where opening one is worth watching. */
  const owedPacks = rewards.filter((r) => r.kind === 'pack').map((r) => r.id);
  if (owedPacks.length) {
    const c = collectionStore.read();
    collectionStore.write({ ...c, owed: [...c.owed, ...owedPacks] });
  }

  progressStore.write({
    ...p,
    xp: nowXp,
    lvl: levelAfter,
    coins: p.coins + base + fromLevels,
    seasons: p.seasons + 1,
    titles: p.titles + (position === 1 ? 1 : 0),
    best: Math.max(p.best, pts),
  });

  return {
    xp,
    coins: base + fromLevels,
    levelBefore,
    levelAfter,
    rewards,
    newCards,
    known: ids.length - added.length,
  };
}

/* ---------- spending ---------- */

export type Bought =
  | { ok: true; cards: Card[] }
  | { ok: false; why: 'coins' | 'owned' | 'unknown' | 'locked' };

/** Coins in hand, for anything that has to decide whether to grey a button. */
export function coins(): number {
  return progressStore.read().coins;
}

function spend(amount: number): boolean {
  const p = progressStore.read();
  if (p.coins < amount) return false;
  progressStore.write({ ...p, coins: p.coins - amount });
  return true;
}

/**
 * Open a pack, paying for it.
 *
 * `free` opens one already owed by a level rather than charging for it.
 * The coins come out before the cards go in, and the cards go in as one
 * write, so a pack cannot half happen.
 */
export function buyPack(packId: string, free = false): Bought {
  const pack = packById(packId);
  if (!pack) return { ok: false, why: 'unknown' };

  const c0 = collectionStore.read();
  if (free) {
    const at = c0.owed.indexOf(packId);
    if (at < 0) return { ok: false, why: 'owned' };
    collectionStore.write({ ...c0, owed: c0.owed.filter((_, i) => i !== at) });
  } else if (!spend(pack.price)) {
    return { ok: false, why: 'coins' };
  }

  const c = collectionStore.read();
  const cards = openPack(pack, owned(c), mulberry32((Date.now() ^ (c.cards.length * 2654435761)) >>> 0));
  const { next } = addCards(c, cards.map((x) => x.id));
  collectionStore.write(next);
  return { ok: true, cards };
}

/** Buy a frame, a pitch or a title. */
export function buyCosmetic(id: string): { ok: boolean; why?: 'coins' | 'owned' | 'unknown' } {
  const item = cosmeticById(id);
  if (!item || item.price <= 0) return { ok: false, why: 'unknown' };
  const c = collectionStore.read();
  if (c.bought.includes(id)) return { ok: false, why: 'owned' };
  if (!spend(item.price)) return { ok: false, why: 'coins' };
  const now = collectionStore.read();
  collectionStore.write({ ...now, bought: [...now.bought, id] });
  return { ok: true };
}

/** Whether a cosmetic is yours, by level or by purchase. */
export function hasCosmetic(id: string): boolean {
  const item = cosmeticById(id);
  if (!item) return false;
  if (unlockedByLevel(item, progressStore.read().lvl)) return true;
  return collectionStore.read().bought.includes(id);
}

/** Put one on. Refuses anything not owned, so nothing can be worn unearned. */
export function equip(id: string): boolean {
  const item = cosmeticById(id);
  if (!item || !hasCosmetic(id)) return false;
  looksStore.write({ ...looksStore.read(), [item.kind]: id });
  return true;
}

/* ---------- collecting pays ---------- */

export type Claim = { id: string; name: string; coins: number };

/**
 * Everything finished and not yet paid for.
 *
 * Worked out rather than watched for. A set is finished the moment the
 * eleventh card lands, whether that was a pack, a season or a purchase,
 * and this is the one question that has to be asked to find out.
 */
export function claimable(): Claim[] {
  const c = collectionStore.read();
  const have = owned(c);
  const done = new Set(c.claimed);
  const out: Claim[] = [];
  for (const s of SETS) {
    if (done.has(s.id)) continue;
    if (setState(s, have).done) out.push({ id: s.id, name: s.name, coins: s.coins });
  }
  for (const m of MILESTONES) {
    if (done.has(m.id)) continue;
    if (milestoneState(m, have).done) out.push({ id: m.id, name: m.name, coins: m.coins });
  }
  return out;
}

/** Take the money for everything finished. Pays each thing exactly once. */
export function claimAll(): Claim[] {
  const got = claimable();
  if (!got.length) return got;
  const c = collectionStore.read();
  collectionStore.write({ ...c, claimed: [...c.claimed, ...got.map((g) => g.id)] });
  const p = progressStore.read();
  progressStore.write({ ...p, coins: p.coins + got.reduce((a, g) => a + g.coins, 0) });
  return got;
}

/* ---------- what is being worn ---------- */

export function equipped(): { frame: string; pitch: string; title: string } {
  return looksStore.read();
}
