/**
 * Levels, the collection and the shop.
 *
 * A progression system fails quietly. Nothing crashes: the numbers are
 * simply wrong, and nobody finds out until somebody has spent forty
 * seasons reaching a level that hands over a thing the app cannot draw,
 * or opening packs that never contain what they promise.
 *
 * So the whole thing is played out rather than inspected. Five hundred
 * seasons of a real player, every level walked, ten thousand packs
 * opened and counted, every set checked against the database it names,
 * and every reward matched to something that exists.
 */
import {
  MAX_LEVEL,
  xpToReach,
  levelFor,
  levelProgress,
  coinsForLevel,
  rewardsFor,
  rewardsBetween,
  nextKeepsake,
  allKeepsakes,
  seasonXp,
  seasonCoins,
} from '../.headless/engine/levels.js';
import {
  rarityOf,
  allCards,
  cardById,
  cardId,
  readCardId,
  totals,
  cardForPick,
  PACKS,
  packById,
  openPack,
  cardValue,
  valueOf,
  SETS,
  setState,
  MILESTONES,
  milestoneState,
  collectionCounts,
} from '../.headless/engine/collection.js';
import {
  COSMETICS,
  DEFAULTS,
  cosmeticById,
  cosmeticsOfKind,
  forSale,
  unlockedByLevel,
  danglingRewards,
} from '../.headless/engine/cosmetics.js';
import { mulberry32 } from '../.headless/engine/rng.js';

let failures = 0;
const seen = new Set();
function bad(what) {
  if (seen.has(what)) return;
  seen.add(what);
  console.log('  FAIL ' + what);
  failures++;
}
const rows = [];
function must(label, ok, note) {
  if (!ok) failures++;
  rows.push({ ok, label, note });
}
function band(label, got, lo, hi, note) {
  const ok = got >= lo && got <= hi;
  if (!ok) failures++;
  rows.push({ ok, label, got, lo, hi, note });
}

/* ================= the curve ================= */

must('level one is nought experience', xpToReach(1) === 0, String(xpToReach(1)));
must('and nothing is below it', levelFor(0) === 1 && levelFor(-500) === 1, '');
{
  let rising = true;
  let biggestJump = 0;
  for (let l = 2; l <= MAX_LEVEL; l++) {
    if (xpToReach(l) <= xpToReach(l - 1)) rising = false;
    const gap = xpToReach(l) - xpToReach(l - 1);
    const before = l > 2 ? xpToReach(l - 1) - xpToReach(l - 2) : gap;
    biggestJump = Math.max(biggestJump, gap / Math.max(1, before));
  }
  must('every level costs more than the last', rising, '');
  band('the sharpest step up between levels', Math.round(biggestJump * 100) / 100, 1, 4,
    'a curve, never a wall');
}
{
  /* The boundary is the thing that breaks. One short of a level must not
     be that level, and exactly on it must be. */
  let wrong = 0;
  for (let l = 2; l <= MAX_LEVEL; l++) {
    if (levelFor(xpToReach(l)) !== l) wrong++;
    if (levelFor(xpToReach(l) - 1) !== l - 1) wrong++;
  }
  must('every boundary lands on the right level', wrong === 0, `${wrong} did not`);
  must('the top is the top', levelFor(xpToReach(MAX_LEVEL) * 40) === MAX_LEVEL, '');
  must('and it says so', levelProgress(xpToReach(MAX_LEVEL)).maxed === true, '');
}
{
  const p = levelProgress(Math.round((xpToReach(5) + xpToReach(6)) / 2));
  must('halfway through a level reads as halfway', p.level === 5 && p.frac > 0.4 && p.frac < 0.6,
    `${p.level} at ${Math.round(p.frac * 100)}%`);
  must('and the bar never leaves its track',
    levelProgress(0).frac === 0 && levelProgress(xpToReach(3) - 1).frac < 1, '');
}

/* ================= how long it actually takes ================= */

