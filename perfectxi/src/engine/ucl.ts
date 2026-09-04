import { UCL_CLUBS, UCL_SQUADS, type UclPlayer } from '../data/ucl';
import { SQUADS } from '../data/squads';
import { dcExpected, poissonR, strFromAvg } from './sim';
import type { CupLeg, PlayedEuro } from './cups';
import { mulberry32, type Rng } from './rng';

/**
 * The Champions League.
 *
 * The real format, which changed in 2024 and is nothing like the old one.
 * Thirty six clubs in a single league table. Everybody plays eight
 * different opponents, two from each of the four seeding pots, four at
 * home and four away. The top eight go straight to the last sixteen. Ninth
 * to twenty fourth play a two legged play-off for the other eight places.
 * Twenty fifth to thirty sixth are out, with nothing to drop into.
 *
 * From the last sixteen it is two legs a round on aggregate, no away
 * goals, extra time and penalties in the second leg, and a single match at
 * a neutral ground for the final.
 *
 * The difference from the World Cup, and the reason it is a separate mode
 * rather than a setting, is the league phase: eight matchdays where the
 * whole field plays at once and the table is the story. You can watch
 * those one at a time or skip them, and from the play-off onwards it is
 * one match at a time whether you like it or not.
 *
 * Pure, seeded, and it replays exactly. Nothing here knows what a screen
 * is.
 */

export type UclStage = 'league' | 'po' | 'r16' | 'qf' | 'sf' | 'final' | 'done';

export const UCL_STAGE_NAME: Record<UclStage, string> = {
  league: 'League Phase',
  po: 'Knockout Play-off',
  r16: 'Round of 16',
  qf: 'Quarter-Final',
  sf: 'Semi-Final',
  final: 'Final',
  done: 'Over',
};

/** The knockout rounds, in order. */
export const UCL_ROUNDS: readonly UclStage[] = ['r16', 'qf', 'sf', 'final'];

/** Matchdays in the league phase. */
export const UCL_MATCHDAYS = 8;

export type UclMatch = {
  stage: UclStage;
  /** the matchday in the league phase, or the leg of a tie */
  n: number;
  /** the two clubs. `a` is always you in your own fixtures. */
  a: string;
  b: string;
  /** true when `a` is at home. False for a neutral final. */
  home: boolean;
  /** true when nobody is at home, which is only ever the final */
  neutral: boolean;
  ga: number;
  gb: number;
  pens: { a: number; b: number } | null;
  /** the score after ninety minutes */
  ga90?: number;
  gb90?: number;
  et?: boolean;
  played: boolean;
  /** the aggregate once this leg has been played */
  agg?: { a: number; b: number };
};

export type UclRow = {
  club: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
};

/** An XI you drafted rather than a club that qualified. */
export type UclCustom = {
  name: string;
  rating: number;
  squad: UclPlayer[];
};

export type UclRun = {
  seed: number;
  /** the club you are managing, which is also your place in the draw */
  you: string;
  custom?: UclCustom | null;
  stage: UclStage;
  played: UclMatch[];
  /** what is still to come, front first */
  ahead: UclMatch[];
  table: UclRow[];
  /** the thirty six in final league order, once the phase is done */
  order: string[];
  /** where every club finished the league phase, by club */
  rank: Record<string, number>;
  /** who is left in the bracket, in seeded order */
  alive: string[];
  /** the tie you are in the middle of */
  agg: { a: number; b: number } | null;
  /** goals and assists by your own players */
  squad: Record<string, { g: number; a: number }>;
  cleanSheets: number;
  over: boolean;
  outAt: UclStage | null;
  won: boolean;
  /** the rest of the field's scorers, for the golden boot */
  world: UclWorldScorer[];
  /**
   * The Dynasty career this campaign belongs to, if it belongs to one.
   *
   * A campaign started from a career is that career's European season and
   * is handed back to it when it ends. A campaign started from the front
   * door belongs to nobody and this is null.
   */
  owner?: { club: string; year: number } | null;
};

export type UclWorldScorer = {
  club: string;
  n: string;
  goals: number;
};

/* ---------- the clubs ---------- */

export function uclClub(name: string) {
  return UCL_CLUBS[name];
}

/** Every club, strongest first, for the screen that picks one. */
export function uclClubs(): {
  name: string;
  country: string;
  pot: number;
  tier: number;
  coeff: number;
  odds: number;
  route: string;
}[] {
  return Object.keys(UCL_CLUBS)
    .map((name) => {
      const c = UCL_CLUBS[name];
      return {
        name,
        country: c.country,
        pot: c.pot,
        tier: Math.round(c.tier),
        coeff: c.coeff,
        odds: c.odds,
        route: c.route,
      };
    })
    .sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name));
}

