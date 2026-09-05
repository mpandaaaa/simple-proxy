import { SQUADS } from '../data/squads.js';
/** How a rating reads as a rarity. */
export function rarityOf(rtg) {
    if (rtg >= 90)
        return 'icon';
    if (rtg >= 85)
        return 'gold';
    if (rtg >= 78)
        return 'silver';
    return 'bronze';
}
export const RARITY_ORDER = ['icon', 'gold', 'silver', 'bronze'];
export function seasonStr(year) {
    const a = String(year - 1).slice(2);
    const b = String(year).slice(2);
    return `${a}/${b}`;
}
export function cardId(club, year, name) {
    return `${club}|${year}|${name}`;
}
/** Read an id back, for a collection that has been saved and reloaded. */
export function readCardId(id) {
    const first = id.indexOf('|');
    const second = id.indexOf('|', first + 1);
    if (first < 0 || second < 0)
        return null;
    const club = id.slice(0, first);
    const year = Number(id.slice(first + 1, second));
    const n = id.slice(second + 1);
    if (!club || !n || !Number.isFinite(year))
        return null;
    return { club, year, n };
}
/* ---------- the whole set of them, built once and only when wanted ---------- */
let every = null;
let byId = null;
let byRarity = null;
/**
 * Every card there is.
 *
 * Eleven thousand of them, built on the first ask rather than at import,
 * because a full pass over the database at load time is a quarter of a
 * second on the splash screen for something most sessions never open.
 */
