import { dcExpected, lastName, mulberry32, strFromAvg, type Rng } from '../engine';
import type { LiveMatch, MatchEvent } from './commentary';

/**
 * A knockout match, minute by minute.
 *
 * The league already had this: a result the engine banked, turned back
 * into the ninety minutes it came from. A tournament needs three things a
 * league never does. It can go to extra time, it can go to penalties, and
 * the other side has real players with real names, so a goal against you
 * is somebody scoring it rather than a nation scoring it.
 *
 * So this builds the same `LiveMatch` the league screen already knows how
 * to play, and the World Cup and the Champions League watch their matches
 * through exactly the same broadcast. Nothing here decides anything: the
 * score, the extra time and the shootout tally all arrive already banked,
 * and every sequence this writes adds up to them.
 */

export type TourneyPlayer = { n: string; pos: string[]; rtg: number };

export type TourneyInput = {
  /** the run's seed, mixed with the match number inside */
  seed: number;
  /** which match of the run it is, so two matches never tell the same story */
  n: number;
  /** the round, in words, for the opening line */
  comp: string;
  me: { name: string; rating: number; squad: TourneyPlayer[] };
  opp: { name: string; rating: number; squad: TourneyPlayer[] };
  /** the final score, extra time included */
  gf: number;
  ga: number;
  /** the score at ninety minutes */
  gf90: number;
  ga90: number;
  et: boolean;
  pens: { a: number; b: number } | null;
  /** your scorers, in the order the engine drew them */
  scorers: { scorer: string; assist: string | null }[];
};

/* ---------- the words ---------- */

const GOAL_ME = [
  'GOAL! {p} finds the net.',
  'GOAL! {p} takes a touch and rolls it in.',
  'GOAL! A yard of space was all {p} needed.',
  'GOAL! {p} meets it first time and it flies in.',
  'GOAL! {p} lets fly and it is in the top corner.',
];

const GOAL_ME_MADE = [
  'GOAL! {a} picks him out and {p} does the rest.',
  'GOAL! {a} slides it through and {p} finishes low.',
  'GOAL! {a} hangs it up and {p} climbs above everyone.',
  'GOAL! Lovely ball from {a}. {p} could not miss.',
];

const GOAL_OPP = [
  'GOAL. {p} pulls one back for {s}.',
  'GOAL. {p} finds a way through.',
  'GOAL. {p} punishes a rare lapse.',
  'GOAL. {s} are level through {p}.',
  'GOAL. {p} strikes, and {s} have their moment.',
];

const FLAVOUR = {
  save: [
    'Enormous save to deny {p}.',
    'The keeper stands tall against {p}.',
    'Superb stop, and {p} cannot believe it.',
  ],
  chance: [
    '{p} drags it wide from the edge of the box.',
    'So close for {s}. {p} puts it inches wide.',
    '{p} skies it. He will not want to see that again.',
  ],
  corner: ['Set-piece pressure from {s}.', '{s} win another corner. The siege is on.'],
  foul: ['Cynical foul halts {s} in their tracks.', 'Free kick to {s} in a dangerous area.'],
  offside: ['{s} celebrate, but the flag is up.', 'Tight offside call against {s}.'],
  woodwork: ['Off the post. {p} holds his head.', 'It rattles the bar and {s} are inches away.'],
  yellow: ['Yellow card for {p}.', 'Booking for {p}. A necessary foul.'],
  run: ['{s} string a lovely move together.', 'Patient build-up from {s}.', 'The tempo is lifting for {s}.'],
} as const;

const FLAVOUR_KEYS = ['save', 'chance', 'corner', 'foul', 'offside', 'woodwork', 'yellow', 'run'] as const;

/* ---------- helpers ---------- */

function pick<T>(list: readonly T[], rnd: Rng): T {
  return list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];
}

function keeperOf(squad: TourneyPlayer[]): string {
  const gk = squad.filter((p) => (p.pos[0] ?? '') === 'GK').sort((a, b) => b.rtg - a.rtg)[0];
  return gk ? gk.n : (squad[0]?.n ?? 'the keeper');
}

