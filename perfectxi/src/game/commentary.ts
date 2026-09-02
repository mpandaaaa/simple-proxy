import { lastName, mulberry32, type MatchResult, type Rng } from '../engine';

/**
 * A match, minute by minute.
 *
 * The season is already decided the moment the XI is complete: the engine
 * plays all thirty eight and the result is fixed. This turns one of those
 * results back into the ninety minutes it came from, so a 3-1 is watched
 * rather than read.
 *
 * Nothing here can change a score. Goals come from the engine, with the
 * scorers and the minutes it drew. Everything else is dressing hung on the
 * shape of the match, drawn from a generator seeded by the run and the
 * matchday, so watching a game back gives you the same ninety minutes you
 * watched the first time.
 */

export type EventKind =
  | 'ko'
  | 'goal'
  | 'ht'
  | 'ft'
  | 'chance'
  | 'save'
  | 'corner'
  | 'foul'
  | 'offside'
  | 'woodwork'
  | 'yellow'
  | 'run';

export type MatchEvent = {
  id: string;
  min: number;
  kind: EventKind;
  /** who it happened to, or null for the whistle */
  side: 'me' | 'opp' | null;
  text: string;
  scorer: string | null;
  /** the score as it stood once this had happened */
  me: number;
  opp: number;
};

export type MatchStats = {
  /** your share of the ball, as a percentage */
  possession: number;
  shots: [number, number];
  onTarget: [number, number];
  corners: [number, number];
  fouls: [number, number];
  xg: [number, number];
};

export type LiveMatch = {
  events: MatchEvent[];
  stats: MatchStats;
  /** where the pressure sat, one value a minute, -1 to 1 */
  momentum: number[];
};

function pick<T>(list: readonly T[], rnd: Rng): T {
  return list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];
}

const GOAL_ME = [
  'GOAL! {p} finds the net.',
  'What a strike from {p}.',
  '{p} buries it and the place erupts.',
  'Clinical from {p}. No hesitation.',
  '{p} makes no mistake from close range.',
  'Sweetly struck by {p}. The keeper never moved.',
];

const GOAL_ME_ANON = [
  'GOAL! Bundled in at the far post.',
  'GOAL! It squirms over the line.',
  'GOAL! A deflection takes it past the keeper.',
];

const GOAL_OPP = [
  '{o} hit back, against the run of play.',
  'Goal for {o}. A moment of quality.',
  '{o} find a way through.',
  'Setback. {o} score.',
  '{o} punish a rare lapse.',
];

const FLAVOUR = {
  save: [
    'Enormous save to deny {s}.',
    'The keeper stands tall against {s}.',
    'Superb stop, and {s} cannot believe it.',
  ],
  chance: [
    '{s} carve out a huge opening and waste it.',
    'So close for {s}. Inches wide.',
    'A glorious chance goes begging for {s}.',
  ],
  corner: [
    'Corner swung in by {s} and headed clear.',
    'Set-piece pressure from {s}.',
    '{s} win another corner. The siege is on.',
  ],
  foul: [
    'Cynical foul halts {s} in their tracks.',
    'Free kick to {s} in a dangerous area.',
    'The referee has seen enough. Free kick to {s}.',
  ],
  offside: ['{s} celebrate, but the flag is up.', 'Tight offside call against {s}.'],
  woodwork: [
    'Off the woodwork. {s} are inches away.',
    'It rattles the post and {s} cannot believe it.',
  ],
  yellow: ['{s} go into the book.', 'Booking for {s}. A necessary foul.'],
  run: [
    '{s} string a lovely move together.',
    'Patient build-up from {s}.',
    'The tempo is lifting for {s}.',
  ],
} as const;

const FLAVOUR_KEYS = [
  'save',
  'chance',
  'corner',
  'foul',
  'offside',
  'woodwork',
  'yellow',
  'run',
] as const;

function fill(
  t: string,
  me: string,
  opp: string,
  side: 'me' | 'opp',
  player?: string | null,
): string {
  return t
    .replace('{p}', player ? lastName(player) : '')
    .replace('{o}', opp)
    .replace('{s}', side === 'me' ? me : opp);
}

/**
 * A seed of this match's own, mixed from the run's seed and the matchday.
 *
 * Deliberately not the run's own generator. Drawing from that here would
 * change every number the season draws afterwards, and the season has to
 * follow from its seed alone or a result cannot be replayed.
 */
