import { mulberry32, type Rng } from './rng';

/**
 * The two cups.
 *
 * Carried over from the web build's `simulateCups` without changing a
 * number: the same club pools, the same rating bands per round, the same
 * logistic win probability with the National Cup's flattening applied, and
 * the same league phase rules for the Continental Cup.
 *
 * Everything is drawn from a generator seeded off the run, rather than from
 * the run's own stream, so adding cups cannot move a single league result
 * and a season still replays from its seed alone.
 */

export type CupClub = { n: string; r: number };

export const CONTINENTAL_CLUBS: readonly CupClub[] = [
  { n: 'Real Madrid', r: 95 }, { n: 'Man City', r: 93 }, { n: 'Bayern Munich', r: 92 },
  { n: 'Liverpool', r: 91 }, { n: 'Barcelona', r: 90 }, { n: 'Inter Milan', r: 88 },
  { n: 'PSG', r: 88 }, { n: 'Arsenal', r: 89 }, { n: 'Chelsea', r: 87 },
  { n: 'Atletico Madrid', r: 86 }, { n: 'Leverkusen', r: 85 }, { n: 'Dortmund', r: 85 },
  { n: 'AC Milan', r: 85 }, { n: 'Tottenham', r: 84 }, { n: 'Juventus', r: 84 },
  { n: 'Man United', r: 83 }, { n: 'Napoli', r: 83 }, { n: 'RB Leipzig', r: 82 },
  { n: 'Newcastle', r: 82 }, { n: 'Atalanta', r: 82 }, { n: 'Aston Villa', r: 81 },
  { n: 'Benfica', r: 81 }, { n: 'Ajax', r: 81 }, { n: 'Porto', r: 81 },
  { n: 'PSV', r: 80 }, { n: 'Feyenoord', r: 80 }, { n: 'Sporting CP', r: 79 },
  { n: 'Galatasaray', r: 79 }, { n: 'Club Brugge', r: 78 }, { n: 'Celtic', r: 78 },
  { n: 'Salzburg', r: 77 }, { n: 'Rangers', r: 77 }, { n: 'Shakhtar', r: 77 },
  { n: 'Young Boys', r: 75 }, { n: 'Slovan Bratislava', r: 71 }, { n: 'Bologna', r: 79 },
];

export const NATIONAL_CLUBS: readonly CupClub[] = [
  { n: 'Man City', r: 93 }, { n: 'Liverpool', r: 91 }, { n: 'Arsenal', r: 89 },
  { n: 'Chelsea', r: 87 }, { n: 'Tottenham', r: 84 }, { n: 'Man United', r: 83 },
  { n: 'Newcastle', r: 82 }, { n: 'Aston Villa', r: 81 }, { n: 'West Ham', r: 79 },
  { n: 'Brighton', r: 78 }, { n: 'Wolves', r: 77 }, { n: 'Everton', r: 76 },
  { n: 'Crystal Palace', r: 75 }, { n: 'Brentford', r: 75 }, { n: 'Fulham', r: 75 },
  { n: 'Nottm Forest', r: 74 }, { n: 'Bournemouth', r: 74 }, { n: 'Leicester', r: 73 },
  { n: 'Southampton', r: 72 }, { n: 'Burnley', r: 71 }, { n: 'Leeds', r: 72 },
  { n: 'Sunderland', r: 70 }, { n: 'Sheff Wed', r: 69 }, { n: 'Middlesbrough', r: 69 },
  { n: 'Coventry', r: 68 }, { n: 'Norwich', r: 70 }, { n: 'Millwall', r: 67 },
  { n: 'QPR', r: 67 }, { n: 'Cardiff', r: 67 }, { n: 'Preston', r: 66 },
  { n: 'Stoke', r: 67 }, { n: 'Blackburn', r: 68 }, { n: 'Ipswich', r: 70 },
  { n: 'Bristol City', r: 66 }, { n: 'Plymouth', r: 65 }, { n: 'Swansea', r: 66 },
  { n: 'Hull', r: 65 }, { n: 'Watford', r: 68 }, { n: 'West Brom', r: 69 },
  { n: 'Birmingham', r: 65 },
];

export type CupTie = {
  round: string;
  opp: string | null;
  /** the opponent's rating, for the club badge and the difficulty read */
  oppRating: number;
  gf: number;
  ga: number;
  won: boolean;
  /** the league phase carries a record rather than a score */
  detail: string | null;
};

export type CupRun = {
  name: string;
  ties: CupTie[];
  won: boolean;
  /** the round it ended in, or null if it was won */
  elim: string | null;
  qualified: boolean;
  /** how far through the stage path the run got, for the progress line */
  stages: string[];
  reached: number;
};

export type Cups = {
  national: CupRun;
  continental: CupRun;
  /** league and National Cup */
  double: boolean;
  /** league, National Cup and Continental Cup */
  treble: boolean;
};

const NAT_ROUNDS = [
  'Round 3',
  'Round 4',
  'Round 5',
  'Quarter-Final',
  'Semi-Final',
  'Final',
] as const;

const NAT_BANDS: readonly [number, number][] = [
  [55, 72], [60, 76], [65, 82], [70, 87], [75, 91], [80, 95],
];

const KO_ROUNDS = ['Last 16', 'Quarter-Final', 'Semi-Final', 'Final'] as const;
const KO_BANDS: readonly [number, number][] = [
  [82, 90], [85, 93], [87, 95], [89, 95],
];

