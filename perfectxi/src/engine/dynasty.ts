import type { PlayedEuro } from './cups';
import type { Position, Slot } from './types';
import type { Rng } from './rng';
import { mulberry32 } from './rng';
import { AGE_CURVES, DOB } from '../data/dynasty';

/**
 * The Dynasty ageing engine.
 *
 * Ported from the web build's Dynasty 3.0 without changing a number. Every
 * curve, weight and threshold here is tuned and balanced against the rest
 * of the game, and the comment the site carries about its sources is worth
 * keeping: ageing is position specific and split across three attribute
 * tracks, because physical peaks early and falls fast, technical holds,
 * and mental keeps rising. Dendir 2016, Rey et al. 2022, Branquinho 2025,
 * UEFA injury data.
 *
 * Two departures from the site, both deliberate. Every random draw comes
 * from a seeded generator rather than Math.random, so a career can be
 * replayed and verified the way a season can. And the position curves come
 * from the shipped database rather than being written out again here,
 * because there should be one copy of a tuned number.
 *
 * Pure. Nothing in this file knows what a screen is.
 */

/** How much a position is worth in the transfer market. */
/* Keepers are the cheapest position in football. Raya went for €34m,
   Alisson and Ederson for about €25m each, and the world record for one
   is still under €80m. */
const POS_VALUE: Record<Position, number> = { ATT: 1.15, MID: 1.05, DEF: 0.9, GK: 0.68 };

export type Contract = {
  yrs: number;
  wage: number;
  /**
   * What he was on before a relegation clause cut it.
   *
   * Only set while the club is down, and only on the players who were
   * there when it happened. Anybody signed in the Championship never had
   * a cut, so promotion must not hand him a seventy percent rise.
   */
  full?: number;
};

export type DynastyPlayer = {
  n: string;
  nat: string;
  pos: Position;
  /** the club and season he was drafted from, kept for the badge */
  club: string;
  season: string;
  rtg: number;
  age: number;
  /**
   * How he feels about being here, 0 to 100.
   *
   * Seventy is content. Playing time, what he earns beside the men next
   * to him, where the club is going, and whether you turned down a move
   * he wanted. Under thirty five he asks to leave.
   */
  morale: number;
  /** bookings and matches missed last season */
  cards: number;
  reds: number;
  banned: number;
  /** the club he is out on loan at, academy players only */
  loan: string | null;
  /**
   * Every season he has spent out on loan.
   *
   * Kept on the player rather than the career, because it is his record
   * and it is the whole argument for having sent him: thirty games at
   * Preston and four rating points is a different footballer coming back.
   */
  loans: { s: number; club: string; apps: number; gained: number; to: number }[];
  /** the three tracks the rating is blended from */
  phys: number;
  tech: number;
  ment: number;
  pot: number;
  /** this player's own peak, a few years either side of the position's */
  peakOff: number;
  /** how fast this player in particular falls away */
  declMul: number;
  /** how prone he is to injury */
  prone: number;
  contract: Contract;
  apps: number;
  goals: number;
  assists: number;
  /** his average match rating last season, or null if he did not play */
  avgR: number | null;
  /** days lost to injury last season */
  daysOut: number;
  /** the worst injury he picked up, for the squad list */
  lastInj: string | null;
  /** seasons lost to injury, which leaves a permanent mark */
  injHist: number;
  /** the change in rating from the last ageing, for the report */
  delta: number;
  /** why the rating moved, in the player's own terms */
  why: string | null;
  retired: boolean;
  /** what is left of his transfer fee on the books, and the yearly charge */
  book: number;
  amort: number;
  amortLeft: number;
  /** came through the academy, so he has no book value and counts as homegrown */
  youth: boolean;
  /**
   * The season he arrived, or 0 for a man who was already here.
   *
   * One rule hangs off it: you cannot sell a footballer in the same
   * summer you signed him, and nobody bids for him either. Without it a
   * free agent signed for nothing and sold the same afternoon for forty
   * million is a money printer, and every other number in the mode stops
   * meaning anything.
   */
  joined: number;
  /** how many times he has been scouted, which narrows his reported ceiling */
  scout: number;
  /** one row a season, so a career can be read back */
  hist: {
    s: number;
    club: string;
    apps: number;
    g: number;
    a: number;
    r: number | null;
    rtg: number;
    fin: number;
  }[];
};