export function allCards() {
    if (every)
        return every;
    const out = [];
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
export function cardById(id) {
    if (!byId) {
        byId = new Map();
        for (const c of allCards())
            byId.set(c.id, c);
    }
    return byId.get(id) ?? null;
}
function pools() {
    if (byRarity)
        return byRarity;
    const out = { icon: [], gold: [], silver: [], bronze: [] };
    for (const c of allCards())
        out[c.rarity].push(c);
    byRarity = out;
    return out;
}
/** How many cards there are of each rarity, for the page that says so. */
export function totals() {
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
export function cardForPick(pick) {
    /* A pick carries the season as it is written rather than as a year, so
       the year is read back off it. Anything that does not parse is left
       alone rather than guessed at. */
    const bit = pick.season.split('/')[1];
    if (!bit)
        return null;
    const two = Number(bit);
    if (!Number.isFinite(two))
        return null;
    const year = two >= 90 ? 1900 + two : 2000 + two;
    const id = cardId(pick.club, year, pick.n);
    return cardById(id) ? id : null;
}
/**
 * What a pack costs.
 *
 * A season pays somewhere around a hundred coins, so the ladder is about
 * one season, four, fourteen and forty five. The top two are deliberately
 * a long way up: an Icon Pack that a fortnight of playing can afford is
 * not a thing anybody saves for, and the whole of the collection rests on
 * there being something worth saving for.
 */
export const PACKS = [
    {
        id: 'pack.bronze',
        name: 'Bronze Pack',
        blurb: 'Three squad players. Everybody has to start somewhere.',
        price: 150,
        size: 3,
        odds: { icon: 0.005, gold: 0.045, silver: 0.25, bronze: 0.7 },
        floor: 'bronze',
    },
    {
        id: 'pack.silver',
        name: 'Silver Pack',
        blurb: 'Five cards, and one of them is a Silver at worst.',
        price: 420,
        size: 5,
        odds: { icon: 0.02, gold: 0.1, silver: 0.42, bronze: 0.46 },
        floor: 'silver',
    },
    {
        id: 'pack.gold',
        name: 'Gold Pack',
        blurb: 'Five cards, one of them Gold or better. Where a squad gets finished.',
        price: 1400,
        size: 5,
        odds: { icon: 0.06, gold: 0.24, silver: 0.45, bronze: 0.25 },
        floor: 'gold',
    },
    {
        id: 'pack.icon',
        name: 'Icon Pack',
        blurb: 'Three cards and one of them is rated ninety or more. Rare on purpose.',
        price: 4500,
        size: 3,
        odds: { icon: 0.18, gold: 0.4, silver: 0.34, bronze: 0.08 },
        floor: 'icon',
    },
];
export function packById(id) {
    return PACKS.find((p) => p.id === id) ?? null;
}
function drawRarity(odds, rnd) {
    let roll = rnd();
    for (const r of RARITY_ORDER) {
        roll -= odds[r];
        if (roll <= 0)
            return r;
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
export function openPack(pack, have, rnd) {
    const p = pools();
    const out = [];
    const taken = new Set();
    const pull = (rarity) => {
        const list = p[rarity];
        if (!list.length)
            return null;
        for (let go = 0; go < 24; go++) {
            const c = list[Math.floor(rnd() * list.length)];
            if (!c)
                continue;
            if (taken.has(c.id))
                continue;
            if (!have.has(c.id))
                return c;
        }
        /* Everything of that rarity is already owned, or the draws were
           unlucky. Anything not already in this pack will do. */
        for (let go = 0; go < 24; go++) {
            const c = list[Math.floor(rnd() * list.length)];
            if (c && !taken.has(c.id))
                return c;
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
export const SETS = [
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
/** Where a set stands. */
export function setState(set, have) {
    const key = `${set.club}|${set.year}`;
    const rows = SQUADS[key] ?? [];
    const cards = rows
        .map((p) => cardById(cardId(set.club, set.year, p.n)))
        .filter((c) => c !== null);
    const owned = cards.filter((c) => have.has(c.id)).length;
    return { set, cards, owned, total: cards.length, done: cards.length > 0 && owned === cards.length };
}
export function allSets(have) {
    return SETS.map((s) => setState(s, have));
}
export const MILESTONES = [
    { id: 'coll.25', name: 'A Start', blurb: 'Twenty five footballers kept.', need: 25, coins: 120 },
    { id: 'coll.100', name: 'A Shelf', blurb: 'A hundred of them.', need: 100, coins: 300 },
    { id: 'coll.500', name: 'An Archive', blurb: 'Five hundred cards.', need: 500, coins: 900 },
    { id: 'coll.1000', name: 'A Thousand', blurb: 'One in eleven of everybody there is.', need: 1000, coins: 2000 },
    { id: 'coll.icon10', name: 'Ten Icons', blurb: 'Ten footballers rated ninety or more.', need: 10, rarity: 'icon', coins: 400 },
    { id: 'coll.icon50', name: 'Fifty Icons', blurb: 'The best there has ever been, fifty times over.', need: 50, rarity: 'icon', coins: 1500 },
    { id: 'coll.gold100', name: 'A Hundred Golds', blurb: 'A hundred cards rated eighty five or better.', need: 100, rarity: 'gold', coins: 800 },
];
export function milestoneState(m, have) {
    let owned = 0;
    if (!m.rarity)
        owned = have.size;
    else {
        for (const id of have) {
            const c = cardById(id);
            if (c && c.rarity === m.rarity)
                owned++;
        }
    }
    return { milestone: m, owned: Math.min(owned, m.need), done: owned >= m.need };
}
/** How the collection stands, by rarity. */
export function collectionCounts(have) {
    const out = { icon: 0, gold: 0, silver: 0, bronze: 0, all: 0 };
    for (const id of have) {
        const c = cardById(id);
        if (!c)
            continue;
        out[c.rarity]++;
        out.all++;
    }
    return out;
}
/**
 * The clubs, as pages of a book.
 *
 * Fifty one of them, each with up to thirty five seasons behind it. The
 * row is deliberately more than a count: a club you have one card from
 * should say which one, because that is the thing that makes somebody
 * open it.
 */
export function clubRows(have) {
    const by = new Map();
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
            if (!row.best || c.rtg > row.best.rtg)
                row.best = c;
        }
    }
    return [...by.values()]
        .map((r) => ({ club: r.club, owned: r.owned, total: r.total, best: r.best, seasons: r.years.size }))
        .sort((a, b) => b.owned - a.owned || a.club.localeCompare(b.club));
}
/**
 * One club's page, season by season, newest first.
 *
 * Every card is here whether it is owned or not, because a page with the
 * gaps taken out of it is a list rather than an album, and the gaps are
 * the whole reason anybody keeps going.
 */
export function albumFor(club, have) {
    const by = new Map();
    for (const c of allCards()) {
        if (c.club !== club)
            continue;
        let row = by.get(c.year);
        if (!row) {
            row = { year: c.year, season: c.season, cards: [], owned: 0 };
            by.set(c.year, row);
        }
        row.cards.push(c);
        if (have.has(c.id))
            row.owned++;
    }
    const out = [...by.values()];
    for (const row of out)
        row.cards.sort((a, b) => b.rtg - a.rtg || a.n.localeCompare(b.n));
    return out.sort((a, b) => b.year - a.year);
}
/** Your best cards, for the shelf at the top of the album. */
export function bestOwned(have, n) {
    const out = [];
    for (const id of have) {
        const c = cardById(id);
        if (c)
            out.push(c);
    }
    out.sort((a, b) => b.rtg - a.rtg || a.n.localeCompare(b.n));
    return out.slice(0, n);
}
/* ---------- what a card is worth ---------- */
/**
 * The coins a card fetches when it is sold or arrives as a duplicate.
 *
 * The numbers matter more than they look, because they are the one place
 * this whole thing could turn into a coin printer: if a pack ever
 * returned more in sale value than it cost, the loop is open and every
 * other number in the game stops meaning anything.
 *
 * The shape of it is steep rather than flat, because the whole appeal of
 * an Icon is that he is an Icon: a ninety five rated Henry is worth
 * fifteen hundred and a squad player is worth six. What that costs is
 * that the cheap packs then sit closer to breaking even, so the cheap
 * packs went up to pay for it.
 *
 * The result is measured rather than reasoned about, twice over: once
 * for somebody with an empty album and once for somebody who owns every
 * card in the game and so gets nothing back but duplicates. No pack ever
 * returns more than about half of what it cost.
 *
 * The other half of the guard is elsewhere and just as important: a set
 * or a milestone pays out once and is recorded as paid, so finishing a
 * squad, taking the money and selling it back off pays nothing the second
 * time.
 */
export function cardValue(card) {
    switch (card.rarity) {
        case 'icon':
            return 400 + Math.max(0, card.rtg - 90) * 220;
        case 'gold':
            return 90 + Math.max(0, card.rtg - 85) * 26;
        case 'silver':
            return 18 + Math.max(0, card.rtg - 78) * 3;
        default:
            return 6;
    }
}
/** What a whole list of them is worth, for the line under a pack. */
export function valueOf(cards) {
    return cards.reduce((a, c) => a + cardValue(c), 0);
}
