import { SQUADS } from '../data/squads';
import type { Rng } from './rng';
import type { Pick } from './types';

/**
 * The collection.
 *
 * The game already owns three thousand real footballers across thirty
 * five seasons, and that is the most interesting thing it could possibly
 * ask somebody to collect. So the collectible is the footballer, at the
 * club and in the season he actually played: Bergkamp at Arsenal in
 * 1997/98 is a different card from Bergkamp at Arsenal in 2001/02,
 * because those were different footballers to watch.
 *
 * Two ways to get one, and the first matters more than the second.
 *
 *   Play. Every XI you finish a season with is yours to keep, for good.
 *   That makes the collection a record of who you have actually used
 *   rather than a second game played against a shop.
 *   Open a pack. Coins earned from seasons, and nothing else: there is
 *   no way to pay for a footballer by name, because paying to put an
 *   exact card into the album turns collecting into shopping.
 *
 * Nothing in here can be spent to win anything. A card is a card.
 */

export type Rarity = 'bronze' | 'silver' | 'gold' | 'icon';

/** A card, as it is stored: the smallest thing that identifies one. */
export type CardId = string;

export type Card = {
  id: CardId;
  n: string;
  club: string;
  /** the season it belongs to, as a year, so it sorts */
  year: number;
  season: string;
  nat: string;
  pos: string[];
  rtg: number;
  rarity: Rarity;
};

/** How a rating reads as a rarity. */
export function rarityOf(rtg: number): Rarity {
  if (rtg >= 90) return 'icon';
  if (rtg >= 85) return 'gold';
  if (rtg >= 78) return 'silver';
  return 'bronze';
}

export const RARITY_ORDER: readonly Rarity[] = ['icon', 'gold', 'silver', 'bronze'];

export function seasonStr(year: number): string {
  const a = String(year - 1).slice(2);
  const b = String(year).slice(2);
  return `${a}/${b}`;
}

export function cardId(club: string, year: number, name: string): CardId {
  return `${club}|${year}|${name}`;
}

/** Read an id back, for a collection that has been saved and reloaded. */
export function readCardId(id: CardId): { club: string; year: number; n: string } | null {
  const first = id.indexOf('|');
  const second = id.indexOf('|', first + 1);
  if (first < 0 || second < 0) return null;
  const club = id.slice(0, first);
  const year = Number(id.slice(first + 1, second));
  const n = id.slice(second + 1);
  if (!club || !n || !Number.isFinite(year)) return null;
  return { club, year, n };
}

/* ---------- the whole set of them, built once and only when wanted ---------- */

let every: Card[] | null = null;
let byId: Map<CardId, Card> | null = null;
let byRarity: Record<Rarity, Card[]> | null = null;

/**
 * Every card there is.
 *
 * Eleven thousand of them, built on the first ask rather than at import,
 * because a full pass over the database at load time is a quarter of a
 * second on the splash screen for something most sessions never open.
 */
export function allCards(): readonly Card[] {
  if (every) return every;
  const out: Card[] = [];
  for (const key of Object.keys(SQUADS)) {
    const bar = key.lastIndexOf('|');
    const club = key.slice(0, bar);
    const year = Number(key.slice(bar + 1));
    for (const p of SQUADS[key]) {
      const rtg = p.prime || p.rtg;
      out.push({
        id: cardId(club, year, p.n),
        n: p.n,
        club,
        year,
        season: seasonStr(year),
        nat: p.nat ?? '',
        pos: p.pos,
        rtg,
        rarity: rarityOf(rtg),
      });
    }
  }
  out.sort((a, b) => b.rtg - a.rtg || a.n.localeCompare(b.n));
  every = out;
  return out;
}

export function cardById(id: CardId): Card | null {
  if (!byId) {
    byId = new Map();
    for (const c of allCards()) byId.set(c.id, c);
  }
  return byId.get(id) ?? null;
}

