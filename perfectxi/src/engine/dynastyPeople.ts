import type { Rng } from './rng';
import type { Position } from './types';
import { clubRating } from './pyramid';
import {
  everyone,
  playerValue,
  saleBlock,
  signedThisSeason,
  starters,
  squadRating,
  type Dynasty,
  type DynastyPlayer,
} from './dynasty';

/**
 * The people, rather than the numbers.
 *
 * Four things live here, and they are the same thing from four sides: a
 * squad is fourteen men with opinions about how they are being treated.
 *
 *   Morale     what he thinks of playing here, and what that costs you
 *   Offers     somebody else wants him, and refusing has a price
 *   Cards      he gets booked, and eventually he misses a game for it
 *   Loans      the academy player goes out and comes back better
 *
 * Everything is a pure function of the career and a passed generator, so
 * a season still replays from its seed alone.
 */

/* ---------- morale ---------- */

/** Content. Everybody starts here and drifts from it. */
export const MORALE_BASE = 70;
/** Under this he asks to leave. */
export const MORALE_UNHAPPY = 35;

/**
 * What being unhappy costs on the pitch.
 *
 * Three percent at the bottom, nothing at all once he is content. It is
 * the same size as a tactical misfit on purpose: enough to matter over a
 * season, never enough to be the only thing that decides one.
 */
export function moraleFit(p: DynastyPlayer): number {
  const m = typeof p.morale === 'number' ? p.morale : MORALE_BASE;
  if (m >= 60) return 1;
  return 1 - ((60 - m) / 60) * 0.03;
}

export function moraleWord(m: number): string {
  if (m >= 85) return 'Loves it here';
  if (m >= 70) return 'Happy';
  if (m >= 55) return 'Settled';
  if (m >= MORALE_UNHAPPY) return 'Restless';
  if (m >= 20) return 'Wants to leave';
  return 'Refusing to play';
}

/**
 * What a season did to how he feels.
 *
 * Playing time first, because it is what a footballer cares about most.
 * Then what he earns beside the men next to him, then whether the club is
 * going anywhere, then whether anything was won.
 */
export function moraleAfterSeason(
  d: Dynasty,
  p: DynastyPlayer,
  args: { finish: number; trophies: number; squadWage: number },
  rnd: Rng,
): number {
  const now = typeof p.morale === 'number' ? p.morale : MORALE_BASE;
  let move = 0;

  /* Playing time. A first team player expects thirty games; anybody good
     enough for the eleven and getting under fifteen is unhappy about it. */
  const apps = p.apps ?? 0;
  if (apps >= 28) move += 6;
  else if (apps >= 18) move += 1;
  else if (apps >= 10) move -= 5;
  else move -= 12;

  // What he earns against what the squad earns.
  const fair = args.squadWage;
  if (fair > 0) {
    const ratio = p.contract.wage / fair;
    if (ratio > 1.35) move += 3;
    else if (ratio < 0.65) move -= 4;
  }

  // Ambition. A very good player at a club going nowhere gets restless.
  const gap = p.rtg - squadRating(starters(d));
  if (gap > 4 && args.finish > 8) move -= 6;
  if (args.finish <= 4) move += 4;
  if (args.finish >= 18) move -= 6;

  move += args.trophies * 5;

  // And a little of his own weather.
  move += Math.round((rnd() - 0.5) * 6);

  // Everybody drifts back toward content when nothing much happens.
  const pull = (MORALE_BASE - now) * 0.15;
  return Math.max(0, Math.min(100, Math.round(now + move + pull)));
}

/* ---------- offers for your players ---------- */

export type Offer = {
  /** the roster index he is standing in */
  slot: number;
  name: string;
  /** who wants him */
  club: string;
  /** how good they are, so the size of the move is readable */
  clubRating: number;
  /** in \u00a3m */
  fee: number;
  /** what he is actually worth, for the comparison */
  worth: number;
  /** true if the club is a step up from yours */
  stepUp: boolean;
  /** true when the buyer is not in your division */
  abroad: boolean;
};