function matchSeed(runSeed: number, n: number): number {
  let h = (runSeed ^ Math.imul(n, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function buildMatch(
  m: MatchResult,
  runSeed: number,
  myName = 'Your XI',
): LiveMatch {
  const rnd = mulberry32(matchSeed(runSeed, m.n));
  const opp = m.opp;

  type Raw = {
    min: number;
    kind: EventKind;
    side: 'me' | 'opp' | null;
    scorer: string | null;
  };
  const raw: Raw[] = [];

  for (const g of m.scorers) {
    raw.push({ min: g.min, kind: 'goal', side: 'me', scorer: g.name });
  }
  // Any goal the engine did not name a scorer for still happened.
  for (let i = m.scorers.length; i < m.gf; i++) {
    raw.push({ min: 3 + Math.floor(rnd() * 86), kind: 'goal', side: 'me', scorer: null });
  }
  for (let i = 0; i < m.ga; i++) {
    raw.push({ min: 3 + Math.floor(rnd() * 86), kind: 'goal', side: 'opp', scorer: null });
  }

  // Enough incident that a goalless half still has something in it,
  // weighted towards whoever was the better side on the day.
  const share = m.xgF + m.xgA > 0 ? m.xgF / (m.xgF + m.xgA) : 0.5;
  const flavourCount = 6 + Math.floor(rnd() * 4);
  for (let i = 0; i < flavourCount; i++) {
    raw.push({
      min: 2 + Math.floor(rnd() * 87),
      kind: pick(FLAVOUR_KEYS, rnd),
      side: rnd() < share ? 'me' : 'opp',
      scorer: null,
    });
  }

  raw.sort((a, b) => a.min - b.min);

  const events: MatchEvent[] = [
    {
      id: 'ko',
      min: 0,
      kind: 'ko',
      side: null,
      text: `Kick off. ${myName} against ${opp}.`,
      scorer: null,
      me: 0,
      opp: 0,
    },
  ];

  let me = 0;
  let them = 0;
  let half = false;

  for (let i = 0; i < raw.length; i++) {
    const e = raw[i];

    if (!half && e.min > 45) {
      half = true;
      events.push({
        id: 'ht',
        min: 45,
        kind: 'ht',
        side: null,
        text: `Half time. ${me}–${them}`,
        scorer: null,
        me,
        opp: them,
      });
    }

    if (e.kind === 'goal') {
      if (e.side === 'me') me++;
      else them++;
      events.push({
        id: `e${i}`,
        min: e.min,
        kind: 'goal',
        side: e.side,
        text:
          e.side === 'me'
            ? e.scorer
              ? fill(pick(GOAL_ME, rnd), myName, opp, 'me', e.scorer)
              : pick(GOAL_ME_ANON, rnd)
            : fill(pick(GOAL_OPP, rnd), myName, opp, 'opp'),
        scorer: e.scorer,
        me,
        opp: them,
      });
      continue;
    }

    const bank = FLAVOUR[e.kind as keyof typeof FLAVOUR];
    events.push({
      id: `e${i}`,
      min: e.min,
      kind: e.kind,
      side: e.side,
      text: fill(pick(bank, rnd), myName, opp, e.side ?? 'me'),
      scorer: null,
      me,
      opp: them,
    });
  }

  if (!half) {
    events.push({
      id: 'ht',
      min: 45,
      kind: 'ht',
      side: null,
      text: `Half time. ${me}–${them}`,
      scorer: null,
      me,
      opp: them,
    });
  }

  events.push({
    id: 'ft',
    min: 90,
    kind: 'ft',
    side: null,
    text:
      m.oc === 'win'
        ? `Full time. ${myName} win it.`
        : m.oc === 'loss'
          ? 'Full time. Nothing to take from this one.'
          : 'Full time. Honours even.',
    scorer: null,
    me,
    opp: them,
  });

  events.sort((a, b) => a.min - b.min || (a.kind === 'ko' ? -1 : 0));

  return {
    events,
    stats: buildStats(m, rnd),
    momentum: buildMomentum(events, share),
  };
}

/**
 * The panel that comes up at full time.
 *
 * Every figure here is derived from the expected goals the engine already
 * drew for this fixture, so a game you dominated reads as a game you
 * dominated. Nothing is invented independently of the result.
 */
function buildStats(m: MatchResult, rnd: Rng): MatchStats {
  const jitter = () => (rnd() - 0.5) * 2;

  const possession = Math.round(
    Math.max(29, Math.min(73, 50 + (m.xgF - m.xgA) * 6.5 + (rnd() - 0.5) * 6)),
  );

  const shotsMe = Math.max(m.gf, Math.round(m.xgF * 3.4 + 3 + jitter()));
  const shotsOpp = Math.max(m.ga, Math.round(m.xgA * 3.4 + 3 + jitter()));
  const onMe = Math.max(m.gf, Math.min(shotsMe, Math.round(m.xgF * 1.7 + 1 + rnd())));
  const onOpp = Math.max(m.ga, Math.min(shotsOpp, Math.round(m.xgA * 1.7 + 1 + rnd())));

  return {
    possession,
    shots: [shotsMe, shotsOpp],
    onTarget: [onMe, onOpp],
    corners: [
      Math.max(0, Math.round(m.xgF * 1.9 + 1 + jitter())),
      Math.max(0, Math.round(m.xgA * 1.9 + 1 + jitter())),
    ],
    fouls: [7 + Math.floor(rnd() * 8), 7 + Math.floor(rnd() * 8)],
    xg: [m.xgF, m.xgA],
  };
}

/**
 * Where the pressure was, minute by minute.
 *
 * Football is not evenly distributed and a flat bar says the opposite.
 * Each event pushes the needle towards whoever it happened to, and it
 * decays back towards the balance of the tie, so a spell of pressure looks
 * like a spell rather than a spike.
 */
function buildMomentum(events: MatchEvent[], share: number): number[] {
  const base = (share - 0.5) * 1.2;
  const out: number[] = [];
  let v = base;
  let ei = 0;

  for (let min = 0; min <= 90; min++) {
    while (ei < events.length && events[ei].min <= min) {
      const e = events[ei++];
      if (!e.side) continue;
      const push =
        e.kind === 'goal' ? 0.85 : e.kind === 'run' || e.kind === 'foul' ? 0.16 : 0.34;
      v += e.side === 'me' ? push : -push;
    }
    v = base + (v - base) * 0.86;
    out.push(Math.max(-1, Math.min(1, v)));
  }
  return out;
}