/**
 * The weakest club in the competition.
 *
 * A drafted XI has to take somebody's place, because there are thirty six
 * and there is no thirty seventh. It takes the weakest one, so the draft
 * never turns into a second decision about which club to displace and
 * never lets a player hand themselves a pot one seeding by choosing a seat
 * rather than a side.
 */
export function uclWeakest(): string {
  const all = uclClubs();
  return all[all.length - 1]?.name ?? Object.keys(UCL_CLUBS)[0];
}

/** The nine in a pot, best coefficient first. */
export function potOf(pot: number): string[] {
  return Object.keys(UCL_CLUBS)
    .filter((n) => UCL_CLUBS[n].pot === pot)
    .sort((a, b) => UCL_CLUBS[a].coeff - UCL_CLUBS[b].coeff || a.localeCompare(b));
}

/* ---------- the squads ---------- */

/*
 * Five clubs arrive with only their best five players named, because that
 * is all the source had for them. A club cannot play a European tie with
 * five men, so the rest of the squad is filled in around them at the
 * club's own strength. The named players are never touched, the filler is
 * the same every time for a given club, and it is only ever the supporting
 * cast: it cannot outrank anybody the file actually named.
 */

const FILL_FIRST = [
  'Luca', 'Mateo', 'Niklas', 'Andrei', 'Tomas', 'Pedro', 'Emil', 'Ivan',
  'Jonas', 'Marko', 'Diogo', 'Kai', 'Aleks', 'Rasmus', 'Milan', 'Youssef',
  'Nico', 'Stefan', 'Adrien', 'Josip',
];

const FILL_LAST = [
  'Varga', 'Novak', 'Berger', 'Costa', 'Lindqvist', 'Moreau', 'Petrov',
  'Kovac', 'Reinders', 'Silva', 'Haugen', 'Bauer', 'Ferrari', 'Nowak',
  'Andersen', 'Dumitru', 'Lorenzo', 'Vidal', 'Keller', 'Marino',
];

const NEED: { pos: string; count: number }[] = [
  { pos: 'GK', count: 2 },
  { pos: 'DEF', count: 6 },
  { pos: 'MID', count: 6 },
  { pos: 'ATT', count: 4 },
];