{
  /* An ordinary player: mid table more often than not, a title now and
     then. Five hundred seasons of them, which is more than anybody will
     ever play, so the top of the curve is reached rather than assumed. */
  const rnd = mulberry32(90210);
  let xp = 0;
  let coins = 0;
  let seasons = 0;
  const reached = new Map();
  let lastLevel = 1;
  let spent = 0;

  while (seasons < 500) {
    seasons++;
    const roll = rnd();
    const position = roll < 0.12 ? 1 : roll < 0.35 ? 3 : roll < 0.75 ? 8 : 14;
    const pts = position === 1 ? 92 : position === 3 ? 78 : position === 8 ? 62 : 45;
    xp += seasonXp(pts, position);
    coins += seasonCoins(pts, position);
    const now = levelFor(xp);
    if (now > lastLevel) {
      for (const r of rewardsBetween(lastLevel, now)) coins += r.coins;
      for (let l = lastLevel + 1; l <= now; l++) if (!reached.has(l)) reached.set(l, seasons);
      lastLevel = now;
    }
  }

  band('seasons to reach level 2', reached.get(2) ?? 999, 1, 2, 'the first one should do it');
  band('seasons to reach level 5', reached.get(5) ?? 999, 3, 10, '');
  band('seasons to reach level 10', reached.get(10) ?? 999, 12, 30, '');
  band('seasons to reach level 20', reached.get(20) ?? 999, 45, 100, '');
  band('seasons to reach level 50', reached.get(MAX_LEVEL) ?? 999, 250, 500,
    'a long way, and reachable');
  must('level fifty is reached at all', reached.has(MAX_LEVEL), `${lastLevel} after 500`);
  band('coins after five hundred seasons, thousands', Math.round(coins / 1000), 40, 300, '');

  /* And the shop has to be worth opening early rather than being a wall.
     Ten seasons of an ordinary player must afford something real. */
  const rnd2 = mulberry32(4242);
  let early = 0;
  for (let i = 0; i < 10; i++) {
    const roll = rnd2();
    const position = roll < 0.12 ? 1 : roll < 0.35 ? 3 : roll < 0.75 ? 8 : 14;
    const pts = position === 1 ? 92 : position === 3 ? 78 : position === 8 ? 62 : 45;
    early += seasonCoins(pts, position);
  }
  const cheapest = Math.min(...PACKS.map((p) => p.price), ...forSale().map((c) => c.price));
  band('coins after ten seasons', early, 600, 3000, '');
  must('and that buys something', early >= cheapest, `cheapest is ${cheapest}`);
  spent = cheapest;
  must('the shop is not empty', spent > 0, '');
}

/* ================= what a level hands over ================= */

{
  must('every level pays coins', rewardsFor(7).some((r) => r.kind === 'coins'), '');
  must('and the coins climb', coinsForLevel(30) > coinsForLevel(10) && coinsForLevel(10) > coinsForLevel(2), '');
  band('level 2 pays', coinsForLevel(2), 60, 120, '');
  band('level 50 pays', coinsForLevel(50), 2000, 6000, '');

  const dangling = danglingRewards();
  must('every reward is a thing that exists', dangling.length === 0, dangling.join('; '));

  const keeps = allKeepsakes();
  let outOfOrder = 0;
  for (let i = 1; i < keeps.length; i++) if (keeps[i].level < keeps[i - 1].level) outOfOrder++;
  must('the keepsakes are in level order', outOfOrder === 0, `${outOfOrder} are not`);
  band('things to reach for', keeps.length, 15, 40, 'one every two levels or so');
  must('there is something at the very top', keeps.some((k) => k.level === MAX_LEVEL), '');
  must('and something in the first handful', keeps.some((k) => k.level <= 3), '');

  /* No level may go by with nothing in front of it. */
  let blind = 0;
  for (let l = 1; l < MAX_LEVEL; l++) if (!nextKeepsake(l)) blind++;
  must('there is always a next thing to reach', blind === 0, `${blind} levels had none`);
  must('and none at the top', nextKeepsake(MAX_LEVEL) === null, '');

  /* Nothing given twice, except packs, which are meant to repeat. */
  const cos = keeps.filter((k) => k.kind !== 'pack');
  must('no cosmetic is handed over twice',
    new Set(cos.map((k) => k.id)).size === cos.length, '');
}

/* ================= the cosmetics ================= */