export type Tactic = {
  form: string;
  /** -2 defensive to +2 attacking */
  mentality: number;
  style: 'possession' | 'balanced' | 'direct';
  press: number;
  line: number;
  tempo: number;
  width: number;
  /** how well the squad knows the shape, 0.86 to 1 */
  fam: number;
};

export type Staff = {
  coach: number;
  medical: number;
  youth: number;
  setpiece: number;
  scout: number;
};

export type Infra = {
  stadium: number;
  training: number;
  academy: number;
  capacity: number;
  /** the club shop and everything behind it, 0 to 5 */
  retail: number;
};

export type Ledger = {
  rev: number;
  wages: number;
  amort: number;
  running: number;
  profit: number;
  rolling: number;
  breach: boolean;
  deduction: number;
};

export type SeasonRow = {
  s: number;
  fin: number;
  pts: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  met: boolean;
  rev: number;
  profit: number;
  ded: number;
  /** what was won that season, by competition */
  won?: string[];
  /** how far the cup runs got, so a season reads as a whole season */
  runs?: { id: string; fate: string }[];
  /** which club, because a career can have more than one */
  club?: string;
  /** which division it was played in */
  div?: 1 | 2;
};

export type AllTime = {
  n: string;
  pos: Position;
  apps: number;
  g: number;
  a: number;
  seasons: number;
  best: number;
  rSum: number;
  rN: number;
};

export type InboxItem = {
  t: string;
  b: string;
  /** news, board, good or bad, which decides its colour */
  k: 'news' | 'board' | 'good' | 'bad';
  s: number;
};

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