/**
 * The clubs outside your division who come for footballers.
 *
 * A ninety rated forward in the Premier League is not asked about by
 * Millwall. He is asked about by Madrid. Without somebody above the
 * league in it, the only clubs able to bid for the best players you have
 * are the four or five at the top of your own table, and in the seasons
 * where you are one of them nobody bids at all.
 *
 * These sit outside the pyramid and never move, because they are not
 * clubs you can play, manage or be relegated past. They exist to be the
 * phone call.
 */
const ABROAD: readonly { name: string; rating: number; keen: number }[] = [
  { name: 'Real Madrid', rating: 95, keen: 1 },
  { name: 'Bayern Munich', rating: 92, keen: 1 },
  { name: 'Barcelona', rating: 91, keen: 1 },
  { name: 'Paris Saint-Germain', rating: 91, keen: 1.08 },
  { name: 'Inter Milan', rating: 88, keen: 1 },
  { name: 'Atletico Madrid', rating: 87, keen: 1 },
  { name: 'Juventus', rating: 86, keen: 1 },
  { name: 'AC Milan', rating: 86, keen: 1 },
  { name: 'Borussia Dortmund', rating: 84, keen: 0.95 },
  { name: 'Napoli', rating: 84, keen: 1 },
  { name: 'Ajax', rating: 80, keen: 0.9 },
  /* Saudi money, which is why a thirty year old on big wages has a buyer
     at all and why the fee makes no sense against his age. */
  { name: 'Al Hilal', rating: 82, keen: 1.55 },
  { name: 'Al Nassr', rating: 80, keen: 1.5 },
];

/**
 * The most a club can pay for one footballer, in \u00a3m.
 *
 * Squared off the rating, so it climbs the way transfer records climb:
 * a club rated 95 can find about \u00a3190m, one rated 84 about \u00a387m, one
 * rated 74 about \u00a339m and one rated 64 about \u00a311m. A club rated 30 can
 * find nothing at all, which is the whole point. Millwall bidding \u00a3170m
 * for a ninety rated striker is not a bid, it is a bug.
 */
export function spendCap(rating: number): number {
  return Math.round(0.06 * Math.pow(Math.max(0, rating - 52), 2.1));
}

/**
 * Who is being asked about this summer.
 *
 * Two things have to be true before a club picks up the phone, and they
 * are the two things that were missing:
 *
 *   He would go.   A footballer rated ninety does not drop into a club
 *                  rated thirty. The buyer has to be within three rating
 *                  points of him, so the move is one he would make.
 *   They can pay.  The bid has to sit inside what that club could
 *                  actually spend on one player.
 *
 * If nobody clears both, nobody bids. There is no falling back to a
 * random club in the division, which is exactly how a rated 30 side
 * ended up offering \u00a3170m.
 *
 * Real clubs bid over the odds, because a player who is not for sale
 * costs more than one who is, so the bid is ten to sixty percent above
 * what he is worth.
 */