{
  const ids = COSMETICS.map((c) => c.id);
  must('every cosmetic id is its own', new Set(ids).size === ids.length, '');
  must('everything has a name and a line about it',
    COSMETICS.every((c) => c.name && c.blurb), '');
  must('everything is either reached or bought, never neither',
    COSMETICS.every((c) => c.level > 0 || c.price > 0), '');
  must('and never both',
    COSMETICS.every((c) => !(c.level > 1 && c.price > 0)), '');

  for (const kind of ['frame', 'pitch', 'title']) {
    const list = cosmeticsOfKind(kind);
    band(`${kind}s there are`, list.length, 5, 30, '');
    const free = list.filter((c) => c.level === 1);
    must(`everybody starts with a ${kind}`, free.length === 1, `${free.length} are free`);
  }

  must('the defaults are real', Boolean(
    cosmeticById(DEFAULTS.frame) && cosmeticById(DEFAULTS.pitch) && cosmeticById(DEFAULTS.title)), '');
  must('and are the free ones',
    cosmeticById(DEFAULTS.frame).level === 1 &&
    cosmeticById(DEFAULTS.pitch).level === 1 &&
    cosmeticById(DEFAULTS.title).level === 1, '');

  /* Frames and pitches have to be drawable, which means a colour. */
  const badColour = COSMETICS.filter(
    (c) => c.kind !== 'title' && !/^(#|rgba?\()/.test(c.a),
  );
  must('every frame and pitch has a colour', badColour.length === 0,
    badColour.map((c) => c.id).join(', '));

  band('cosmetics for sale', forSale().length, 8, 40, '');
  const prices = forSale().map((c) => c.price);
  band('the cheapest thing in the shop', Math.min(...prices), 200, 700, 'about four seasons');
  band('the dearest', Math.max(...prices), 1200, 4000, '');

  must('a level you have not reached is not owned', !unlockedByLevel(cosmeticById('frame.gold'), 21), '');
  must('and one you have is', unlockedByLevel(cosmeticById('frame.gold'), 22), '');
}

/* ================= the cards ================= */

const cards = allCards();
{
  band('cards there are', cards.length, 9000, 13000, 'a footballer at a club, in a season');
  const ids = new Set(cards.map((c) => c.id));
  must('every card id is its own', ids.size === cards.length, `${cards.length - ids.size} repeated`);
  must('every id reads back', cards.every((c) => {
    const back = readCardId(c.id);
    return back && back.club === c.club && back.year === c.year && back.n === c.n;
  }), '');
  must('and finds its card', cards.slice(0, 400).every((c) => cardById(c.id)?.n === c.n), '');
  must('an id that is not one comes back as nothing',
    readCardId('rubbish') === null && cardById('rubbish') === null, '');

  const t = totals();
  must('the rarities add up', t.icon + t.gold + t.silver + t.bronze === t.all, '');
  band('Icons, rated ninety and up', t.icon, 30, 900, '');
  band('Golds', t.gold, 200, 2500, '');
  band('Silvers', t.silver, 1000, 6000, '');
  band('Bronzes', t.bronze, 1000, 9000, '');
  must('rarity follows the rating',
    rarityOf(91) === 'icon' && rarityOf(90) === 'icon' && rarityOf(89) === 'gold' &&
    rarityOf(85) === 'gold' && rarityOf(84) === 'silver' && rarityOf(78) === 'silver' &&
    rarityOf(77) === 'bronze', '');

  /* A season and a year have to agree, or a drafted XI is kept as
     nothing. The nineties are the case that breaks it. */
  const sample = [
    { n: cards[0].n, club: cards[0].club, season: cards[0].season, pos: [], nat: '', rtg: 0 },
  ];
  must('a drafted player becomes his card', cardForPick(sample[0]) === cards[0].id,
    String(cardForPick(sample[0])));
  let mismatched = 0;
  for (let i = 0; i < cards.length; i += 37) {
    const c = cards[i];
    const got = cardForPick({ n: c.n, club: c.club, season: c.season, pos: c.pos, nat: c.nat, rtg: c.rtg });
    if (got !== c.id) {
      mismatched++;
      bad(`${c.n} at ${c.club} ${c.season} did not turn back into his card`);
    }
  }
  must('and so does every era of them', mismatched === 0, `${mismatched} did not`);
  must('somebody who is not in the database is nobody',
    cardForPick({ n: 'A Nobody', club: 'Nowhere', season: '05/06', pos: [], nat: '', rtg: 0 }) === null, '');
}

/* ================= the packs ================= */

{
  for (const p of PACKS) {
    const sum = p.odds.icon + p.odds.gold + p.odds.silver + p.odds.bronze;
    must(`${p.name} odds add up to one`, Math.abs(sum - 1) < 1e-9, String(sum));
    band(`${p.name} costs`, p.price, 80, 6000, '');
    band(`${p.name} holds`, p.size, 3, 8, '');
    must(`${p.name} is found by its id`, packById(p.id)?.id === p.id, '');
  }
  must('a pack that is not one is nothing', packById('pack.nothing') === null, '');
  must('a dearer pack has better odds of an Icon',
    PACKS[3].odds.icon > PACKS[2].odds.icon &&
    PACKS[2].odds.icon > PACKS[1].odds.icon &&
    PACKS[1].odds.icon > PACKS[0].odds.icon, '');

  /* Ten thousand packs, opened and counted. What is promised has to
     arrive every single time, not on average. */
  for (const p of PACKS) {
    let broke = 0;
    let dupes = 0;
    let short = 0;
    const rank = { bronze: 0, silver: 1, gold: 2, icon: 3 };
    const counts = { icon: 0, gold: 0, silver: 0, bronze: 0 };
    let total = 0;
    const have = new Set();
    for (let i = 0; i < 2500; i++) {
      const got = openPack(p, have, mulberry32(i * 2654435761 + 7));
      if (got.length !== p.size) short++;
      if (new Set(got.map((c) => c.id)).size !== got.length) dupes++;
      if (!got.some((c) => rank[c.rarity] >= rank[p.floor])) broke++;
      for (const c of got) {
        counts[c.rarity]++;
        total++;
      }
    }
    must(`${p.name} always gives ${p.size} cards`, short === 0, `${short} did not`);
    must(`${p.name} never gives the same card twice`, dupes === 0, `${dupes} did`);
    must(`${p.name} always keeps its promise of a ${p.floor}`, broke === 0, `${broke} did not`);
    band(`${p.name} Icons per hundred cards`,
      Math.round((counts.icon / total) * 1000) / 10, 0, 60, '');
  }

  /* A collection that already holds everything must not hang or come
     back empty. It is the state a completionist ends in. */
  const everything = new Set(cards.map((c) => c.id));
  const full = openPack(PACKS[1], everything, mulberry32(11));
  must('a pack still opens for somebody who owns everything', full.length === PACKS[1].size,
    `${full.length} cards`);

  /* And it prefers a card you do not have. */
  const nearlyAll = new Set(cards.filter((c) => c.rarity !== 'silver').map((c) => c.id));
  let fresh = 0;
  let drawn = 0;
  for (let i = 0; i < 200; i++) {
    for (const c of openPack(PACKS[1], nearlyAll, mulberry32(i + 500))) {
      drawn++;
      if (!nearlyAll.has(c.id)) fresh++;
    }
  }
  band('cards in a pack that are new, %', Math.round((fresh / drawn) * 100), 45, 100,
    'it goes looking for something you have not got');
}

/* ================= the sets ================= */

{
  const none = new Set();
  const ids = SETS.map((s) => s.id);
  must('every set id is its own', new Set(ids).size === ids.length, '');
  band('sets to collect', SETS.length, 8, 40, '');

  let empty = 0;
  let thin = 0;
  for (const s of SETS) {
    const st = setState(s, none);
    if (st.total === 0) {
      empty++;
      bad(`${s.name} names ${s.club} ${s.year}, which is not in the database`);
    } else if (st.total < 11) {
      thin++;
      bad(`${s.name} has only ${st.total} players in it`);
    }
    if (st.owned !== 0 || st.done) bad(`${s.name} is finished before anything is owned`);
  }
  must('every set names a squad that exists', empty === 0, `${empty} did not`);
  must('and every one can field an XI', thin === 0, `${thin} could not`);

  /* Owning the squad finishes the set, and owning all but one does not. */
  const s0 = SETS[0];
  const full = setState(s0, new Set(setState(s0, none).cards.map((c) => c.id)));
  must('owning the squad finishes the set', full.done && full.owned === full.total,
    `${full.owned} of ${full.total}`);
  const oneShort = setState(s0, new Set(full.cards.slice(1).map((c) => c.id)));
  must('and one short does not', !oneShort.done && oneShort.owned === full.total - 1, '');
  band('what finishing a set pays', Math.min(...SETS.map((s) => s.coins)), 300, 2000, '');
}

/* ================= the milestones ================= */

{
  const ids = MILESTONES.map((m) => m.id);
  must('every milestone id is its own', new Set(ids).size === ids.length, '');
  const t = totals();
  let impossible = 0;
  for (const m of MILESTONES) {
    const there = m.rarity ? t[m.rarity] : t.all;
    if (m.need > there) {
      impossible++;
      bad(`${m.name} wants ${m.need} and there are only ${there}`);
    }
  }
  must('no milestone asks for more than exists', impossible === 0, `${impossible} did`);

  const icons = cards.filter((c) => c.rarity === 'icon').slice(0, 10).map((c) => c.id);
  const st = milestoneState(MILESTONES.find((m) => m.id === 'coll.icon10'), new Set(icons));
  must('ten Icons finishes the ten Icon milestone', st.done && st.owned === 10, String(st.owned));
  const nine = milestoneState(MILESTONES.find((m) => m.id === 'coll.icon10'), new Set(icons.slice(0, 9)));
  must('and nine does not', !nine.done, '');

  const counts = collectionCounts(new Set([...icons, cards[cards.length - 1].id]));
  must('the collection counts what it holds', counts.all === 11 && counts.icon === 10, JSON.stringify(counts));
  must('and nothing when it holds nothing', collectionCounts(new Set()).all === 0, '');
  must('a card that is not one is not counted',
    collectionCounts(new Set(['not a card'])).all === 0, '');
}

/* ================= selling cannot print coins ================= */

{
  /* This is the one number in the whole system that could quietly ruin
     it. If a pack ever hands back more in sale value than it costs, then
     opening packs is free money, and every price, level and reward stops
     meaning anything. So it is measured rather than reasoned about, and
     measured in the worst case: somebody who already owns every card in
     the game, whose packs are therefore nothing but duplicates being
     sold back on the spot. */
  const everything = new Set(cards.map((c) => c.id));
  let worst = 0;

  for (const pack of PACKS) {
    let fresh = 0;
    let dupe = 0;
    const N = 600;
    for (let i = 0; i < N; i++) {
      const seed = i * 2654435761 + 3;
      fresh += valueOf(openPack(pack, new Set(), mulberry32(seed)));
      dupe += valueOf(openPack(pack, everything, mulberry32(seed)));
    }
    const freshBack = Math.round((fresh / N / pack.price) * 100);
    const dupeBack = Math.round((dupe / N / pack.price) * 100);
    worst = Math.max(worst, freshBack, dupeBack);
    band(`${pack.name} sells back for, % of its price`, freshBack, 5, 60,
      'a fraction, always');
    band(`${pack.name} when you own everything, %`, dupeBack, 5, 60, '');
  }
  must('no pack ever pays for itself', worst < 70, `the best was ${worst}%`);

  /* And the order of value follows the order of rarity, so a card that is
     harder to get is always worth more to let go of. */
  const icon = cards.find((c) => c.rarity === 'icon');
  const gold = cards.find((c) => c.rarity === 'gold');
  const silver = cards.find((c) => c.rarity === 'silver');
  const bronze = cards.find((c) => c.rarity === 'bronze');
  must('an Icon is worth more than a Gold', cardValue(icon) > cardValue(gold),
    `${cardValue(icon)} against ${cardValue(gold)}`);
  must('a Gold is worth more than a Silver', cardValue(gold) > cardValue(silver), '');
  must('a Silver is worth more than a Bronze', cardValue(silver) > cardValue(bronze), '');
  band('what a Bronze fetches', cardValue(bronze), 2, 30, '');
  band('what the best Icon fetches', Math.max(...cards.filter((c) => c.rarity === 'icon').map(cardValue)),
    180, 900, 'a lot, and still less than an Icon Pack costs');
  must('nothing is worth nothing', cards.every((c) => cardValue(c) > 0), '');

  /* Selling a whole XI must be worth less than the season that produced
     it, or drafting to sell beats drafting to keep. */
  const anXI = cards.slice(2000, 2011);
  band('an eleven sold off', valueOf(anXI), 20, 900, '');
}

console.log('\nProgress, the collection and the shop\n');
for (const r of rows) {
  const got = r.got === undefined ? (r.ok ? 'yes' : 'NO') : r.got;
  const want = r.lo === undefined ? 'yes' : `${r.lo} to ${r.hi}`;
  console.log(
    `  ${r.ok ? 'pass' : 'FAIL'}  ${r.label.padEnd(46)} ${String(got).padStart(7)}   want ${want}` +
      (r.note ? `   ${r.note}` : ''),
  );
}
console.log(
  failures
    ? `\n${failures} problems.\n`
    : '\nEvery level is reachable, every reward is real, and every pack keeps its word.\n',
);
process.exit(failures ? 1 : 0);