function pools(): Record<Rarity, Card[]> {
  if (byRarity) return byRarity;
  const out: Record<Rarity, Card[]> = { icon: [], gold: [], silver: [], bronze: [] };
  for (const c of allCards()) out[c.rarity].push(c);
  byRarity = out;
  return out;
}

/** How many cards there are of each rarity, for the page that says so. */
export function totals(): Record<Rarity, number> & { all: number } {
  const p = pools();
  return {
    icon: p.icon.length,
    gold: p.gold.length,
    silver: p.silver.length,
    bronze: p.bronze.length,
    all: allCards().length,
  };
}

/** The card a drafted player is, so a finished XI can be kept. */
export function cardForPick(pick: Pick): CardId | null {
  /* A pick carries the season as it is written rather than as a year, so
     the year is read back off it. Anything that does not parse is left
     alone rather than guessed at. */
  const bit = pick.season.split('/')[1];
  if (!bit) return null;
  const two = Number(bit);
  if (!Number.isFinite(two)) return null;
  const year = two >= 90 ? 1900 + two : 2000 + two;
  const id = cardId(pick.club, year, pick.n);
  return cardById(id) ? id : null;
}

/* ---------- packs ---------- */

export type PackId = 'pack.bronze' | 'pack.silver' | 'pack.gold' | 'pack.icon';

export type Pack = {
  id: PackId;
  name: string;
  blurb: string;
  price: number;
  /** how many cards come out */
  size: number;
  /**
   * The chance of each rarity for an ordinary card in this pack.
   *
   * Every pack also guarantees one card of at least `floor`, so the odds
   * describe the rest of it. They add up to one and a check says so,
   * because odds that do not are how a pack quietly stops giving out its
   * best rarity.
   */
  odds: Record<Rarity, number>;
  floor: Rarity;
};

export const PACKS: readonly Pack[] = [
  {
    id: 'pack.bronze',
    name: 'Bronze pack',
    blurb: 'Three squad players. Everybody has to start somewhere.',
    price: 120,
    size: 3,
    odds: { icon: 0.005, gold: 0.045, silver: 0.25, bronze: 0.7 },
    floor: 'bronze',
  },
  {
    id: 'pack.silver',
    name: 'Silver pack',
    blurb: 'Five cards, and one of them is a Silver at worst.',
    price: 300,
    size: 5,
    odds: { icon: 0.02, gold: 0.1, silver: 0.42, bronze: 0.46 },
    floor: 'silver',
  },
  {
    id: 'pack.gold',
    name: 'Gold pack',
    blurb: 'Five cards, one of them Gold or better. Where a set gets finished.',
    price: 700,
    size: 5,
    odds: { icon: 0.06, gold: 0.24, silver: 0.45, bronze: 0.25 },
    floor: 'gold',
  },
  {
    id: 'pack.icon',
    name: 'Icon pack',
    blurb: 'Three cards and one of them is rated ninety or more. Rare on purpose.',
    price: 2000,
    size: 3,
    odds: { icon: 0.18, gold: 0.4, silver: 0.34, bronze: 0.08 },
    floor: 'icon',
  },
];

export function packById(id: string): Pack | null {
  return PACKS.find((p) => p.id === id) ?? null;
}

function drawRarity(odds: Record<Rarity, number>, rnd: Rng): Rarity {
  let roll = rnd();
  for (const r of RARITY_ORDER) {
    roll -= odds[r];
    if (roll <= 0) return r;
  }
  return 'bronze';
}

/**
 * Open one.
 *
 * `have` is what is already owned. A pack prefers to hand over something
 * new: it takes up to a few goes at finding one, and only falls back to a
 * card you already have when the whole rarity is exhausted. Nobody wants
 * to spend seven hundred coins on five names they already had, and this
 * is cheaper than tracking every duplicate.
 */