export function offersFor(
  d: Dynasty,
  league: readonly { name: string; str: number }[],
  rnd: Rng,
): Offer[] {
  const out: Offer[] = [];
  const mine = squadRating(starters(d));

  /* Everybody who could conceivably come: your division at the rating
     they are actually at, and the clubs above the league. */
  const buyers = [
    ...league
      .filter((c) => c.name !== d.club)
      .map((c) => ({ name: c.name, rating: clubRating(c.str), keen: 1, abroad: false })),
    ...ABROAD.filter((c) => c.name !== d.club).map((c) => ({ ...c, abroad: true })),
  ];

  d.roster.forEach((p, slot) => {
    if (!p) return;
    // Nobody bids for a squad player or for a man about to retire.
    if (p.rtg < 74 || p.age >= 33) return;
    /* And nobody bids for a man who signed this summer. He has not kicked
       a ball here yet. */
    if (signedThisSeason(d, p)) return;

    /* How likely somebody is to come for him. A ninety rated twenty five
       year old is asked about most summers; a seventy five rated one
       almost never. */
    const want = Math.max(0, (p.rtg - 72) / 26) * (p.age <= 27 ? 1.15 : 0.75);
    if (rnd() > want * 0.55) return;

    const worth = playerValue(p);
    const over = 1.1 + rnd() * 0.5;

    /* Only the clubs he would go to and who could pay what it would take.
       Their own keenness moves the fee, so the Saudi bid is the silly one
       and Dortmund's is the sensible one. */
    const able = buyers
      .map((c) => ({ c, fee: Math.max(1, Math.round(worth * over * c.keen)) }))
      .filter(({ c, fee }) => c.rating >= p.rtg - 3 && spendCap(c.rating) >= fee);
    if (!able.length) return;

    /* Weighted toward the bigger club, because the bigger club is usually
       the one who comes. Never a flat draw, which would have Ajax
       outbidding Madrid half the time. */
    const weights = able.map(({ c }) => Math.max(1, c.rating - p.rtg + 8));
    const total = weights.reduce((a, w) => a + w, 0);
    let roll = rnd() * total;
    let i = 0;
    while (i < weights.length - 1 && roll > weights[i]) {
      roll -= weights[i];
      i++;
    }
    const { c: club, fee } = able[i];

    out.push({
      slot,
      name: p.n,
      club: club.name,
      clubRating: club.rating,
      fee,
      worth,
      stepUp: club.rating > mine + 2,
      abroad: club.abroad,
    });
  });

  return out.sort((a, b) => b.fee - a.fee).slice(0, 4);
}

/** Take the money. He goes, the fee is yours, and the books know. */
export function acceptOffer(d: Dynasty, offer: Offer): Dynasty | null {
  const p = d.roster[offer.slot];
  if (!p || p.n !== offer.name) return null;
  /* The same rule as a sale. An offer should never have been made for a
     man who signed this summer, and if one somehow reaches here it is
     refused rather than honoured. */
  if (saleBlock(d, p)) return null;
  const roster = [...d.roster];
  roster[offer.slot] = null;
  return {
    ...d,
    roster,
    budget: d.budget + offer.fee,
    saleProfit: d.saleProfit + (offer.fee - p.book),
    sold: [...d.sold, `${p.n} to ${offer.club} for £${offer.fee}m`],
    offers: d.offers.filter((o) => o.slot !== offer.slot),
  };
}

/**
 * Turn it down.
 *
 * He knows. If it was a bigger club than yours he takes it badly, and if
 * it was not he shrugs. That is the whole decision: the fee against a man
 * who will be worse next season for having been kept.
 */
export function rejectOffer(d: Dynasty, offer: Offer): Dynasty {
  const roster = d.roster.map((p, i) => {
    if (i !== offer.slot || !p || p.n !== offer.name) return p;
    const hit = offer.stepUp ? 26 : 8;
    return {
      ...p,
      morale: Math.max(0, (typeof p.morale === 'number' ? p.morale : MORALE_BASE) - hit),
    };
  });
  return { ...d, roster, offers: d.offers.filter((o) => o.slot !== offer.slot) };
}

/* ---------- cards ---------- */

/**
 * How often a position gets booked.
 *
 * A defensive midfielder is booked three times as often as a striker,
 * which is why the men who miss games for it are almost always the ones
 * who do the running.
 */
const CARD_RATE: Record<Position, number> = { GK: 0.9, DEF: 5.4, MID: 6.2, ATT: 3.4 };

export type Discipline = { yellows: number; reds: number; banned: number };