function hashOf(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

const squadCache = new Map<string, UclPlayer[]>();

/**
 * A club's squad, whichever database it lives in.
 *
 * The five English clubs are not in the tournament file: their full squads
 * are already in the league database under the identical key, and copying
 * them would give the game two Arsenals that could drift apart.
 */
export function uclSquad(name: string): UclPlayer[] {
  const held = squadCache.get(name);
  if (held) return held;

  const key = `${name}|2026`;
  const real: UclPlayer[] = (UCL_SQUADS[key] as UclPlayer[] | undefined) ??
    (SQUADS[key] as UclPlayer[] | undefined) ??
    [];

  const out = [...real];
  const club = UCL_CLUBS[name];
  if (club) {
    const rnd = mulberry32(hashOf(name));
    const top = real.length ? Math.max(...real.map((p) => p.rtg)) : Math.round(club.tier);
    /* Two squad players with the same name is one player as far as
       anything downstream is concerned, so names are drawn until they are
       new to this club. */
    const used = new Set(out.map((p) => p.n));
    for (const need of NEED) {
      let have = out.filter((p) => (p.pos[0] ?? '') === need.pos).length;
      let guard = 0;
      while (have < need.count && guard++ < 40) {
        let who = '';
        let tries = 0;
        do {
          who = `${FILL_FIRST[Math.floor(rnd() * FILL_FIRST.length)]} ${
            FILL_LAST[Math.floor(rnd() * FILL_LAST.length)]
          }`;
        } while (used.has(who) && tries++ < 60);
        if (used.has(who)) continue;
        used.add(who);

        /* A squad player: below the club's own level, and never above
           anybody the database actually named. */
        const rtg = Math.max(
          58,
          Math.min(top - 1, Math.round(club.tier - 3 - rnd() * 6)),
        );
        out.push({ n: who, nat: club.country, pos: [need.pos], rtg, prime: rtg + 1 });
        have++;
      }
    }
  }

  squadCache.set(name, out);
  return out;
}

/* ---------- who you actually are ---------- */

export function ratingOf(run: UclRun, club: string): number {
  if (club === run.you && run.custom) return run.custom.rating;
  return UCL_CLUBS[club]?.tier ?? 74;
}

export function squadOf(run: UclRun, club: string): UclPlayer[] {
  if (club === run.you && run.custom) return run.custom.squad;
  return uclSquad(club);
}

export function nameOf(run: UclRun, club: string): string {
  if (club === run.you && run.custom) return run.custom.name;
  return club;
}

/* ---------- the fixture list ---------- */

/**
 * Eight matchdays, built rather than drawn.
 *
 * The real draw is done by a computer nobody has seen, under a set of
 * constraints: two opponents from each pot, four at home and four away,
 * one match a matchday. This builds a schedule that satisfies those
 * constraints directly.
 *
 * Six of the matchdays pair pots against each other, which is exact. The
 * last two are the same-pot games, and a pot of nine is odd, so one club
 * per pot is left over on each of those days. Those four are paired across
 * pots instead. It costs eight club-matchdays out of two hundred and
 * eighty eight the strict two-per-pot rule, and it buys a schedule where
 * every club plays exactly once every matchday, which is what anybody
 * looking at the table would notice first.
 */
type RawFixture = { x: string; y: string; day: number };

let fixtureCache: UclMatch[] | null = null;

function buildRaw(): RawFixture[] {
  const pots = [potOf(1), potOf(2), potOf(3), potOf(4)];
  const at = (p: number, i: number) => pots[p][((i % 9) + 9) % 9];
  const out: RawFixture[] = [];
  const pair = (day: number, a: string, b: string) => out.push({ x: a, y: b, day });

  /* Cross pot: each pair of pots meets on two matchdays, at two offsets
     that are never nought, which is what keeps the last two days free. */
  for (let i = 0; i < 9; i++) {
    pair(0, at(0, i), at(1, i));
    pair(0, at(2, i), at(3, i));
    pair(1, at(0, i), at(1, i + 1));
    pair(1, at(2, i), at(3, i + 1));
    pair(2, at(0, i), at(2, i + 2));
    pair(2, at(1, i), at(3, i + 2));
    pair(3, at(0, i), at(2, i + 3));
    pair(3, at(1, i), at(3, i + 3));
    pair(4, at(0, i), at(3, i + 2));
    pair(4, at(1, i), at(2, i + 2));
    pair(5, at(0, i), at(3, i + 3));
    pair(5, at(1, i), at(2, i + 3));
  }

  /* Same pot, and the four left over each day. */
  for (let p = 0; p < 4; p++) {
    pair(6, at(p, 0), at(p, 1));
    pair(6, at(p, 2), at(p, 3));
    pair(6, at(p, 4), at(p, 5));
    pair(6, at(p, 6), at(p, 7));
    pair(7, at(p, 1), at(p, 2));
    pair(7, at(p, 3), at(p, 4));
    pair(7, at(p, 5), at(p, 6));
    pair(7, at(p, 7), at(p, 8));
  }
  pair(6, at(0, 8), at(2, 8));
  pair(6, at(1, 8), at(3, 8));
  pair(7, at(0, 0), at(3, 0));
  pair(7, at(1, 0), at(2, 0));

  return out;
}

/**
 * Who is at home.
 *
 * Every club plays eight, so every club has an even number of matches, so
 * the fixture list has an Eulerian circuit. Walking it and calling every
 * step a home match gives every club exactly four home and four away.
 * There is no tuning here and no way for it to come out uneven.
 */
function orient(raw: RawFixture[]): UclMatch[] {
  const edges = raw.map((f, i) => ({ ...f, i, used: false }));
  const around = new Map<string, number[]>();
  for (const e of edges) {
    if (!around.has(e.x)) around.set(e.x, []);
    if (!around.has(e.y)) around.set(e.y, []);
    around.get(e.x)!.push(e.i);
    around.get(e.y)!.push(e.i);
  }

  const cursor = new Map<string, number>();
  for (const k of around.keys()) cursor.set(k, 0);

  const home = new Set<number>();
  const starts = [...around.keys()].sort();

  for (const from of starts) {
    /* Hierholzer, run from every vertex in turn so a graph that somehow
       came out in two pieces is still fully oriented. */
    const stack: string[] = [from];
    const trail: { at: string; e: number }[] = [];
    while (stack.length) {
      const at = stack[stack.length - 1];
      let next = -1;
      const list = around.get(at)!;
      let c = cursor.get(at)!;
      while (c < list.length) {
        const e = edges[list[c]];
        if (!e.used) {
          next = list[c];
          break;
        }
        c++;
      }
      cursor.set(at, c);
      if (next < 0) {
        stack.pop();
        continue;
      }
      const e = edges[next];
      e.used = true;
      const other = e.x === at ? e.y : e.x;
      /* Stepped along it from `at`, so `at` is the home side. */
      if (e.x === at) home.add(e.i);
      trail.push({ at, e: next });
      stack.push(other);
    }
  }

  return edges.map((e) => ({
    stage: 'league' as UclStage,
    n: e.day,
    a: home.has(e.i) ? e.x : e.y,
    b: home.has(e.i) ? e.y : e.x,
    home: true,
    neutral: false,
    ga: 0,
    gb: 0,
    pens: null,
    played: false,
  }));
}

/** The whole league phase, one hundred and forty four fixtures. */
export function leagueFixtures(): UclMatch[] {
  if (!fixtureCache) fixtureCache = orient(buildRaw());
  return fixtureCache;
}

/* ---------- one match ---------- */

/**
 * Ninety minutes, and whatever a tie needs on top.
 *
 * The same Dixon-Coles expectation and the same Poisson draw the league
 * uses, so a European night and a Saturday afternoon are the same
 * football. Home advantage applies everywhere except the final, which is
 * played at a ground belonging to neither of them.
 */
export function uclPlay(
  a: string,
  b: string,
  opts: {
    /** whose ground it is. A final belongs to neither of them. */
    home: 'a' | 'b' | 'neutral';
    /** true when the tie has to be settled in this match */
    decider: boolean;
    /** the aggregate carried into it */
    aggA?: number;
    aggB?: number;
  },
  rnd: Rng,
  ra?: number,
  rb?: number,
): {
  ga: number;
  gb: number;
  pens: { a: number; b: number } | null;
  ga90: number;
  gb90: number;
  et: boolean;
} {
  const sa = strFromAvg(typeof ra === 'number' ? ra : (UCL_CLUBS[a]?.tier ?? 74));
  const sb = strFromAvg(typeof rb === 'number' ? rb : (UCL_CLUBS[b]?.tier ?? 74));
  const { lam, mu } = dcExpected(
    sa,
    sb,
    opts.home === 'neutral' ? 'neutral' : opts.home === 'a',
    null,
  );
  let ga = poissonR(lam, rnd);
  let gb = poissonR(mu, rnd);
  const ga90 = ga;
  const gb90 = gb;

  if (!opts.decider) return { ga, gb, pens: null, ga90, gb90, et: false };

  const totalA = (opts.aggA ?? 0) + ga;
  const totalB = (opts.aggB ?? 0) + gb;
  if (totalA !== totalB) return { ga, gb, pens: null, ga90, gb90, et: false };

  /* Extra time. Thirty minutes is a third of a match. */
  ga += poissonR(lam / 3, rnd);
  gb += poissonR(mu / 3, rnd);
  if ((opts.aggA ?? 0) + ga !== (opts.aggB ?? 0) + gb) {
    return { ga, gb, pens: null, ga90, gb90, et: true };
  }

  /* Penalties, tilted a little by who is better, because that is about as
     far as anybody has ever shown it goes. */
  const edge = 0.5 + (sa - sb) * 0.35;
  let pa = 0;
  let pb = 0;
  for (let i = 0; i < 5; i++) {
    if (rnd() < 0.76 + edge * 0.06) pa++;
    if (rnd() < 0.82 - edge * 0.06) pb++;
  }
  let guard = 0;
  while (pa === pb && guard++ < 20) {
    if (rnd() < 0.74 + edge * 0.06) pa++;
    if (rnd() < 0.8 - edge * 0.06) pb++;
  }
  if (pa === pb) pa++;
  return { ga, gb, pens: { a: pa, b: pb }, ga90, gb90, et: true };
}

/* ---------- who scored ---------- */

/** Spread a scoreline across a squad, weighted by position and rating. */
export function shareUclGoals(
  squad: UclPlayer[],
  goals: number,
  rnd: Rng,
): { scorer: string; assist: string | null }[] {
  const out: { scorer: string; assist: string | null }[] = [];
  const weight = (p: UclPlayer) => {
    const pos = p.pos[0] ?? 'MID';
    const base = pos === 'ATT' ? 10 : pos === 'MID' ? 4 : pos === 'DEF' ? 1 : 0;
    return base * Math.pow(Math.max(1, p.rtg - 60) / 20, 2);
  };
  const pool = squad.filter((p) => weight(p) > 0);
  const total = pool.reduce((s, p) => s + weight(p), 0);
  if (!pool.length || total <= 0) return out;

  for (let i = 0; i < goals; i++) {
    let roll = rnd() * total;
    let scorer = pool[pool.length - 1];
    for (const p of pool) {
      roll -= weight(p);
      if (roll <= 0) {
        scorer = p;
        break;
      }
    }
    let assist: string | null = null;
    if (rnd() < 0.66) {
      const others = pool.filter((p) => p.n !== scorer.n);
      if (others.length) assist = others[Math.floor(rnd() * others.length)].n;
    }
    out.push({ scorer: scorer.n, assist });
  }
  return out;
}

/* ---------- the table ---------- */

function emptyRow(club: string): UclRow {
  return { club, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
}

function applyResult(rows: Map<string, UclRow>, a: string, b: string, ga: number, gb: number) {
  const ra = rows.get(a) ?? emptyRow(a);
  const rb = rows.get(b) ?? emptyRow(b);
  ra.p++;
  rb.p++;
  ra.gf += ga;
  ra.ga += gb;
  rb.gf += gb;
  rb.ga += ga;
  if (ga > gb) {
    ra.w++;
    rb.l++;
    ra.pts += 3;
  } else if (gb > ga) {
    rb.w++;
    ra.l++;
    rb.pts += 3;
  } else {
    ra.d++;
    rb.d++;
    ra.pts++;
    rb.pts++;
  }
  rows.set(a, ra);
  rows.set(b, rb);
}

/** Points, then goal difference, then goals scored, then the coefficient. */
export function sortUclRows(rows: UclRow[]): UclRow[] {
  return [...rows].sort(
    (x, y) =>
      y.pts - x.pts ||
      y.gf - y.ga - (x.gf - x.ga) ||
      y.gf - x.gf ||
      (UCL_CLUBS[x.club]?.coeff ?? 99) - (UCL_CLUBS[y.club]?.coeff ?? 99),
  );
}

/* ---------- starting ---------- */

function yourFixtures(you: string): UclMatch[] {
  const out: UclMatch[] = [];
  for (const f of leagueFixtures()) {
    if (f.a !== you && f.b !== you) continue;
    const home = f.a === you;
    out.push({
      ...f,
      a: you,
      b: home ? f.b : f.a,
      home,
    });
  }
  return out.sort((x, y) => x.n - y.n);
}

export function uclStart(
  you: string,
  seed: number,
  custom?: UclCustom | null,
  owner?: { club: string; year: number } | null,
): UclRun {
  return {
    seed: seed >>> 0,
    you,
    custom: custom ?? null,
    stage: 'league',
    played: [],
    ahead: yourFixtures(you),
    table: sortUclRows(Object.keys(UCL_CLUBS).map(emptyRow)),
    order: [],
    rank: {},
    alive: [],
    agg: null,
    squad: {},
    cleanSheets: 0,
    over: false,
    outAt: null,
    won: false,
    world: [],
    owner: owner ?? null,
  };
}

/* ---------- playing ---------- */

function rngFor(run: UclRun, n: number): Rng {
  return mulberry32((run.seed ^ Math.imul(n + 1, 0x9e3779b9)) >>> 0);
}

export type UclPlayed = {
  run: UclRun;
  match: UclMatch;
  scorers: { scorer: string; assist: string | null }[];
};

/** Play exactly one match, and let everything that follows from it follow. */
export function uclPlayNext(run: UclRun): UclPlayed | null {
  if (run.over || !run.ahead.length) return null;

  const fixture = run.ahead[0];
  const rnd = rngFor(run, run.played.length);
  const twoLeg = fixture.stage !== 'league' && fixture.stage !== 'final';
  const decider = fixture.stage === 'final' || (twoLeg && fixture.n === 2);

  const r = uclPlay(
    fixture.a,
    fixture.b,
    {
      home: fixture.neutral ? 'neutral' : fixture.home ? 'a' : 'b',
      decider,
      aggA: run.agg?.a ?? 0,
      aggB: run.agg?.b ?? 0,
    },
    rnd,
    ratingOf(run, fixture.a),
    ratingOf(run, fixture.b),
  );

  const agg =
    fixture.stage === 'league' || fixture.stage === 'final'
      ? null
      : { a: (run.agg?.a ?? 0) + r.ga, b: (run.agg?.b ?? 0) + r.gb };

  const match: UclMatch = {
    ...fixture,
    ga: r.ga,
    gb: r.gb,
    pens: r.pens,
    ga90: r.ga90,
    gb90: r.gb90,
    et: r.et,
    played: true,
    agg: agg ?? undefined,
  };

  const scorers = shareUclGoals(squadOf(run, run.you), r.ga, rnd);
  const squad = { ...run.squad };
  for (const s of scorers) {
    const g = squad[s.scorer] ?? { g: 0, a: 0 };
    squad[s.scorer] = { g: g.g + 1, a: g.a };
    if (s.assist) {
      const x = squad[s.assist] ?? { g: 0, a: 0 };
      squad[s.assist] = { g: x.g, a: x.a + 1 };
    }
  }

  let next: UclRun = {
    ...run,
    played: [...run.played, match],
    ahead: run.ahead.slice(1),
    squad,
    cleanSheets: run.cleanSheets + (r.gb === 0 ? 1 : 0),
    agg,
  };

  next = fixture.stage === 'league' ? afterMatchday(next, match, rnd) : afterLeg(next, match, rnd);

  return { run: next, match, scorers };
}

/** Everything else that happened on the same matchday. */
function afterMatchday(run: UclRun, match: UclMatch, rnd: Rng): UclRun {
  const rows = new Map<string, UclRow>();
  for (const r of run.table) rows.set(r.club, { ...r });
  applyResult(
    rows,
    match.home ? match.a : match.b,
    match.home ? match.b : match.a,
    match.home ? match.ga : match.gb,
    match.home ? match.gb : match.ga,
  );

  for (const f of leagueFixtures()) {
    if (f.n !== match.n) continue;
    if (f.a === run.you || f.b === run.you) continue;
    const r = uclPlay(f.a, f.b, { home: 'a', decider: false }, rnd);
    applyResult(rows, f.a, f.b, r.ga, r.gb);
  }

  const table = sortUclRows([...rows.values()]);
  if (match.n < UCL_MATCHDAYS - 1) return { ...run, table };
  return closeLeague({ ...run, table }, rnd);
}

/* ---------- the end of the league phase ---------- */

/**
 * The cut.
 *
 * Top eight go straight through. Ninth to twenty fourth play off for the
 * other eight places. Twenty fifth and below are finished, with nothing to
 * drop into, which is the part of the new format people forget.
 */
function closeLeague(run: UclRun, rnd: Rng): UclRun {
  const order = run.table.map((r) => r.club);
  const rank: Record<string, number> = {};
  order.forEach((c, i) => (rank[c] = i + 1));

  const withWorld = { ...run, order, rank, world: uclAwards(run.seed, order) };
  const you = rank[run.you] ?? 36;

  if (you > 24) {
    return { ...withWorld, stage: 'done', ahead: [], over: true, outAt: 'league', agg: null };
  }

  if (you <= 8) {
    /* The play-off round happens without you. */
    const winners = playOffWinners(order, null, rnd);
    return openRound({ ...withWorld, alive: bracketOf(order, winners) }, 'r16');
  }

  /* You are in the play-off. Your tie is the mirror of your rank. */
  const other = order[24 - you + 8];
  return openTie({ ...withWorld, stage: 'po' }, run.you, other, 'po');
}

/** Ninth to twenty fourth, paired 9 against 24 and so on down to 16 against 17. */
function poPairs(order: string[]): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < 8; i++) out.push([order[8 + i], order[23 - i]]);
  return out;
}