export function openPack(pack: Pack, have: ReadonlySet<CardId>, rnd: Rng): Card[] {
  const p = pools();
  const out: Card[] = [];
  const taken = new Set<CardId>();

  const pull = (rarity: Rarity): Card | null => {
    const list = p[rarity];
    if (!list.length) return null;
    for (let go = 0; go < 24; go++) {
      const c = list[Math.floor(rnd() * list.length)];
      if (!c) continue;
      if (taken.has(c.id)) continue;
      if (!have.has(c.id)) return c;
    }
    /* Everything of that rarity is already owned, or the draws were
       unlucky. Anything not already in this pack will do. */
    for (let go = 0; go < 24; go++) {
      const c = list[Math.floor(rnd() * list.length)];
      if (c && !taken.has(c.id)) return c;
    }
    return null;
  };

  for (let i = 0; i < pack.size; i++) {
    const want = i === 0 ? pack.floor : drawRarity(pack.odds, rnd);
    const got = pull(want) ?? pull('bronze') ?? pull('silver');
    if (got) {
      taken.add(got.id);
      out.push(got);
    }
  }
  return out;
}

/* ---------- sets ---------- */

export type CardSet = {
  id: string;
  name: string;
  blurb: string;
  club: string;
  year: number;
  /** what finishing it pays */
  coins: number;
};

/**
 * The squads worth collecting whole.
 *
 * Chosen rather than generated. A set is a thing somebody has heard of:
 * the Invincibles, the Treble, Leicester. A list built by picking the
 * highest rated club-seasons would be twenty Manchester City squads and
 * nobody would want any of them.
 *
 * Every one of these is checked against the database, because a set
 * naming a squad that is not in there is a goal that cannot be finished.
 */
export const SETS: readonly CardSet[] = [
  /* the ones everybody knows */
  { id: 'set.invincibles', name: 'The Invincibles', blurb: 'Arsenal, unbeaten across the whole of 2003/04.', club: 'Arsenal', year: 2004, coins: 900 },
  { id: 'set.treble', name: 'The Treble', blurb: 'Manchester United in 1998/99, and the week that finished it.', club: 'Man United', year: 1999, coins: 900 },
  { id: 'set.leicester', name: 'Five Thousand to One', blurb: 'Leicester, champions in 2015/16.', club: 'Leicester', year: 2016, coins: 900 },
  { id: 'set.centurions', name: 'The Centurions', blurb: 'Manchester City and a hundred points in 2017/18.', club: 'Man City', year: 2018, coins: 800 },
  { id: 'set.klopp', name: 'Ninety Nine Points', blurb: 'Liverpool in 2019/20, thirty years in the waiting.', club: 'Liverpool', year: 2020, coins: 800 },
  { id: 'set.wenger98', name: 'The Double', blurb: 'Arsenal in 1997/98, the first of the Wenger sides.', club: 'Arsenal', year: 1998, coins: 800 },

  /* the great sides that did not always win */
  { id: 'set.keegan', name: 'The Entertainers', blurb: 'Newcastle in 1995/96, and the twelve point lead.', club: 'Newcastle', year: 1996, coins: 700 },
  { id: 'set.chelsea05', name: 'The First Mourinho', blurb: 'Chelsea in 2004/05, and fifteen goals conceded.', club: 'Chelsea', year: 2005, coins: 700 },
  { id: 'set.blackburn', name: 'Bought and Won', blurb: 'Blackburn in 1994/95, and never repeated.', club: 'Blackburn', year: 1995, coins: 700 },
  { id: 'set.spurs', name: 'The Pochettino Spurs', blurb: 'Tottenham in 2016/17, and eighty six points.', club: 'Tottenham', year: 2017, coins: 600 },
  { id: 'set.class92', name: 'The Class of 92', blurb: 'Manchester United in 1995/96. You cannot win anything with kids.', club: 'Man United', year: 1996, coins: 800 },
  { id: 'set.fergie13', name: 'The Last One', blurb: 'Manchester United in 2012/13, and then he went.', club: 'Man United', year: 2013, coins: 700 },

  /* the nights */
  { id: 'set.istanbul', name: 'Istanbul', blurb: 'Liverpool in 2004/05, three down at half time.', club: 'Liverpool', year: 2005, coins: 800 },
  { id: 'set.munich', name: 'Munich', blurb: 'Chelsea in 2011/12, in somebody else’s stadium.', club: 'Chelsea', year: 2012, coins: 800 },
  { id: 'set.aguero', name: 'Ninety Three Twenty', blurb: 'Manchester City in 2011/12, and the last kick of it.', club: 'Man City', year: 2012, coins: 800 },

  /* and the ones nobody expected */
  { id: 'set.forest', name: 'Forest 94/95', blurb: 'Promoted, then third, and into Europe.', club: 'Nottm Forest', year: 1995, coins: 600 },
  { id: 'set.bolton', name: 'Big Sam’s Bolton', blurb: 'Bolton in 2004/05, sixth and into the UEFA Cup.', club: 'Bolton', year: 2005, coins: 600 },
  { id: 'set.crazygang', name: 'The Crazy Gang', blurb: 'Wimbledon in 1992/93, and nobody wanted to play them.', club: 'Wimbledon', year: 1993, coins: 600 },
  { id: 'set.pompey', name: 'Pompey 07/08', blurb: 'Portsmouth, and an FA Cup nobody saw coming.', club: 'Portsmouth', year: 2008, coins: 600 },
  { id: 'set.fulham', name: 'The Cottage Run', blurb: 'Fulham in 2009/10, all the way to Hamburg.', club: 'Fulham', year: 2010, coins: 600 },
  { id: 'set.swansea', name: 'Swansea 12/13', blurb: 'A League Cup, played the right way.', club: 'Swansea', year: 2013, coins: 600 },
  { id: 'set.villa99', name: 'Villa 98/99', blurb: 'Top of the league at Christmas.', club: 'Aston Villa', year: 1999, coins: 600 },
  { id: 'set.everton05', name: 'The School of Science', blurb: 'Everton in 2004/05, fourth against everything.', club: 'Everton', year: 2005, coins: 600 },
  { id: 'set.newcastle12', name: 'Newcastle 11/12', blurb: 'Fifth, on nothing, and Cisse from anywhere.', club: 'Newcastle', year: 2012, coins: 600 },
];