/** Somebody who might plausibly have done it, weighted to the better ones. */
function someone(rnd: Rng, squad: TourneyPlayer[], want: string[]): string {
  const pool = squad.filter((p) => want.indexOf(p.pos[0] ?? '') > -1);
  const from = pool.length ? pool : squad;
  if (!from.length) return 'the substitute';
  const total = from.reduce((s, p) => s + Math.max(1, p.rtg - 60), 0);
  let roll = rnd() * total;
  for (const p of from) {
    roll -= Math.max(1, p.rtg - 60);
    if (roll <= 0) return p.n;
  }
  return from[from.length - 1].n;
}

/**
 * Who scored for the side whose scorers were never banked.
 *
 * The same weighting the tournament itself uses, so an opponent's goals
 * land on the players an opponent's goals would land on.
 */
function shareTo(squad: TourneyPlayer[], goals: number, rnd: Rng): string[] {
  const weight = (p: TourneyPlayer) => {
    const pos = p.pos[0] ?? 'MID';
    const base = pos === 'ATT' ? 10 : pos === 'MID' ? 4 : pos === 'DEF' ? 1 : 0;
    return base * Math.pow(Math.max(1, p.rtg - 60) / 20, 2);
  };
  const pool = squad.filter((p) => weight(p) > 0);
  const total = pool.reduce((s, p) => s + weight(p), 0);
  const out: string[] = [];
  for (let i = 0; i < goals; i++) {
    if (!pool.length || total <= 0) {
      out.push('An own goal');
      continue;
    }
    let roll = rnd() * total;
    let who = pool[pool.length - 1];
    for (const p of pool) {
      roll -= weight(p);
      if (roll <= 0) {
        who = p;
        break;
      }
    }
    out.push(who.n);
  }
  return out;
}

/**
 * Goals are not spread evenly across a match.
 *
 * There are more of them late than early, in every competition anybody has
 * ever counted, so the draw is bent that way rather than being flat.
 */
function goalMinute(rnd: Rng, from: number, to: number): number {
  const u = Math.pow(rnd(), 0.82);
  return from + Math.floor(u * (to - from + 1));
}