/** Every play-off tie except one you are in, which is played on the screen. */
function playOffWinners(order: string[], skip: string | null, rnd: Rng): string[] {
  const winners: string[] = [];
  for (const [a, b] of poPairs(order)) {
    if (skip && (a === skip || b === skip)) {
      winners.push(skip);
      continue;
    }
    winners.push(tieWinner(a, b, rnd));
  }
  return winners;
}

/** Two legs, the better ranked club at home in the second. */
function tieWinner(a: string, b: string, rnd: Rng): string {
  const one = uclPlay(b, a, { home: 'a', decider: false }, rnd);
  const two = uclPlay(
    a,
    b,
    { home: 'a', decider: true, aggA: one.gb, aggB: one.ga },
    rnd,
  );
  const aggA = one.gb + two.ga;
  const aggB = one.ga + two.gb;
  if (two.pens) return two.pens.a > two.pens.b ? a : b;
  return aggA >= aggB ? a : b;
}

/**
 * The sixteen, and the order they meet in.
 *
 * Seeds one to eight, then the play-off winners with the best of them at
 * the top, so that pairing the first with the last puts the strongest seed
 * against the weakest survivor. From there the bracket looks after itself:
 * the winners keep their places, and one and two can only meet in the
 * final.
 */
function bracketOf(order: string[], winners: string[]): string[] {
  const seeds = order.slice(0, 8);
  const rest = [...winners].sort((x, y) => order.indexOf(x) - order.indexOf(y));
  return [...seeds, ...rest];
}