export type SetState = {
  set: CardSet;
  cards: Card[];
  owned: number;
  total: number;
  done: boolean;
};

/** Where a set stands. */
export function setState(set: CardSet, have: ReadonlySet<CardId>): SetState {
  const key = `${set.club}|${set.year}`;
  const rows = SQUADS[key] ?? [];
  const cards = rows
    .map((p) => cardById(cardId(set.club, set.year, p.n)))
    .filter((c): c is Card => c !== null);
  const owned = cards.filter((c) => have.has(c.id)).length;
  return { set, cards, owned, total: cards.length, done: cards.length > 0 && owned === cards.length };
}

export function allSets(have: ReadonlySet<CardId>): SetState[] {
  return SETS.map((s) => setState(s, have));
}

/* ---------- the milestones that are not sets ---------- */

export type Milestone = {
  id: string;
  name: string;
  blurb: string;
  /** how many cards of that rarity, or of anything when rarity is left out */
  need: number;
  rarity?: Rarity;
  coins: number;
};

export const MILESTONES: readonly Milestone[] = [
  { id: 'coll.25', name: 'A Start', blurb: 'Twenty five footballers kept.', need: 25, coins: 120 },
  { id: 'coll.100', name: 'A Shelf', blurb: 'A hundred of them.', need: 100, coins: 300 },
  { id: 'coll.500', name: 'An Archive', blurb: 'Five hundred cards.', need: 500, coins: 900 },
  { id: 'coll.1000', name: 'A Thousand', blurb: 'One in eleven of everybody there is.', need: 1000, coins: 2000 },
  { id: 'coll.icon10', name: 'Ten Icons', blurb: 'Ten footballers rated ninety or more.', need: 10, rarity: 'icon', coins: 400 },
  { id: 'coll.icon50', name: 'Fifty Icons', blurb: 'The best there has ever been, fifty times over.', need: 50, rarity: 'icon', coins: 1500 },
  { id: 'coll.gold100', name: 'A Hundred Golds', blurb: 'A hundred cards rated eighty five or better.', need: 100, rarity: 'gold', coins: 800 },
];