/**
 * A season of bookings, and what they cost.
 *
 * Five yellows inside the first nineteen games is a one match ban. Ten by
 * the thirty second is two more. A red is one to three depending on what
 * it was for. It is the cheapest way to make the bench you built matter
 * more than twice a year.
 */
export function seasonCards(p: DynastyPlayer, apps: number, rnd: Rng): Discipline {
  if (apps <= 0) return { yellows: 0, reds: 0, banned: 0 };
  const rate = (CARD_RATE[p.pos] ?? 4) * (apps / 38);
  // Poisson, so a booking is a booking and not a fraction of one.
  let yellows = 0;
  const L = Math.exp(-rate);
  let prod = 1;
  do {
    yellows++;
    prod *= rnd();
  } while (prod > L);
  yellows--;

  const reds = rnd() < 0.055 * (apps / 38) ? 1 : 0;

  let banned = 0;
  if (yellows >= 5) banned += 1;
  if (yellows >= 10) banned += 2;
  if (yellows >= 15) banned += 2;
  if (reds) banned += 1 + Math.floor(rnd() * 3);

  return { yellows, reds, banned: Math.min(12, banned) };
}

/* ---------- loans ---------- */

export type LoanSpell = {
  name: string;
  club: string;
  /** how many league games he played out there */
  apps: number;
  /** what the year did to his rating */
  gained: number;
  /** and what it did to what he might yet become */
  lift: number;
};

/**
 * Where an academy player can go.
 *
 * Only academy players. A first team footballer on loan is a different
 * feature and a worse one on a phone; a seventeen year old going to
 * Preston for a season is the reason to have an academy at all.
 */
export const LOAN_CLUBS: readonly { n: string; level: number }[] = [
  { n: 'Preston', level: 2 }, { n: 'Millwall', level: 2 }, { n: 'Swansea', level: 2 },
  { n: 'Bristol City', level: 2 }, { n: 'Blackburn', level: 2 }, { n: 'QPR', level: 2 },
  { n: 'Stoke', level: 2 }, { n: 'Cardiff', level: 2 }, { n: 'Derby', level: 2 },
  { n: 'Wrexham', level: 3 }, { n: 'Charlton', level: 3 }, { n: 'Peterborough', level: 3 },
  { n: 'Barnsley', level: 3 }, { n: 'Wycombe', level: 3 }, { n: 'Reading', level: 3 },
  { n: 'Exeter', level: 3 }, { n: 'Lincoln', level: 3 }, { n: 'Mansfield', level: 3 },
];

/** The six senior loans a club is allowed does not bind an academy. */
export const LOAN_LIMIT = 6;

/** Where a player of this quality would actually get a game. */
export function loanClubFor(rtg: number, rnd: Rng): { n: string; level: number } {
  const want = rtg >= 62 ? 2 : 3;
  const pool = LOAN_CLUBS.filter((c) => c.level === want);
  const from = pool.length ? pool : LOAN_CLUBS;
  return from[Math.floor(rnd() * from.length)];
}

/**
 * A season out on loan.
 *
 * Games are the whole point, and a full season of them is worth a great
 * deal more than the two or three points this used to hand out. A
 * seventeen year old who plays forty games in the Championship comes back
 * a different footballer, which is the entire reason English clubs send
 * them: Jude Bellingham, Harry Kane at Leicester, Declan Rice's first
 * season of men's football.
 *
 * Three things decide it. How many games he actually played, how hard the
 * division was, and how young he still is, because eighteen learns faster
 * than twenty two.
 *
 * And it is capped by how far he had left to go. A player two points off
 * his ceiling gains one however many games he plays; a boy twenty five
 * points off it can gain nine in a season. That cap is what stops a loan
 * being a cheat code and it is why scouting a prospect's ceiling matters.
 */