/** Open the next round by drawing your tie out of the bracket. */
function openRound(run: UclRun, stage: UclStage): UclRun {
  const at = run.alive.indexOf(run.you);
  if (at < 0) {
    return { ...run, stage: 'done', ahead: [], over: true, outAt: stage, agg: null };
  }
  const opp = run.alive[run.alive.length - 1 - at];
  if (!opp || opp === run.you) {
    return { ...run, stage: 'done', ahead: [], over: true, outAt: stage, agg: null };
  }
  if (stage === 'final') {
    return {
      ...run,
      stage,
      agg: null,
      ahead: [
        {
          stage: 'final',
          n: 1,
          a: run.you,
          b: opp,
          home: false,
          neutral: true,
          ga: 0,
          gb: 0,
          pens: null,
          played: false,
        },
      ],
    };
  }
  return openTie({ ...run, stage }, run.you, opp, stage);
}

/** Two legs, and you are at home in the second if you finished higher. */
function openTie(run: UclRun, you: string, opp: string, stage: UclStage): UclRun {
  const better = (run.rank[you] ?? 99) < (run.rank[opp] ?? 99);
  const legs: UclMatch[] = [1, 2].map((n) => ({
    stage,
    n,
    a: you,
    b: opp,
    home: n === 2 ? better : !better,
    neutral: false,
    ga: 0,
    gb: 0,
    pens: null,
    played: false,
  }));
  return { ...run, stage, ahead: legs, agg: { a: 0, b: 0 } };
}