function seedOf(runSeed: number, n: number): number {
  let h = (runSeed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Which of n kicks went in, given that exactly `made` of them did. */
function spread(made: number, n: number, rnd: Rng): boolean[] {
  const out: boolean[] = new Array(n).fill(false);
  const idx = [...Array(n).keys()];
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = idx[i];
    idx[i] = idx[j];
    idx[j] = t;
  }
  for (let i = 0; i < Math.min(made, n); i++) out[idx[i]] = true;
  return out;
}

/* ---------- the build ---------- */

export function buildTournament(input: TourneyInput): LiveMatch {
  const rnd = mulberry32(seedOf(input.seed, input.n));
  const full = input.et ? 120 : 90;
  const myKeeper = keeperOf(input.me.squad);
  const oppKeeper = keeperOf(input.opp.squad);

  /* Expected goals, off the same curve the result itself came from, so the
     full time panel agrees with the football that produced it. */
  const sa = strFromAvg(input.me.rating);
  const sb = strFromAvg(input.opp.rating);
  const { lam, mu } = dcExpected(sa, sb, 'neutral', null);
  const share = lam + mu > 0 ? lam / (lam + mu) : 0.5;

  /* ----- who scored, and when ----- */

  type Raw = {
    min: number;
    kind: MatchEvent['kind'];
    side: 'me' | 'opp' | null;
    scorer: string | null;
    assist: string | null;
  };
  const raw: Raw[] = [];
  const used = new Set<number>();
  const minuteIn = (from: number, to: number) => {
    let m = goalMinute(rnd, from, to);
    let guard = 0;
    while (used.has(m) && guard++ < 40) m = goalMinute(rnd, from, to);
    used.add(m);
    return m;
  };

  const mine = input.scorers.slice(0, input.gf);
  while (mine.length < input.gf) {
    mine.push({ scorer: someone(rnd, input.me.squad, ['ATT', 'MID']), assist: null });
  }
  const theirs = shareTo(input.opp.squad, input.ga, rnd);

  const put = (side: 'me' | 'opp', i: number, from: number, to: number) => {
    const scorer = side === 'me' ? (mine[i]?.scorer ?? null) : (theirs[i] ?? null);
    const assist = side === 'me' ? (mine[i]?.assist ?? null) : null;
    raw.push({ min: minuteIn(from, to), kind: 'goal', side, scorer, assist });
  };

  for (let i = 0; i < input.gf90; i++) put('me', i, 1, 90);
  for (let i = 0; i < input.ga90; i++) put('opp', i, 1, 90);
  for (let i = input.gf90; i < input.gf; i++) put('me', i, 91, 120);
  for (let i = input.ga90; i < input.ga; i++) put('opp', i, 91, 120);

  /* ----- everything that did not end up in the net ----- */

  const howMany = 7 + Math.floor(rnd() * 4) + (input.et ? 3 : 0);
  for (let i = 0; i < howMany; i++) {
    const side: 'me' | 'opp' = rnd() < share ? 'me' : 'opp';
    const kind = pick(FLAVOUR_KEYS, rnd);
    let m = 2 + Math.floor(rnd() * (full - 3));
    let guard = 0;
    while (used.has(m) && guard++ < 30) m = 2 + Math.floor(rnd() * (full - 3));
    used.add(m);
    /* A save is the other keeper's, a booking is a defender's, a chance is
       whoever was going to take it. */
    const from = side === 'me' ? input.me.squad : input.opp.squad;
    const who =
      kind === 'yellow' || kind === 'foul'
        ? someone(rnd, from, ['DEF', 'MID'])
        : someone(rnd, from, ['ATT', 'MID']);
    raw.push({ min: m, kind, side, scorer: who, assist: null });
  }

  raw.sort((a, b) => a.min - b.min);

  /* ----- the walk ----- */

  const events: MatchEvent[] = [
    {
      id: 'ko',
      min: 0,
      kind: 'ko',
      side: null,
      text: `${input.comp}. ${input.me.name} against ${input.opp.name}.`,
      scorer: null,
      me: 0,
      opp: 0,
    },
  ];

  let me = 0;
  let them = 0;
  let half = false;
  let extra = false;

  const say = (
    id: string,
    min: number,
    kind: MatchEvent['kind'],
    side: 'me' | 'opp' | null,
    text: string,
    scorer: string | null = null,
    good?: boolean,
  ) => {
    events.push({ id, min, kind, side, text, scorer, me, opp: them, good });
  };

  for (let i = 0; i < raw.length; i++) {
    const e = raw[i];

    if (!half && e.min > 45) {
      half = true;
      say('ht', 45, 'ht', null, `Half time. ${me}–${them}`);
    }
    if (!extra && e.min > 90) {
      extra = true;
      say('et', 90, 'et', null, `Ninety minutes, ${me}–${them}. We go to extra time.`);
    }

    const label = e.side === 'me' ? input.me.name : input.opp.name;
    const player = e.scorer ? lastName(e.scorer) : '';

    if (e.kind === 'goal') {
      if (e.side === 'me') me++;
      else them++;
      const bank =
        e.side === 'me' ? (e.assist ? GOAL_ME_MADE : GOAL_ME) : GOAL_OPP;
      const text = pick(bank, rnd)
        .replace('{p}', player || 'a scrambled finish')
        .replace('{a}', e.assist ? lastName(e.assist) : 'the winger')
        .replace('{s}', label);
      say(`e${i}`, e.min, 'goal', e.side, text, e.scorer);
      continue;
    }

    const bank = FLAVOUR[e.kind as keyof typeof FLAVOUR];
    if (!bank) continue;
    const keeper = e.side === 'me' ? oppKeeper : myKeeper;
    const text = pick(bank, rnd)
      .replace('{p}', e.kind === 'save' ? player || lastName(keeper) : player || label)
      .replace('{s}', label);
    say(`e${i}`, e.min, e.kind, e.side, text);
  }

  if (!half) say('ht', 45, 'ht', null, `Half time. ${me}–${them}`);
  if (input.et && !extra) {
    say('et', 90, 'et', null, `Ninety minutes, ${me}–${them}. We go to extra time.`);
  }

  const won = input.pens
    ? input.pens.a > input.pens.b
    : input.gf > input.ga;
  const level = !input.pens && input.gf === input.ga;

  say(
    'ft',
    full,
    'ft',
    null,
    input.pens
      ? `${me}–${them} after a hundred and twenty minutes. Penalties.`
      : input.et
        ? won
          ? `It is over in extra time. ${input.me.name} go through.`
          : `It is over in extra time. ${input.opp.name} go through.`
        : won
          ? `Full time. ${input.me.name} win it.`
          : level
            ? 'Full time. Honours even.'
            : 'Full time. Nothing to take from this one.',
  );

  /* ----- the shootout ----- */

  if (input.pens) {
    const pens = input.pens;
    const rounds = Math.max(5, pens.a, pens.b);
    const takers = (squad: TourneyPlayer[]) =>
      squad
        .filter((p) => (p.pos[0] ?? '') !== 'GK')
        .sort((a, b) => b.rtg - a.rtg)
        .slice(0, Math.max(5, rounds))
        .map((p) => p.n);
    const list = { me: takers(input.me.squad), opp: takers(input.opp.squad) };
    const hits = { me: spread(pens.a, rounds, rnd), opp: spread(pens.b, rounds, rnd) };
    let scoredMe = 0;
    let scoredOpp = 0;

    say('pens', full, 'shootout', null, 'It comes down to penalties.');

    for (let i = 0; i < rounds; i++) {
      for (const side of ['me', 'opp'] as const) {
        const ok = hits[side][i];
        const who = list[side][i % Math.max(1, list[side].length)] ?? 'The next man';
        const keeper = side === 'me' ? oppKeeper : myKeeper;
        if (ok) {
          if (side === 'me') scoredMe++;
          else scoredOpp++;
        }
        const tally = `${scoredMe}–${scoredOpp}`;
        say(
          `p${i}${side}`,
          full,
          'pen',
          side,
          ok
            ? `${lastName(who)} scores. ${tally}.`
            : `${lastName(who)} misses. ${lastName(keeper)} guessed right. ${tally}.`,
          who,
          ok,
        );
      }
    }
  }

  return {
    events,
    stats: buildStats(input, share, rnd),
    momentum: buildMomentum(events, share, full),
    full,
    pens: input.pens,
  };
}

/**
 * The panel that comes up at the end.
 *
 * Off the same expected goals the result came from, so a tie you dominated
 * reads as a tie you dominated. Nothing is invented next to the score.
 */
function buildStats(input: TourneyInput, share: number, rnd: Rng): LiveMatch['stats'] {
  const sa = strFromAvg(input.me.rating);
  const sb = strFromAvg(input.opp.rating);
  const { lam, mu } = dcExpected(sa, sb, 'neutral', null);
  const stretch = input.et ? 1.33 : 1;
  const xgF = lam * stretch;
  const xgA = mu * stretch;
  const jitter = () => (rnd() - 0.5) * 2;

  const shotsMe = Math.max(input.gf, Math.round(xgF * 3.4 + 3 + jitter()));
  const shotsOpp = Math.max(input.ga, Math.round(xgA * 3.4 + 3 + jitter()));

  return {
    possession: Math.round(Math.max(29, Math.min(73, 50 + (share - 0.5) * 46 + (rnd() - 0.5) * 6))),
    shots: [shotsMe, shotsOpp],
    onTarget: [
      Math.max(input.gf, Math.min(shotsMe, Math.round(xgF * 1.7 + 1 + rnd()))),
      Math.max(input.ga, Math.min(shotsOpp, Math.round(xgA * 1.7 + 1 + rnd()))),
    ],
    corners: [
      Math.max(0, Math.round(xgF * 1.9 + 1 + jitter())),
      Math.max(0, Math.round(xgA * 1.9 + 1 + jitter())),
    ],
    fouls: [7 + Math.floor(rnd() * 8), 7 + Math.floor(rnd() * 8)],
    xg: [Number(xgF.toFixed(2)), Number(xgA.toFixed(2))],
  };
}

/**
 * Where the pressure was, minute by minute.
 *
 * The league's own version, taught to run past ninety, because a match
 * that goes to extra time has thirty more minutes of pressure to draw.
 */
function buildMomentum(events: MatchEvent[], share: number, full: number): number[] {
  const base = (share - 0.5) * 1.2;
  const out: number[] = [];
  let v = base;
  let ei = 0;

  for (let min = 0; min <= full; min++) {
    while (ei < events.length && events[ei].min <= min) {
      const e = events[ei++];
      if (!e.side) continue;
      const push = e.kind === 'goal' ? 0.85 : e.kind === 'run' || e.kind === 'foul' ? 0.16 : 0.34;
      v += e.side === 'me' ? push : -push;
    }
    v = base + (v - base) * 0.86;
    out.push(Math.max(-1, Math.min(1, v)));
  }
  return out;
}