export function loanSeason(
  p: DynastyPlayer,
  club: { n: string; level: number },
  rnd: Rng,
): LoanSpell {
  /* A better player than the division plays every week. A worse one
     watches, which is why sending a fifty rated boy to the Championship
     does him no good at all. */
  const bar = club.level === 2 ? 60 : 52;
  const share = Math.max(0.15, Math.min(0.95, 0.5 + (p.rtg - bar) * 0.055));
  const apps = Math.round(38 * share * (0.75 + rnd() * 0.4));

  const games = Math.min(1, apps / 38);
  // The Championship teaches more than League One does.
  const division = club.level === 2 ? 1 : 0.74;
  const age = p.age ?? 19;
  const young = age <= 18 ? 1.3 : age <= 20 ? 1.15 : age <= 22 ? 1 : 0.85;

  /* A season of men's football can make a player more than anybody thought
     he would be. Scouting a ceiling is a scout's opinion, and a boy who
     plays thirty five games in the Championship is allowed to prove it
     wrong, which is also the only way somebody already at his ceiling has
     anything left to gain from going.

     Without this a loan reported nought for most of a squad and, worse,
     could report a decline: a player whose ceiling had fallen below his
     rating was pulled down to it by the very act of sending him out. */
  const lift = games >= 0.5 ? Math.round(games * 3.4 * young) : 0;
  const ceiling = Math.min(97, (p.pot ?? p.rtg) + lift);

  const raw = games * 8.2 * division * young + rnd() * 1.9;
  const headroom = Math.max(0, ceiling - p.rtg);
  const gained = Math.round(Math.min(raw, headroom * 0.6) * 10) / 10;

  return { name: p.n, club: club.n, apps: Math.min(46, apps), gained, lift };
}

/** Who is worth sending out, when the club does it for you. */
export function autoLoanPicks(d: Dynasty): number[] {
  const out: number[] = [];
  d.youth.forEach((p, i) => {
    if (p.loan) return;
    // Sixteen year olds stay at home. Anybody older with a real ceiling goes.
    if (p.age < 17) return;
    if (p.rtg >= 70) return;
    out.push(i);
  });
  return out.slice(0, LOAN_LIMIT);
}

/* ---------- what the squad earns, for the morale comparison ---------- */

export function averageWage(d: Dynasty): number {
  const all = everyone(d);
  if (!all.length) return 0;
  return all.reduce((a, p) => a + p.contract.wage, 0) / all.length;
}

/* ---------- other clubs want you ---------- */

export type JobOffer = {
  club: string;
  rating: number;
  objective: string;
  budget: number;
  note: string;
  /**
   * Which division the club is in.
   *
   * The offers are drawn from the division you are in, so this is that
   * division. Taking a job used to hard code the top flight, which meant
   * a manager relegated in May and hired by a Championship club in June
   * carried nineteen Championship clubs into a season the game called the
   * Premier League. The table read as the second tier because it was the
   * second tier.
   */
  division: 1 | 2;
};

/**
 * Your reputation, on the same scale as everything else.
 *
 * What you have won, where you have finished, and what the board thinks.
 * It is the number that decides whether anybody comes for you, and it is
 * why a manager who takes Sunderland to seventh gets a phone call.
 */
export function reputation(d: Dynasty): number {
  const trophies =
    d.titles * 14 +
    Object.entries(d.honours ?? {}).reduce(
      (a, [k, n]) => a + (k === 'ucl' ? 16 : k === 'fa' ? 8 : k === 'shield' ? 2 : 6) * (n as number),
      0,
    );
  const finishes = d.seasons.reduce((a, s) => a + Math.max(0, 21 - s.fin) * 0.9, 0);
  const board = (d.mgr - 50) * 0.35;
  return Math.round(Math.max(0, Math.min(100, 28 + trophies + finishes * 0.5 + board)));
}

/**
 * Who comes calling in May.
 *
 * A club only approaches somebody it can believe in, so the better your
 * reputation the bigger the club. Nobody approaches a manager the season
 * he has been relegated, and the club you already manage never does.
 *
 * This is the thing that turns twenty seasons into a story rather than
 * one club forever: you can take the job, or you can turn it down and
 * stay, which is its own kind of answer.
 */