/* ---------- what a leg did ---------- */

function afterLeg(run: UclRun, match: UclMatch, rnd: Rng): UclRun {
  /* The first leg of a tie settles nothing. */
  if (match.stage !== 'final' && match.n === 1) return run;

  const aggA = match.agg?.a ?? match.ga;
  const aggB = match.agg?.b ?? match.gb;
  const won = match.pens ? match.pens.a > match.pens.b : aggA > aggB;

  if (!won) {
    return { ...run, stage: 'done', ahead: [], over: true, outAt: match.stage, agg: null };
  }

  if (match.stage === 'final') {
    return { ...run, stage: 'done', ahead: [], over: true, outAt: 'final', won: true, agg: null };
  }

  if (match.stage === 'po') {
    const winners = playOffWinners(run.order, run.you, rnd);
    return openRound({ ...run, alive: bracketOf(run.order, winners), agg: null }, 'r16');
  }

  /* Everybody else's tie in this round, so the half that survives is real. */
  const alive = run.alive;
  const next: string[] = [];
  for (let i = 0; i < alive.length / 2; i++) {
    const a = alive[i];
    const b = alive[alive.length - 1 - i];
    if (a === run.you || b === run.you) {
      next.push(run.you);
      continue;
    }
    next.push(tieWinner(a, b, rnd));
  }

  const stage = UCL_ROUNDS[UCL_ROUNDS.indexOf(match.stage) + 1] ?? 'final';
  return openRound({ ...run, alive: next, agg: null }, stage);
}