/** Box-Muller, so the noise is normal rather than flat. */
function gauss(rnd: Rng): number {
  const u = 1 - rnd();
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function rint(a: number, b: number, rnd: Rng): number {
  return a + Math.floor(rnd() * (b - a + 1));
}

function curve(pos: Position) {
  return AGE_CURVES[pos] ?? AGE_CURVES.MID;
}

/** The overall, blended from the three tracks by the position's weights. */
export function overall(p: {
  pos: Position;
  phys: number;
  tech: number;
  ment: number;
}): number {
  const w = curve(p.pos).w;
  return Math.round(clamp(p.phys * w[0] + p.tech * w[1] + p.ment * w[2], 40, 99));
}

/**
 * How old a player was in the season he was drafted from.
 *
 * The database records a birth year and whether he was born after the
 * first of August, which is the convention the ratings were built on. A
 * player the database has never heard of falls back to a plausible age for
 * his position rather than breaking the career.
 */
export function ageIn(name: string, seasonYear: number, pos: Position): number {
  const dob = DOB[name];
  if (!dob) return pos === 'GK' ? 28 : 26;
  const age = seasonYear - dob[0] - dob[1];
  return clamp(age, 16, 44);
}

/** "2003/04" back to 2003. */
export function seasonYear(season: string): number {
  const n = parseInt(season.slice(0, 4), 10);
  return Number.isFinite(n) ? n : 2024;
}

/**
 * Build the three tracks from a single rating and an age.
 *
 * A young player carries more physical than technical and a veteran the
 * reverse, so the same 85 is a different player at 21 and at 33. The
 * tracks are then nudged until they blend back to the rating he arrived
 * with, because the draft already decided how good he is.
 */
export type PlayerSeed = {
  n: string;
  nat: string;
  pos: Position;
  club: string;
  season: string;
  rtg: number;
  age: number;
  contract: Contract;
  pot?: number;
  youth?: boolean;
};

export function seedTracks(base: PlayerSeed, rnd: Rng): DynastyPlayer {
  const c = curve(base.pos);
  const youth = clamp((c.phys + 2 - base.age) / 8, -1, 1);

  const p: DynastyPlayer = {
    ...base,
    apps: 0,
    goals: 0,
    assists: 0,
    avgR: null,
    morale: 70,
    loans: [],
    cards: 0,
    reds: 0,
    banned: 0,
    loan: null,
    daysOut: 0,
    lastInj: null,
    injHist: 0,
    book: 0,
    amort: 0,
    amortLeft: 0,
    youth: base.youth ?? false,
    joined: 0,
    scout: 0,
    hist: [],
    phys: clamp(Math.round(base.rtg + youth * 4 + gauss(rnd) * 2), 40, 99),
    tech: clamp(Math.round(base.rtg - youth * 3 + gauss(rnd) * 2), 40, 99),
    ment: clamp(Math.round(base.rtg - youth * 4 + gauss(rnd) * 2), 40, 99),
    peakOff: Math.round(clamp(gauss(rnd) * 1.5, -3, 3)),
    declMul: clamp(Math.exp(gauss(rnd) * 0.25), 0.55, 1.8),
    prone: clamp(1 + gauss(rnd) * 0.22, 0.7, 1.5),
    pot: base.pot ?? 0,
    delta: 0,
    why: null,
    retired: false,
  };

  if (!base.pot) {
    const head = Math.max(0, c.phys + p.peakOff - p.age);
    p.pot = clamp(
      Math.round(base.rtg + (head > 0 ? rint(2, 10, rnd) : rint(0, 3, rnd)) + gauss(rnd) * 3),
      base.rtg,
      99,
    );
  }

  // Nudge all three until the blend matches the rating he came in with.
  let got = overall(p);
  let guard = 0;
  while (got !== base.rtg && guard < 40) {
    const step = base.rtg > got ? 1 : -1;
    p.phys = clamp(p.phys + step, 35, 99);
    p.tech = clamp(p.tech + step, 35, 99);
    p.ment = clamp(p.ment + step, 35, 99);
    got = overall(p);
    guard++;
  }
  p.rtg = overall(p);
  return p;
}

/**
 * Did he sign this summer?
 *
 * Anybody who was here before this rule existed reads as zero, which is
 * no season at all, so an old career loses nothing by it.
 */
export function signedThisSeason(d: Dynasty, p: DynastyPlayer): boolean {
  const joined = typeof p.joined === 'number' ? p.joined : 0;
  return joined > 0 && joined === d.year;
}

/**
 * Whether he can be sold at all, and what to say when he cannot.
 *
 * One place, so the button, the offer and the engine all agree. A screen
 * that offers a sale the engine then refuses reads as the game being
 * broken, because from where the player is sitting it is.
 */
export function saleBlock(d: Dynasty, p: DynastyPlayer | null): string | null {
  if (!p) return null;
  if (signedThisSeason(d, p)) return 'Signed this summer. He can go next year.';
  if (p.loan) return 'Out on loan. He cannot be sold from here.';
  return null;
}

/** One season of ageing for one track. */
function trackStep(
  cur: number,
  pot: number,
  age: number,
  peak: number,
  kind: 'phys' | 'tech' | 'ment',
  declMul: number,
  rnd: Rng,
  growMul = 1,
): number {
  let d: number;
  if (age < peak) {
    // Growth towards potential, fastest when furthest away.
    const gap = Math.max(0, pot - cur);
    d = gap * 0.3 * (kind === 'phys' ? 1.1 : kind === 'tech' ? 1.0 : 0.85) * growMul;
    d = Math.min(d, 4.5);
  } else {
    const past = age - peak;
    if (kind === 'phys') {
      d = -(past <= 2 ? 0.5 : past <= 5 ? 1.5 : past <= 7 ? 2.6 : 3.6) * declMul;
    } else if (kind === 'tech') {
      d = past <= 1 ? 0.25 : past <= 4 ? 0 : -0.5 * declMul;
    } else {
      d = past <= 4 ? 0.35 : past <= 7 ? 0.1 : -0.35 * declMul;
    }
  }
  return clamp(cur + d + gauss(rnd) * 0.6, 35, 99);
}

/**
 * Put one player through a season.
 *
 * The rating cannot move more than six either way in one year, which is
 * what stops a career turning over in a single summer.
 */
export function ageOne(p: DynastyPlayer, rnd: Rng, mod = 1): DynastyPlayer {
  const c = curve(p.pos);
  const off = p.peakOff;
  const m = p.declMul;
  const before = p.rtg;

  // Form and minutes speed growth while a player is still climbing, and
  // steepen the fall a little once he is past it. They never replace the
  // curve, only bend it.
  const growing = p.age < c.phys + off;
  const gm = growing ? mod : 1;
  const dm = growing ? 1 : 2 - clamp(mod, 0.7, 1.3);

  const next: DynastyPlayer = {
    ...p,
    age: p.age + 1,
    phys: trackStep(p.phys, p.pot, p.age, c.phys + off, 'phys', m * c.dec * dm, rnd, gm),
    tech: trackStep(p.tech, p.pot, p.age, c.tech + off, 'tech', m * dm, rnd, gm),
    ment: trackStep(p.ment, p.pot, p.age, c.ment + off, 'ment', m * dm, rnd, gm),
  };

  // Injury history leaves a permanent mark on the physical track.
  if (next.injHist) next.phys = clamp(next.phys - next.injHist * 0.6, 35, 99);

  next.rtg = overall(next);
  if (next.rtg - before > 6) next.rtg = before + 6;
  if (next.rtg - before < -6) next.rtg = before - 6;
  next.delta = next.rtg - before;
  return next;
}

/**
 * The chance a player walks away at the end of this season.
 *
 * Age sets the baseline and quality decides who actually goes: a 99 is
 * about ten times less likely to retire than a 70 at the same age, which
 * is why the great ones play into their late thirties and fringe players
 * drift out at thirty two.
 */
export function retireOdds(p: DynastyPlayer): number {
  const a = p.age - (curve(p.pos).ret ?? 0);
  if (a < 31) return 0;

  let base =
    a === 31 ? 0.01
    : a === 32 ? 0.04
    : a === 33 ? 0.1
    : a === 34 ? 0.2
    : a === 35 ? 0.33
    : a === 36 ? 0.48
    : a === 37 ? 0.64
    : a === 38 ? 0.8
    : a === 39 ? 0.91
    : 0.97;

  base *= clamp((80 - p.rtg) / 12 + 1, 0.07, 1.9);

  // Form buys a great player years and a fringe player months.
  if (p.rtg < 82 && a >= 34) base = Math.max(base, 0.1 + (a - 34) * 0.09);
  // A body eventually gives out however good the player is.
  if (a >= 39) base = Math.max(base, 0.35);
  if (a >= 41) base = Math.max(base, 0.7);
  if (a >= 43) base = Math.max(base, 0.92);

  if (p.injHist) base *= 1 + Math.min(1.2, p.injHist * 0.3);
  if (p.rtg < 62 && a > 33) base *= 1.6;

  return clamp(base, 0, 0.97);
}

/* ---------- what a player is worth, and what he costs ---------- */

const AGE_VALUE: readonly [number, number][] = [
  [18, 0.86], [19, 0.92], [20, 0.96], [21, 0.99], [22, 1.0], [23, 1.0],
  [24, 0.97], [25, 0.93], [26, 0.88], [27, 0.82], [28, 0.72], [29, 0.62],
  [30, 0.52], [31, 0.41], [32, 0.31], [33, 0.22], [34, 0.15], [35, 0.09],
  [36, 0.05],
];

function ageValueMul(age: number): number {
  if (age <= 18) return 0.86;
  for (const [a, m] of AGE_VALUE) if (a === age) return m;
  return 0.03;
}

/**
 * What is left on the deal.
 *
 * A short contract is a discount because he can walk, but it used to be a
 * bigger one than the player himself: a 92 on two years and an 84 on
 * three came out nine million apart, when the real gap between those two
 * footballers is more than double. A year off a deal is worth about a
 * tenth of a player, not a third of him.
 */
function contractMul(yrs: number): number {
  return yrs >= 4 ? 1.0 : yrs === 3 ? 0.92 : yrs === 2 ? 0.82 : yrs === 1 ? 0.6 : 0.1;
}

/**
 * Transfer value in £m.
 *
 * A quadratic on how far above 62 a player is. Sixty two is roughly where
 * a footballer stops being a transfer asset at all, so the curve starts
 * from nothing there and steepens: a 70 is £8m, an 85 is £67m, and a 92
 * attacker at his peak is £124m. Do not flatten it. The gap between very
 * good and great is the whole reason a great player feels unaffordable.
 *
 * The web build carries two versions of this and the later one, a sixth
 * power, is the one that actually runs there. It agrees at the top and
 * priced the lower end far too high, valuing a squad player at £22m. This
 * is the quadratic from the specification, chosen deliberately.
 */
export function value(rtg: number, age: number, pos: Position, yrs = 3): number {
  /* The quadratic through the middle was right and is untouched. What it
     could not do was either end.

     At the top, the market stops being a curve. Checked against
     Transfermarkt: Haaland €180m, Bellingham €180m, Saliba €100m,
     Gabriel €75m, Timber €50m, Calafiori €55m. An 89 rated defender is
     worth well over twice an 83, and the plain quadratic made it a third
     more. The premium above 86 is that gap.

     At the bottom, a 70 rated squad player is a £4m footballer, not an
     £8m one, so anything under 76 is discounted toward what a reserve
     actually fetches. */
  const quality =
    Math.min(1.55, 1 + Math.max(0, rtg - 86) * 0.045) *
    Math.max(0.45, 1 - Math.max(0, 76 - rtg) * 0.045);
  const base = 0.12 * Math.pow(Math.max(0, rtg - 62), 2) * quality;
  return Math.max(1, Math.round(base * ageValueMul(age) * contractMul(yrs) * POS_VALUE[pos]));
}

export function playerValue(p: DynastyPlayer): number {
  return value(p.rtg, p.age, p.pos, p.contract.yrs);
}

/**
 * Weekly wage in thousands. A 65 rated squad player is about £30k.
 *
 * The curve through the middle of the league was already right: a 78 on
 * about £100k and an 84 on about £155k is what a Premier League starter
 * earns. What it could not do was the very top, where the market stops
 * being a curve. Haaland is on £525k a week, Salah £400k, and the old
 * formula topped out near £270k for anybody. The premium above 88 is that
 * cliff, and it touches one or two players in a squad rather than the
 * wage bill as a whole.
 */
export function wage(rtg: number, age: number): number {
  let w = Math.pow(Math.max(40, rtg) / 50, 6) * 7.0;
  w *= Math.min(1.7, 1 + Math.max(0, rtg - 88) * 0.12);
  if (age < 21) w *= 0.45;
  else if (age < 24) w *= 0.75;
  else if (age > 32) w *= 0.85;
  return Math.max(3, Math.round(w));
}

/* ---------- the career ---------- */

export type Dynasty = {
  seed: number;
  club: string;
  /** the season number, starting at 1 */
  year: number;
  formation: string;
  mode: 'simple' | 'immersive';
  scenario: string;
  /**
   * Fourteen places: the eleven in formation order, then three
   * substitutes. A place with nobody in it is null rather than missing,
   * because the shape has to hold its shape.
   */
  roster: (DynastyPlayer | null)[];
  slots: Position[];
  /** board confidence, 0 to 99. Twenty or under and you are gone. */
  mgr: number;
  /** transfer money, in £m */
  budget: number;
  /** how much patience the board has, from the scenario */
  leash: number;
  objective: { label: string; target: number };
  capacity: number;
  /**
   * Which European competition the club is in this season, earned by last
   * season's finish and last season's cups.
   */
  europe: 'ucl' | 'uel' | 'uecl' | null;
  /** every trophy the club has won under you, by competition */
  honours: Record<string, number>;
  /** which division, 1 for the Premier League and 2 for the Championship */
  division: 1 | 2;
  /** the nineteen clubs you play, which changes every summer */
  league: { name: string; str: number; var: number }[];
  /** the division below, so clubs that go down can come back */
  below: { name: string; str: number; var: number }[];
  /** seasons of parachute payment left after a relegation */
  parachute: number;
  /** bids other clubs have made for your players this summer */
  offers: {
    slot: number;
    name: string;
    club: string;
    clubRating: number;
    fee: number;
    worth: number;
    stepUp: boolean;
    abroad: boolean;
  }[];
  /** clubs that want you to manage them */
  jobs: {
    club: string;
    rating: number;
    /** what they want, as a heading */
    objective: string;
    /**
     * The same thing, as a clause that reads inside a sentence.
     *
     * Optional only so a career saved before it existed still reads. An
     * offer without one falls back to the objective, which is what used
     * to be lower cased into the sentence and did not read.
     */
    clause?: string;
    budget: number;
    /** what they are, in one line */
    note: string;
    /**
     * Which division the club is in.
     *
     * Optional only so a career saved before it existed still reads. Any
     * offer without one is treated as the top flight, which is what the
     * code used to assume for every offer whether it was true or not.
     */
    division?: 1 | 2;
  }[];
  /** send academy players out on loan without being asked */
  autoLoan: boolean;
  /**
   * Whether footballers get injured at all.
   *
   * On by default in a new career because it is football, and a switch
   * because it is a game and losing your best player for a hundred and
   * ninety six days is not everybody's idea of one.
   */
  injuriesOn: boolean;
  /** how the derby has gone under you */
  derby: { w: number; d: number; l: number };
  /**
   * Every club you have managed, in order.
   *
   * A career belongs to the manager, not to the club. Taking the Newcastle
   * job does not delete what you did at Sunderland.
   */
  spells: {
    club: string;
    from: number;
    to: number;
    seasons: number;
    titles: number;
    cups: number;
    best: number;
  }[];
  /** last season's cup runs, kept so the cabinet can show them */
  lastCups: unknown | null;
  /**
   * The Community Shield tie this season, earned last season.
   *
   * Null unless you were champions or won the FA Cup, because those are
   * the only two ways into it.
   */
  shield: {
    club: string;
    rating: number;
    as: 'champions' | 'holders';
    they: 'champions' | 'holders' | 'runners-up';
  } | null;
  /**
   * The following, in millions.
   *
   * Fans are won by winning and by signing players people want to watch,
   * and they are what merchandise is sold to. A club that finishes fourth
   * with a stacked squad is worth more off the pitch than one that
   * finishes fourth with eleven journeymen.
   */
  fans: number;
  rival: string | null;
  tactic: Tactic;
  staff: Staff;
  infra: Infra;
  /** the academy, not yet in the roster */
  youth: DynastyPlayer[];
  /** everyone who has retired out of this career, newest first */
  retired: DynastyPlayer[];
  /** one entry per season played */
  seasons: SeasonRow[];
  titles: number;
  /** career totals for everyone who has played for you */
  allTime: Record<string, AllTime>;
  records: { bestPts: number; bestFin: number; unbeaten: number };
  inbox: InboxItem[];
  /** the last three seasons of profit, which is what PSR is judged on */
  psr: number[];
  /** profit banked from sales this season, before the books are closed */
  saleProfit: number;
  /** points deducted this season, if the books did not add up */
  psrHit: number;
  /**
   * How many times the market has been looked at again this season.
   *
   * Three, then it is the list you have until the summer. Without a limit
   * the market is not a market, it is a slot machine you pull until the
   * right player appears.
   */
  marketRolls: number;
  ledger: Ledger | null;
  /** who left, and how, this summer */
  expired: string[];
  renewed: string[];
  sold: string[];
  /** who is injured right now, by name */
  injuries: string[];
  sacked: boolean;
  /**
   * A European campaign played match by match rather than simulated.
   *
   * Set when you take the club into the real Champions League from the
   * hub, and read once when the season is closed: the season builds its
   * European run out of this instead of drawing one, so the trophy and
   * the money are the ones you actually won. Cleared with the season, so
   * it can never be counted twice.
   */
  euro?: (PlayedEuro & { year: number }) | null;
};

export const EMPTY_TACTIC: Tactic = {
  form: '4-3-3',
  mentality: 0,
  style: 'balanced',
  press: 0,
  line: 0,
  tempo: 0,
  width: 0,
  fam: 0.9,
};

export const EMPTY_STAFF: Staff = {
  coach: 2,
  medical: 2,
  youth: 2,
  setpiece: 1,
  scout: 2,
};

/** A seed of the career's own, so ageing never disturbs a season's draw. */
export function careerSeed(seed: number, year: number): number {
  let h = (seed ^ Math.imul(year + 1, 0x27d4eb2f)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2545f491) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}

/**
 * Take a finished XI and make a career out of it.
 *
 * The "create your own club" route. The three substitute places start
 * empty, because a drafted eleven is exactly eleven.
 */
export function startDynasty(
  squad: Slot[],
  formation: string,
  club: string,
  seed: number,
): Dynasty {
  const rnd = mulberry32(careerSeed(seed, 0));
  const roster: (DynastyPlayer | null)[] = [];
  const slots: Position[] = [];

  for (const slot of squad) {
    slots.push(slot.pos);
    const p = slot.player;
    if (!p) {
      roster.push(null);
      continue;
    }
    const age = ageIn(p.n, seasonYear(p.season), slot.pos);
    roster.push(
      seedTracks(
        {
          n: p.n,
          nat: p.nat,
          pos: slot.pos,
          club: p.club,
          season: p.season,
          rtg: p.rtg,
          age,
          contract: { yrs: rint(2, 4, rnd), wage: wage(p.rtg, age) },
        },
        rnd,
      ),
    );
  }

  slots.push('DEF', 'MID', 'ATT');
  roster.push(null, null, null);

  const filled = roster.filter((p): p is DynastyPlayer => p !== null);
  const avg = filled.length ? filled.reduce((s, p) => s + p.rtg, 0) / filled.length : 0;
  const target = avg >= 90 ? 1 : avg >= 87 ? 2 : avg >= 84 ? 4 : avg >= 80 ? 7 : avg >= 76 ? 10 : 17;

  return {
    seed,
    club,
    year: 1,
    formation,
    mode: 'simple',
    scenario: 'own',
    roster,
    slots,
    mgr: 55,
    budget: 60,
    leash: 1,
    objective: {
      label:
        target <= 1 ? 'Win the Premier League'
        : target <= 2 ? 'Finish in the top two'
        : target <= 4 ? 'Champions League, top four'
        : target <= 7 ? 'European places, top seven'
        : target <= 10 ? 'Top half finish'
        : 'Avoid the relegation fight',
      target,
    },
    capacity: 40000,
    europe: null,
    honours: {},
    division: 1,
    league: [],
    below: [],
    parachute: 0,
    offers: [],
    jobs: [],
    autoLoan: false,
    injuriesOn: false,
    derby: { w: 0, d: 0, l: 0 },
    spells: [],
    lastCups: null,
    shield: null,
    fans: 2.9,
    rival: null,
    retired: [],
    seasons: [],
    titles: 0,
    tactic: { ...EMPTY_TACTIC, form: formation },
    staff: { ...EMPTY_STAFF },
    infra: { stadium: 0, training: 2, academy: 2, capacity: 40000, retail: 1 },
    youth: [],
    allTime: {},
    records: { bestPts: 0, bestFin: 20, unbeaten: 0 },
    inbox: [],
    psr: [],
    saleProfit: 0,
    psrHit: 0,
    marketRolls: 0,
    ledger: null,
    expired: [],
    renewed: [],
    sold: [],
    injuries: [],
    sacked: false,
  };
}

export type AgeingReport = {
  improved: DynastyPlayer[];
  declined: DynastyPlayer[];
  retired: DynastyPlayer[];
  /** the squad average before and after */
  before: number;
  after: number;
};

/**
 * Roll the career on one year.
 *
 * Everyone ages, contracts run down, and the ones the hazard catches
 * retire. The report is what the player actually reads: who got better,
 * who fell away, and who is gone.
 */
export function advanceSeason(d: Dynasty): { dynasty: Dynasty; report: AgeingReport } {
  const rnd = mulberry32(careerSeed(d.seed, d.year));
  const before = squadRating(starters(d));

  const kept: (DynastyPlayer | null)[] = [];
  const gone: DynastyPlayer[] = [];
  const improved: DynastyPlayer[] = [];
  const declined: DynastyPlayer[] = [];

  for (const p of d.roster) {
    if (!p) {
      kept.push(null);
      continue;
    }
    const aged = ageOne(p, rnd);
    aged.contract = {
      yrs: Math.max(0, aged.contract.yrs - 1),
      wage: wage(aged.rtg, aged.age),
    };

    if (rnd() < retireOdds(aged)) {
      gone.push({ ...aged, retired: true });
      // A retirement leaves the place empty rather than shuffling the
      // shape, so you can see exactly where the hole is.
      kept.push(null);
      continue;
    }
    kept.push(aged);
    if (aged.delta > 0) improved.push(aged);
    else if (aged.delta < 0) declined.push(aged);
  }

  improved.sort((a, b) => b.delta - a.delta);
  declined.sort((a, b) => a.delta - b.delta);

  const next: Dynasty = {
    ...d,
    year: d.year + 1,
    roster: kept,
    retired: [...gone, ...d.retired],
  };

  return {
    dynasty: next,
    report: {
      improved,
      declined,
      retired: gone,
      before,
      after: squadRating(starters(next)),
    },
  };
}

/** The eleven, which is what the match engine and the strength look at. */
export function starters(d: Dynasty): DynastyPlayer[] {
  return d.roster.slice(0, 11).filter((p): p is DynastyPlayer => p !== null);
}

/** The three on the bench. Depth, not strength. */
export function bench(d: Dynasty): DynastyPlayer[] {
  return d.roster.slice(11).filter((p): p is DynastyPlayer => p !== null);
}

/** Everyone under contract, in roster order. */
export function everyone(d: Dynasty): DynastyPlayer[] {
  return d.roster.filter((p): p is DynastyPlayer => p !== null);
}

export function squadRating(squad: readonly DynastyPlayer[]): number {
  if (!squad.length) return 0;
  return Math.round(squad.reduce((s, p) => s + p.rtg, 0) / squad.length);
}

/** Total transfer value of the squad, in £m. */
export function squadValue(squad: readonly DynastyPlayer[]): number {
  return squad.reduce((s, p) => s + playerValue(p), 0);
}

/** The wage bill for a season, in £m. Wages are weekly and in thousands. */
export function wageBill(squad: readonly DynastyPlayer[]): number {
  return Math.round((squad.reduce((s, p) => s + p.contract.wage, 0) * 52) / 1000);
}

/** The XI as the match engine wants it, so a dynasty season uses the same maths. */
export function asSquad(squad: readonly DynastyPlayer[]): Slot[] {
  return squad.map((p) => ({
    pos: p.pos,
    player: {
      n: p.n,
      nat: p.nat,
      pos: [p.pos],
      rtg: p.rtg,
      club: p.club,
      season: p.season,
    },
  }));
}