export function milestoneState(
  m: Milestone,
  have: ReadonlySet<CardId>,
): { milestone: Milestone; owned: number; done: boolean } {
  let owned = 0;
  if (!m.rarity) owned = have.size;
  else {
    for (const id of have) {
      const c = cardById(id);
      if (c && c.rarity === m.rarity) owned++;
    }
  }
  return { milestone: m, owned: Math.min(owned, m.need), done: owned >= m.need };
}

/** How the collection stands, by rarity. */
export function collectionCounts(have: ReadonlySet<CardId>): Record<Rarity, number> & { all: number } {
  const out = { icon: 0, gold: 0, silver: 0, bronze: 0, all: 0 };
  for (const id of have) {
    const c = cardById(id);
    if (!c) continue;
    out[c.rarity]++;
    out.all++;
  }
  return out;
}

/* ---------- the album ---------- */

export type ClubRow = {
  club: string;
  owned: number;
  total: number;
  /** the best card you hold from that club, for the row to show something */
  best: Card | null;
  /** how many seasons of them there are */
  seasons: number;
};

/**
 * The clubs, as pages of a book.
 *
 * Fifty one of them, each with up to thirty five seasons behind it. The
 * row is deliberately more than a count: a club you have one card from
 * should say which one, because that is the thing that makes somebody
 * open it.
 */
export function clubRows(have: ReadonlySet<CardId>): ClubRow[] {
  const by = new Map<string, ClubRow & { years: Set<number> }>();
  for (const c of allCards()) {
    let row = by.get(c.club);
    if (!row) {
      row = { club: c.club, owned: 0, total: 0, best: null, seasons: 0, years: new Set() };
      by.set(c.club, row);
    }
    row.total++;
    row.years.add(c.year);
    if (have.has(c.id)) {
      row.owned++;
      if (!row.best || c.rtg > row.best.rtg) row.best = c;
    }
  }
  return [...by.values()]
    .map((r) => ({ club: r.club, owned: r.owned, total: r.total, best: r.best, seasons: r.years.size }))
    .sort((a, b) => b.owned - a.owned || a.club.localeCompare(b.club));
}

export type AlbumSeason = {
  year: number;
  season: string;
  cards: Card[];
  owned: number;
};

/**
 * One club's page, season by season, newest first.
 *
 * Every card is here whether it is owned or not, because a page with the
 * gaps taken out of it is a list rather than an album, and the gaps are
 * the whole reason anybody keeps going.
 */
export function albumFor(club: string, have: ReadonlySet<CardId>): AlbumSeason[] {
  const by = new Map<number, AlbumSeason>();
  for (const c of allCards()) {
    if (c.club !== club) continue;
    let row = by.get(c.year);
    if (!row) {
      row = { year: c.year, season: c.season, cards: [], owned: 0 };
      by.set(c.year, row);
    }
    row.cards.push(c);
    if (have.has(c.id)) row.owned++;
  }
  const out = [...by.values()];
  for (const row of out) row.cards.sort((a, b) => b.rtg - a.rtg || a.n.localeCompare(b.n));
  return out.sort((a, b) => b.year - a.year);
}

/** Your best cards, for the shelf at the top of the album. */
export function bestOwned(have: ReadonlySet<CardId>, n: number): Card[] {
  const out: Card[] = [];
  for (const id of have) {
    const c = cardById(id);
    if (c) out.push(c);
  }
  out.sort((a, b) => b.rtg - a.rtg || a.n.localeCompare(b.n));
  return out.slice(0, n);
}