/* ---------- skipping the league phase ---------- */

/**
 * Play out whatever is left of the league phase in one go.
 *
 * Eight matchdays is a lot to sit through when what you came for is the
 * knockout, so this exists. It is the same eight matches: it plays them
 * through the same function, one at a time, and stops the moment the
 * phase is over.
 */
export function uclSkipLeague(run: UclRun): { run: UclRun; matches: UclMatch[] } {
  let at = run;
  const matches: UclMatch[] = [];
  let guard = 0;
  while (at.stage === 'league' && !at.over && at.ahead.length && guard++ < 20) {
    const step = uclPlayNext(at);
    if (!step) break;
    at = step.run;
    matches.push(step.match);
  }
  return { run: at, matches };
}

/* ---------- the golden boot ---------- */

/**
 * What everybody else's forward did.
 *
 * Worked out once, when the league phase ends, because it only has to be
 * right at the finish and simulating thirty five full campaigns a match
 * would be absurd. How far a club got decides how many matches its best
 * forward had to score in.
 */
function uclAwards(seed: number, order: string[]): UclWorldScorer[] {
  const rnd = mulberry32((seed ^ 0x27d4eb2d) >>> 0);
  const out: UclWorldScorer[] = [];
  for (const club of order) {
    const at = order.indexOf(club);
    const rounds =
      at > 23 ? 8 : at < 2 ? 8 + 8 : at < 4 ? 8 + 6 : at < 8 ? 8 + 4 : 8 + 3;
    const best = uclSquad(club)
      .filter((p) => (p.pos[0] ?? '') === 'ATT')
      .sort((a, b) => b.rtg - a.rtg)[0];
    if (!best) continue;
    const rate = 0.3 + Math.max(0, best.rtg - 78) * 0.026;
    let goals = 0;
    for (let i = 0; i < rounds; i++) if (rnd() < rate) goals += 1 + (rnd() < 0.2 ? 1 : 0);
    out.push({ club, n: best.n, goals });
  }
  return out;
}

/** Who wins it, once your own are counted in. */
export function uclGoldenBoot(run: UclRun): { n: string; club: string; goals: number } {
  const mine = Object.entries(run.squad)
    .map(([n, s]) => ({ n, club: run.you, goals: s.g }))
    .sort((a, b) => b.goals - a.goals)[0];
  const world = [...run.world].sort((a, b) => b.goals - a.goals)[0];
  if (mine && world) return mine.goals >= world.goals ? mine : world;
  if (mine) return mine;
  return world ?? { n: '', club: '', goals: 0 };
}

/* ---------- what it added up to ---------- */

const ORDER: UclStage[] = ['league', 'po', 'r16', 'qf', 'sf', 'final'];