export function jobOffers(
  d: Dynasty,
  league: readonly { name: string; str: number }[],
  rnd: Rng,
  /**
   * True if you have just been sacked.
   *
   * A sacked manager still works again, and almost always a rung down.
   * Somebody always comes for him, because somebody always needs one, so
   * the offers are certain rather than likely and the clubs are smaller.
   */
  sacked = false,
  /**
   * The clubs a career can actually be started at, and what their squad
   * is really rated.
   *
   * Two things at once, because they turn out to be the same thing. Not
   * every name in a division is one the database has a squad for, and
   * offering a job at a club that cannot be built is a button that does
   * nothing. And the rating in the offer has to be the rating you get:
   * a club's strength in your league drifts upwards across a long career
   * while its squad in the database does not, so an offer that quoted the
   * league said Newcastle were 98 and then handed over an 84.
   */
  manageable?: ReadonlyMap<string, number>,
  /** the division those clubs are in, which is the one you are in */
  division: 1 | 2 = 1,
): JobOffer[] {
  const rep = reputation(d);
  if (!sacked && rep < 34) return [];
  // Between none and two a summer, more often the better you have done.
  const many = sacked
    ? 2
    : rnd() < (rep - 30) / 180
      ? 2
      : rnd() < (rep - 24) / 90
        ? 1
        : 0;
  if (!many) return [];

  const mine = squadRating(starters(d));
  const real = manageable ? league.filter((c) => manageable.has(c.name)) : league;
  /* What the club is now, which is its level in your league rather than
     the squad the database froze in 2026. Taking the job brings that
     club's squad up to this number, so the offer and what arrives are the
     same thing. The map is still needed, because a club the database has
     never heard of cannot be managed at all. */
  const ratingOf = (_name: string, str: number) => clubRating(str);

  const pool = real.filter((c) => {
    const r = ratingOf(c.name, c.str);
    // A club will not sack its manager for somebody it does not rate.
    if (r > rep + (sacked ? 2 : 16)) return false;
    // Nor is a sacked manager choosy about how far down he starts again.
    if (!sacked && r < mine - 22) return false;
    return c.name !== d.club;
  });
  if (!pool.length) {
    /* Somewhere always needs a manager. If nothing in this division will
       have him, the weakest club in it will. */
    if (!sacked) return [];
    const last = [...real].sort((a, b) => a.str - b.str)[0];
    if (!last) return [];
    const r = ratingOf(last.name, last.str);
    return [
      {
        club: last.name,
        rating: r,
        objective: division === 2 ? 'Win promotion' : 'Avoid the relegation fight',
        budget: Math.round(Math.max(15, (r - 62) * 9)),
        note: 'A long way down from where you were',
        division,
      },
    ];
  }

  const out: JobOffer[] = [];
  const used = new Set<string>();
  for (let i = 0; i < many && pool.length; i++) {
    const club = pool[Math.floor(rnd() * pool.length)];
    if (!club || used.has(club.name)) continue;
    used.add(club.name);
    const rating = ratingOf(club.name, club.str);
    const better = rating > mine + 3;
    out.push({
      club: club.name,
      rating,
      division,
      objective:
        division === 2
          ? 'Win promotion'
          : rating >= 88
            ? 'Win the Premier League'
            : rating >= 82
              ? 'Champions League, top four'
              : rating >= 76
                ? 'European places, top seven'
                : rating >= 70
                  ? 'Top half finish'
                  : 'Avoid the relegation fight',
      budget: Math.round(Math.max(15, (rating - 62) * 9)),
      note: better
        ? 'A bigger job than the one you have'
        : rating < mine - 8
          ? 'A rebuild, and they know it'
          : 'A club about the size of yours',
    });
  }
  return out;
}