const CONT_STAGES = [
  'League Phase',
  'Playoff',
  'Last 16',
  'Quarter-Final',
  'Semi-Final',
  'Final',
];

/** The web build's logistic, with the National Cup's levelling kept. */
function winChance(myAvg: number, oppRating: number, national: boolean): number {
  const p = 1 / (1 + Math.exp(-(myAvg - oppRating) / 8));
  return national ? p * 0.7 + 0.15 : p;
}

function pickOpp(pool: readonly CupClub[], used: Set<string>, rnd: Rng): CupClub {
  const free = pool.filter((c) => !used.has(c.n));
  const from = free.length ? free : pool;
  return from[Math.floor(rnd() * from.length)] ?? pool[0];
}

function playTie(
  myAvg: number,
  opp: CupClub,
  national: boolean,
  round: string,
  rnd: Rng,
): CupTie {
  const won = rnd() < winChance(myAvg, opp.r, national);
  let gf: number;
  let ga: number;
  if (won) {
    gf = Math.floor(rnd() * 3) + 1;
    ga = Math.floor(rnd() * gf);
  } else {
    ga = Math.floor(rnd() * 3) + 1;
    gf = Math.floor(rnd() * ga);
  }
  return { round, opp: opp.n, oppRating: opp.r, gf, ga, won, detail: null };
}

function band(pool: readonly CupClub[], lo: number, hi: number): readonly CupClub[] {
  const out = pool.filter((c) => c.r >= lo && c.r <= hi);
  return out.length ? out : pool;
}

/** A generator of the cups' own, so the league's stream is never touched. */
function cupSeed(runSeed: number): number {
  let h = (runSeed ^ 0x5bf03635) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function simulateCups(
  myAvg: number,
  leaguePosition: number,
  runSeed: number,
): Cups {
  const rnd = mulberry32(cupSeed(runSeed));

  /* ---- National Cup: everyone is in it, entering at the third round ---- */
  const natTies: CupTie[] = [];
  const usedN = new Set<string>();
  let natElim: string | null = null;

  for (let i = 0; i < NAT_ROUNDS.length; i++) {
    const [lo, hi] = NAT_BANDS[i];
    const opp = pickOpp(band(NATIONAL_CLUBS, lo, hi), usedN, rnd);
    usedN.add(opp.n);
    const tie = playTie(myAvg, opp, true, NAT_ROUNDS[i], rnd);
    natTies.push(tie);
    if (!tie.won) {
      natElim = NAT_ROUNDS[i];
      break;
    }
  }

  const national: CupRun = {
    name: 'National Cup',
    ties: natTies,
    won: !natElim,
    elim: natElim,
    qualified: true,
    stages: [...NAT_ROUNDS],
    reached: natElim ? NAT_ROUNDS.indexOf(natElim as (typeof NAT_ROUNDS)[number]) : NAT_ROUNDS.length,
  };

  /* ---- Continental Cup: the top four qualify ---- */
  if (leaguePosition > 4) {
    return {
      national,
      continental: {
        name: 'Continental Cup',
        ties: [],
        won: false,
        elim: null,
        qualified: false,
        stages: CONT_STAGES,
        reached: 0,
      },
      double: false,
      treble: false,
    };
  }

  const usedC = new Set<string>();
  const contTies: CupTie[] = [];
  let lpWins = 0;

  // Eight league phase games, the opposition getting harder as it goes.
  for (let j = 0; j < 8; j++) {
    const lo = j < 3 ? 71 : j < 6 ? 79 : 87;
    const hi = j < 3 ? 79 : j < 6 ? 87 : 95;
    const opp = pickOpp(band(CONTINENTAL_CLUBS, lo, hi), usedC, rnd);
    usedC.add(opp.n);
    if (rnd() < winChance(myAvg, opp.r, false)) lpWins++;
  }

  let contElim: string | null = lpWins < 3 ? 'League Phase' : null;
  contTies.push({
    round: 'League Phase',
    opp: null,
    oppRating: 0,
    gf: lpWins,
    ga: 8 - lpWins,
    won: lpWins >= 3,
    detail: `P8 W${lpWins} L${8 - lpWins}`,
  });

  if (lpWins >= 3 && lpWins < 5) {
    const opp = pickOpp(band(CONTINENTAL_CLUBS, 78, 88), usedC, rnd);
    usedC.add(opp.n);
    const tie = playTie(myAvg, opp, false, 'Playoff', rnd);
    contTies.push(tie);
    if (!tie.won) contElim = 'Playoff';
  }

  if (!contElim) {
    for (let k = 0; k < KO_ROUNDS.length; k++) {
      const [lo, hi] = KO_BANDS[k];
      const opp = pickOpp(band(CONTINENTAL_CLUBS, lo, hi), usedC, rnd);
      usedC.add(opp.n);
      const tie = playTie(myAvg, opp, false, KO_ROUNDS[k], rnd);
      contTies.push(tie);
      if (!tie.won) {
        contElim = KO_ROUNDS[k];
        break;
      }
    }
  }

  const continental: CupRun = {
    name: 'Continental Cup',
    ties: contTies,
    won: !contElim,
    elim: contElim,
    qualified: true,
    stages: CONT_STAGES,
    reached: contElim ? Math.max(0, CONT_STAGES.indexOf(contElim)) : CONT_STAGES.length,
  };

  const champions = leaguePosition === 1;
  return {
    national,
    continental,
    double: champions && national.won,
    treble: champions && national.won && continental.won,
  };
}