/**
 * How far a club that good ought to get.
 *
 * Measured against what the competition actually does rather than against
 * what a supporter would say. Thresholds recalibrated by playing the whole
 * field through it, so roughly a third come out over, a third level and a
 * third under, which is what makes the badge on the report worth having.
 */
export function uclExpected(tier: number): UclStage {
  if (tier >= 85) return 'sf';
  if (tier >= 82) return 'qf';
  if (tier >= 78) return 'r16';
  if (tier >= 74) return 'po';
  return 'league';
}

export function uclVerdict(run: UclRun): 'over' | 'met' | 'under' {
  const want = ORDER.indexOf(uclExpected(ratingOf(run, run.you)));
  const got = run.won ? ORDER.length : ORDER.indexOf(run.outAt ?? 'league');
  if (got > want) return 'over';
  if (got < want) return 'under';
  return 'met';
}

/** The whole run, as numbers. */
export function uclSummary(run: UclRun) {
  let w = 0;
  let d = 0;
  let l = 0;
  let gf = 0;
  let ga = 0;
  for (const m of run.played) {
    gf += m.ga;
    ga += m.gb;
    if (m.ga > m.gb) w++;
    else if (m.ga < m.gb) l++;
    else d++;
  }
  return { w, d, l, gf, ga, cleanSheets: run.cleanSheets, played: run.played.length };
}

/** Your own scorers, best first. */
export function uclScorers(run: UclRun): { n: string; g: number; a: number }[] {
  return Object.entries(run.squad)
    .map(([n, s]) => ({ n, g: s.g, a: s.a }))
    .sort((x, y) => y.g - x.g || y.a - x.a || x.n.localeCompare(y.n));
}

/* ---------- handing a campaign back to a career ---------- */

const ROUND_NAME: Record<string, string> = {
  po: 'Playoff',
  r16: 'Last 16',
  qf: 'Quarter-Final',
  sf: 'Semi-Final',
  final: 'Final',
};

/**
 * A finished campaign, in the shape a Dynasty season wants.
 *
 * A career that plays its European nights for real must not also have
 * them simulated, so the season is handed this instead and builds its
 * European run out of it. Everything a Dynasty cares about is in here:
 * where the league phase left you, every tie in order, and whether you
 * lifted it.
 */
export function uclAsPlayed(run: UclRun): PlayedEuro {
  const league = run.played.filter((m) => m.stage === 'league');
  let w = 0;
  let d = 0;
  let l = 0;
  let gf = 0;
  let ga = 0;
  for (const m of league) {
    gf += m.ga;
    ga += m.gb;
    if (m.ga > m.gb) w++;
    else if (m.ga < m.gb) l++;
    else d++;
  }

  /* Every knockout tie, rebuilt from its legs. A two legged tie is two
     matches with an aggregate on the second; a final is one match. */
  const ties: PlayedEuro['ties'] = [];
  const knockouts = run.played.filter((m) => m.stage !== 'league');
  for (let i = 0; i < knockouts.length; i++) {
    const m = knockouts[i];
    if (m.stage === 'final') {
      ties.push({
        round: 'Final',
        opp: m.b,
        oppRating: Math.round(ratingOf(run, m.b)),
        gf: m.ga,
        ga: m.gb,
        won: m.pens ? m.pens.a > m.pens.b : m.ga > m.gb,
        legs: null,
        pens: m.pens
          ? m.pens.a > m.pens.b
            ? 'won on penalties'
            : 'lost on penalties'
          : null,
      });
      continue;
    }
    /* The first leg is only half a tie, so it is read from the second. */
    if (m.n !== 2) continue;
    const first = knockouts[i - 1];
    const legs: CupLeg[] = [
      { gf: first?.ga ?? 0, ga: first?.gb ?? 0, home: Boolean(first?.home) },
      { gf: m.ga, ga: m.gb, home: m.home },
    ];
    const aggA = m.agg?.a ?? legs[0].gf + legs[1].gf;
    const aggB = m.agg?.b ?? legs[0].ga + legs[1].ga;
    ties.push({
      round: ROUND_NAME[m.stage] ?? 'Last 16',
      opp: m.b,
      oppRating: Math.round(ratingOf(run, m.b)),
      gf: aggA,
      ga: aggB,
      won: m.pens ? m.pens.a > m.pens.b : aggA > aggB,
      legs,
      pens: m.pens
        ? m.pens.a > m.pens.b
          ? 'won on penalties'
          : 'lost on penalties'
        : null,
    });
  }

  return {
    place: run.rank[run.you] ?? uclPosition(run),
    w,
    d,
    l,
    gf,
    ga,
    ties,
    won: run.won,
  };
}

/** Where you sit in the table right now. */
export function uclPosition(run: UclRun): number {
  const at = run.table.findIndex((r) => r.club === run.you);
  return at < 0 ? 36 : at + 1;
}
