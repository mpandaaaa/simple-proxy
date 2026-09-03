import { mulberry32, type Rng } from './rng';

/**
 * The cups, as they are actually played.
 *
 * Five competitions with their real formats, their real calendars and
 * their real prize money, measured against the 2024/25 season:
 *
 *   FA Cup          Premier League clubs enter at the third round. Six
 *                   ties to the trophy, no replays since 2024/25, the
 *                   semi-final and final at Wembley. £4.1m to the winner.
 *   EFL Cup         Enter at the second round, or the third if you are in
 *                   Europe. The semi-final is over two legs. £100k for
 *                   the trophy and about £1.1m of the Wembley gate.
 *   Champions       Thirty six clubs, eight league phase games, top eight
 *                   straight to the last sixteen and ninth to twenty
 *                   fourth into a two legged playoff. Arsenal earned
 *                   £96.85m for reaching the semi-final of it.
 *   Europa          The same shape. Tottenham won it for about £25m.
 *   Conference      Six league phase games. Chelsea won it for about £16m.
 *
 * Every tie carries the matchday it is played on, so a cup run sits in
 * the fixture list beside the league rather than appearing from nowhere
 * at the end of a season.
 *
 * Everything is drawn from a generator seeded off the run rather than
 * from the run's own stream, so the cups cannot move a single league
 * result and a season still replays from its seed alone.
 */

export type CupClub = { n: string; r: number };

export type CompId = 'shield' | 'efl' | 'fa' | 'ucl' | 'uel' | 'uecl';

export const COMPS: Record<CompId, { name: string; short: string; mark: string }> = {
  shield: { name: 'Community Shield', short: 'Shield', mark: '🛡' },
  efl: { name: 'League Cup', short: 'League Cup', mark: '🥤' },
  fa: { name: 'FA Cup', short: 'FA Cup', mark: '🏆' },
  ucl: { name: 'Champions League', short: 'Champions', mark: '🌍' },
  uel: { name: 'Europa League', short: 'Europa', mark: '🟠' },
  uecl: { name: 'Conference League', short: 'Conference', mark: '🟢' },
};

/** Which European competition a club is in, if any. */
export type Europe = 'ucl' | 'uel' | 'uecl' | null;

/**
 * The Community Shield tie, worked out at the end of the season before.
 *
 * The rules are exact and the game was making all three of them up. It is
 * the champions against the FA Cup holders. If one club has won both, the
 * other place goes to the league runners up rather than to the beaten
 * finalists. And if you are in it, you are in it for one of those two
 * reasons, which is worth saying on the screen.
 */
export type ShieldTie = {
  /** who you play */
  club: string;
  /** how good they are */
  rating: number;
  /** why you are in it */
  as: 'champions' | 'holders';
  /** why they are in it */
  they: 'champions' | 'holders' | 'runners-up';
};

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

/**
 * The Europa and Conference fields.
 *
 * A rung down each time. The Conference League is won by clubs who would
 * finish mid table in England, which is exactly why it is the one a club
 * on the way up wins first.
 */
export const EUROPA_CLUBS: readonly CupClub[] = [
  { n: 'Roma', r: 82 }, { n: 'Lazio', r: 81 }, { n: 'Real Sociedad', r: 80 },
  { n: 'Villarreal', r: 80 }, { n: 'Eintracht Frankfurt', r: 80 }, { n: 'Lyon', r: 79 },
  { n: 'Fenerbahce', r: 79 }, { n: 'Ajax', r: 81 }, { n: 'Rangers', r: 77 },
  { n: 'Braga', r: 77 }, { n: 'Anderlecht', r: 76 }, { n: 'Olympiacos', r: 76 },
  { n: 'Hoffenheim', r: 75 }, { n: 'Union Saint-Gilloise', r: 75 }, { n: 'Slavia Prague', r: 75 },
  { n: 'Bodo/Glimt', r: 74 }, { n: 'Ferencvaros', r: 73 }, { n: 'Twente', r: 74 },
  { n: 'Midtjylland', r: 73 }, { n: 'AZ Alkmaar', r: 75 }, { n: 'Galatasaray', r: 79 },
  { n: 'PAOK', r: 74 }, { n: 'Malmo', r: 71 }, { n: 'Qarabag', r: 71 },
  { n: 'Ludogorets', r: 70 }, { n: 'Elfsborg', r: 69 }, { n: 'RFS', r: 66 },
  { n: 'Dynamo Kyiv', r: 72 }, { n: 'Besiktas', r: 76 }, { n: 'Steaua', r: 70 },
  { n: 'Maccabi Tel Aviv', r: 70 }, { n: 'Nice', r: 76 }, { n: 'Porto', r: 81 },
  { n: 'Real Betis', r: 79 }, { n: 'Athletic Bilbao', r: 80 }, { n: 'Viktoria Plzen', r: 72 },
];

export const CONFERENCE_CLUBS: readonly CupClub[] = [
  { n: 'Fiorentina', r: 78 }, { n: 'Real Betis', r: 79 }, { n: 'Rapid Vienna', r: 70 },
  { n: 'Chelsea', r: 87 }, { n: 'Gent', r: 71 }, { n: 'Vitoria Guimaraes', r: 71 },
  { n: 'Djurgarden', r: 68 }, { n: 'Legia Warsaw', r: 71 }, { n: 'Lugano', r: 68 },
  { n: 'Jagiellonia', r: 68 }, { n: 'Cercle Brugge', r: 70 }, { n: 'Heidenheim', r: 72 },
  { n: 'Copenhagen', r: 74 }, { n: 'Molde', r: 70 }, { n: 'Hearts', r: 68 },
  { n: 'Shamrock Rovers', r: 64 }, { n: 'Larne', r: 60 }, { n: 'The New Saints', r: 60 },
  { n: 'Astana', r: 66 }, { n: 'Omonia', r: 68 }, { n: 'Panathinaikos', r: 74 },
  { n: 'St Gallen', r: 68 }, { n: 'Mlada Boleslav', r: 66 }, { n: 'Borac', r: 63 },
  { n: 'Petrocub', r: 60 }, { n: 'Noah', r: 62 }, { n: 'Olimpija', r: 66 },
  { n: 'Pafos', r: 66 }, { n: 'TSC', r: 65 }, { n: 'Hapoel Beer Sheva', r: 68 },
  { n: 'LASK', r: 71 }, { n: 'Backa Topola', r: 63 }, { n: 'Celje', r: 66 },
  { n: 'APOEL', r: 68 }, { n: 'Istanbul Basaksehir', r: 72 }, { n: 'Guimaraes B', r: 64 },
];

/**
 * The English field.
 *
 * The FA Cup third round is sixty four clubs and most of them are not in
 * the Premier League, which is the whole point of it. The lower half of
 * this list is what a giant killing looks like.
 */
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
  { n: 'Birmingham', r: 65 }, { n: 'Wrexham', r: 63 }, { n: 'Bolton', r: 63 },
  { n: 'Charlton', r: 63 }, { n: 'Wycombe', r: 61 }, { n: 'Barnsley', r: 61 },
  { n: 'Reading', r: 62 }, { n: 'Peterborough', r: 60 }, { n: 'Exeter', r: 59 },
  { n: 'Lincoln', r: 59 }, { n: 'Mansfield', r: 58 }, { n: 'Crawley', r: 56 },
  { n: 'Tamworth', r: 50 }, { n: 'Salford', r: 55 }, { n: 'Newport', r: 54 },
  { n: 'Doncaster', r: 57 }, { n: 'Bromley', r: 53 }, { n: 'Harrogate', r: 54 },
  { n: 'Chesterfield', r: 55 }, { n: 'Walsall', r: 56 }, { n: 'Accrington', r: 53 },
];

export type CupLeg = { gf: number; ga: number; home: boolean };

export type CupTie = {
  round: string;
  opp: string | null;
  oppRating: number;
  gf: number;
  ga: number;
  won: boolean;
  /** which league matchday it sits beside, 0 for before the season */
  md: number;
  home: boolean;
  /** a Wembley or a final is nobody's ground */
  neutral: boolean;
  /** two legged ties carry both, in order */
  legs: CupLeg[] | null;
  /** level after everything, so it went to penalties */
  pens: string | null;
  /** the league phase carries a record rather than a score */
  detail: string | null;
};

export type CupRun = {
  id: CompId;
  name: string;
  entered: boolean;
  /** the old name for entered, which the draft's card still reads */
  qualified: boolean;
  ties: CupTie[];
  won: boolean;
  /** the round it ended in, or null if it was won */
  elim: string | null;
  stages: string[];
  reached: number;
  /** prize money, in £m */
  money: number;
};

export type CupSeason = {
  runs: CupRun[];
  /** every competition's prize money added up, in £m */
  money: number;
  /** what was won */
  trophies: CompId[];
  /** which European competition next season, from the finish and the cups */
  europeNext: Europe;
  double: boolean;
  treble: boolean;
};

/* ---------- the calendar ---------- */

const FA_ROUNDS = ['Round 3', 'Round 4', 'Round 5', 'Quarter-Final', 'Semi-Final', 'Final'];
const FA_MD = [20, 23, 26, 30, 33, 38];
/** Who you can draw in each round. The third round is where the minnows are. */
const FA_BANDS: readonly [number, number][] = [
  [50, 70], [56, 76], [63, 82], [70, 88], [74, 91], [78, 93],
];
/** £m, and the final is what the winner takes. */
const FA_MONEY = [0.11, 0.12, 0.23, 0.45, 1.0, 2.0];

const EFL_ROUNDS = ['Round 2', 'Round 3', 'Round 4', 'Quarter-Final', 'Semi-Final', 'Final'];
const EFL_MD = [3, 6, 11, 16, 22, 27];
const EFL_BANDS: readonly [number, number][] = [
  [50, 68], [56, 74], [63, 82], [70, 88], [74, 91], [78, 93],
];
const EFL_MONEY = [0.02, 0.03, 0.05, 0.1, 0.2, 1.15];

const EURO_KO = ['Last 16', 'Quarter-Final', 'Semi-Final', 'Final'];
const EURO_KO_MD = [25, 30, 33, 37];

/**
 * What each competition pays, in £m.
 *
 * Measured against what Premier League clubs actually banked in 2024/25:
 * Arsenal £96.85m for a Champions League semi-final, Manchester City
 * £65.48m for the league phase alone, Tottenham about £25m for winning
 * the Europa League, Chelsea about £16m for the Conference.
 *
 * `base` is the participation fee plus the share of the broadcast pot an
 * English club draws, which is most of why the numbers are so large
 * before a ball is kicked.
 */
const EURO_MONEY: Record<'ucl' | 'uel' | 'uecl', {
  base: number;
  win: number;
  draw: number;
  place: number;
  topEight: number;
  playoff: number;
  ko: number[];
  lift: number;
  games: number;
}> = {
  ucl: {
    base: 50, win: 1.8, draw: 0.6, place: 0.25, topEight: 9.5, playoff: 0.9,
    ko: [9.5, 10.6, 12.8, 15.7], lift: 5.5, games: 8,
  },
  uel: {
    base: 4.4, win: 0.38, draw: 0.13, place: 0.06, topEight: 1.1, playoff: 0.35,
    ko: [1.4, 2.1, 3.3, 5.0], lift: 4.2, games: 8,
  },
  uecl: {
    base: 2.6, win: 0.25, draw: 0.08, place: 0.04, topEight: 0.7, playoff: 0.25,
    ko: [0.8, 1.3, 2.2, 3.4], lift: 2.5, games: 6,
  },
};

const EURO_POOL: Record<'ucl' | 'uel' | 'uecl', readonly CupClub[]> = {
  ucl: CONTINENTAL_CLUBS,
  uel: EUROPA_CLUBS,
  uecl: CONFERENCE_CLUBS,
};

/** The league phase gets harder as it goes, as the seeding makes it. */
const EURO_BANDS: Record<'ucl' | 'uel' | 'uecl', readonly [number, number][]> = {
  ucl: [[71, 79], [75, 84], [79, 88], [82, 92], [84, 95]],
  uel: [[64, 74], [69, 77], [73, 80], [76, 82], [78, 84]],
  uecl: [[58, 68], [62, 71], [66, 74], [69, 78], [71, 82]],
};

const EURO_KO_BANDS: Record<'ucl' | 'uel' | 'uecl', readonly [number, number][]> = {
  ucl: [[82, 90], [85, 93], [87, 95], [89, 95]],
  uel: [[76, 82], [78, 84], [79, 86], [80, 87]],
  uecl: [[68, 77], [70, 79], [72, 81], [74, 83]],
};

/* ---------- the maths of one tie ---------- */

/**
 * The chance of going through.
 *
 * A logistic on the rating gap, flattened for the domestic cups. One
 * game, a tired side and a crowd that has waited all year is why the
 * third round is the third round: the flattening is what makes a
 * hundred rated club lose at Tamworth often enough to be football.
 */
function winChance(myAvg: number, oppRating: number, flatten: number): number {
  const p = 1 / (1 + Math.exp(-(myAvg - oppRating) / 8));
  return p * (1 - flatten) + flatten / 2;
}

/**
 * A cup score.
 *
 * The winner scores more, unless it finished level, which is the whole
 * point of a cup tie and which this could not produce at all: the loser's
 * goals were always drawn strictly below the winner's, so no tie in the
 * game had ever gone to penalties. About a fifth of knockout ties are
 * still level after ninety minutes.
 */
const LEVEL_ODDS = 0.21;

function score(won: boolean, rnd: Rng, canDraw = true): { gf: number; ga: number } {
  if (canDraw && rnd() < LEVEL_ODDS) {
    const n = Math.floor(rnd() * 3);
    return { gf: n, ga: n };
  }
  if (won) {
    const gf = Math.floor(rnd() * 3) + 1;
    return { gf, ga: Math.floor(rnd() * gf) };
  }
  const ga = Math.floor(rnd() * 3) + 1;
  return { gf: Math.floor(rnd() * ga), ga };
}

function pickOpp(pool: readonly CupClub[], used: Set<string>, rnd: Rng): CupClub {
  const free = pool.filter((c) => !used.has(c.n));
  const from = free.length ? free : pool;
  return from[Math.floor(rnd() * from.length)] ?? pool[0];
}

/**
 * The field, without you in it.
 *
 * Every pool here is a list of real clubs and one of them is very likely
 * to be the one you manage. Drawing Arsenal in the semi-final while you
 * are Arsenal is not a cup tie.
 */
function fieldFor(pool: readonly CupClub[], club: string | null): readonly CupClub[] {
  if (!club) return pool;
  const out = pool.filter((c) => c.n !== club);
  return out.length ? out : pool;
}

function band(pool: readonly CupClub[], lo: number, hi: number): readonly CupClub[] {
  const out = pool.filter((c) => c.r >= lo && c.r <= hi);
  return out.length ? out : pool;
}

function oneLeg(
  myAvg: number,
  opp: CupClub,
  flatten: number,
  round: string,
  md: number,
  neutral: boolean,
  rnd: Rng,
): CupTie {
  const home = neutral ? false : rnd() < 0.5;
  // A tie at your own ground is worth roughly a point of rating.
  const edge = neutral ? 0 : home ? 1.4 : -1.4;
  const won = rnd() < winChance(myAvg + edge, opp.r, flatten);
  const s = score(won, rnd);
  const level = s.gf === s.ga;
  return {
    round,
    opp: opp.n,
    oppRating: opp.r,
    gf: s.gf,
    ga: s.ga,
    won,
    md,
    home,
    neutral,
    legs: null,
    pens: level ? (won ? 'won on penalties' : 'lost on penalties') : null,
    detail: null,
  };
}

/** Two legs, away goals long since abolished, penalties if it is level. */
function twoLegs(
  myAvg: number,
  opp: CupClub,
  round: string,
  md: number,
  rnd: Rng,
): CupTie {
  const won = rnd() < winChance(myAvg, opp.r, 0);
  const first = score(rnd() < 0.5, rnd);
  // The second leg is built so the aggregate agrees with the result.
  const need = won ? 1 : -1;
  let second = score(won, rnd, false);
  let agg = first.gf + second.gf - (first.ga + second.ga);
  let guard = 0;
  while (Math.sign(agg) !== need && guard++ < 24) {
    second = score(won, rnd, false);
    agg = first.gf + second.gf - (first.ga + second.ga);
  }
  const level = agg === 0;
  const away = rnd() < 0.5;
  return {
    round,
    opp: opp.n,
    oppRating: opp.r,
    gf: first.gf + second.gf,
    ga: first.ga + second.ga,
    won,
    md,
    home: true,
    neutral: false,
    legs: [
      { ...first, home: away ? false : true },
      { ...second, home: away ? true : false },
    ],
    pens: level ? (won ? 'won on penalties' : 'lost on penalties') : null,
    detail: `${first.gf}-${first.ga}, ${second.gf}-${second.ga} on aggregate`,
  };
}

function emptyRun(id: CompId): CupRun {
  return {
    id,
    name: COMPS[id].name,
    entered: false,
    qualified: false,
    ties: [],
    won: false,
    elim: null,
    stages: [],
    reached: 0,
    money: 0,
  };
}

/* ---------- the domestic cups ---------- */

function domestic(
  id: 'fa' | 'efl',
  myAvg: number,
  inEurope: boolean,
  club: string | null,
  rnd: Rng,
): CupRun {
  const field = fieldFor(NATIONAL_CLUBS, club);
  const rounds = id === 'fa' ? FA_ROUNDS : EFL_ROUNDS;
  const mds = id === 'fa' ? FA_MD : EFL_MD;
  const bands = id === 'fa' ? FA_BANDS : EFL_BANDS;
  const money = id === 'fa' ? FA_MONEY : EFL_MONEY;
  /* A club in Europe skips the League Cup's second round, which is the
     one real concession the calendar makes to a fixture list. */
  const from = id === 'efl' && inEurope ? 1 : 0;

  const ties: CupTie[] = [];
  const used = new Set<string>();
  let elim: string | null = null;
  let earned = 0;

  for (let i = from; i < rounds.length; i++) {
    const [lo, hi] = bands[i];
    const opp = pickOpp(band(field, lo, hi), used, rnd);
    used.add(opp.n);
    const last = i === rounds.length - 1;
    const semi = i === rounds.length - 2;
    // The League Cup semi-final is the only two legged tie in England.
    const tie =
      id === 'efl' && semi
        ? twoLegs(myAvg, opp, rounds[i], mds[i], rnd)
        : oneLeg(myAvg, opp, 0.3, rounds[i], mds[i], last || (id === 'fa' && semi), rnd);
    ties.push(tie);
    earned += money[i];
    if (!tie.won) {
      elim = rounds[i];
      // The beaten finalist still takes half of the final's cheque.
      if (last) earned -= money[i] / 2;
      break;
    }
  }

  return {
    id,
    name: COMPS[id].name,
    entered: true,
    qualified: true,
    ties,
    won: !elim,
    elim,
    stages: rounds.slice(from),
    reached: elim ? rounds.indexOf(elim) - from : rounds.length - from,
    money: Math.round(earned * 100) / 100,
  };
}

/* ---------- Europe ---------- */

function european(
  id: 'ucl' | 'uel' | 'uecl',
  myAvg: number,
  club: string | null,
  rnd: Rng,
): CupRun {
  const pay = EURO_MONEY[id];
  const pool = fieldFor(EURO_POOL[id], club);
  const bands = EURO_BANDS[id];
  const koBands = EURO_KO_BANDS[id];
  const stages = ['League Phase', 'Playoff', ...EURO_KO];

  const ties: CupTie[] = [];
  const used = new Set<string>();
  let earned = pay.base;

  /* The league phase. Eight games, six in the Conference, against a
     field that gets harder as the seeding pots go up. */
  let w = 0;
  let d = 0;
  let gf = 0;
  let ga = 0;
  for (let g = 0; g < pay.games; g++) {
    const [lo, hi] = bands[Math.min(bands.length - 1, Math.floor((g / pay.games) * bands.length))];
    const opp = pickOpp(band(pool, lo, hi), used, rnd);
    used.add(opp.n);
    const home = g % 2 === 0;
    const p = winChance(myAvg + (home ? 1.4 : -1.4), opp.r, 0);
    const roll = rnd();
    if (roll < p * 0.82) {
      w++;
      gf += 2;
      ga += 1;
    } else if (roll < p * 0.82 + 0.22) {
      d++;
      gf += 1;
      ga += 1;
    } else {
      gf += 1;
      ga += 2;
    }
  }
  const pts = w * 3 + d;
  const l = pay.games - w - d;
  /* Where that leaves you in a table of thirty six. Twenty two points out
     of a possible twenty four is first; anything under about seven is
     out altogether. */
  const place = Math.max(1, Math.min(36, Math.round(36 - (pts / (pay.games * 3)) * 35)));
  earned += w * pay.win + d * pay.draw + (37 - place) * pay.place;

  ties.push({
    round: 'League Phase',
    opp: null,
    oppRating: 0,
    gf,
    ga,
    won: place <= 24,
    md: 4,
    home: true,
    neutral: false,
    legs: null,
    pens: null,
    detail: `${place}${ordinalSuffix(place)} of 36 · P${pay.games} W${w} D${d} L${l}`,
  });

  if (place > 24) {
    return {
      id,
      name: COMPS[id].name,
      entered: true,
      qualified: true,
      ties,
      won: false,
      elim: 'League Phase',
      stages,
      reached: 0,
      money: Math.round(earned * 100) / 100,
    };
  }

  let elim: string | null = null;

  // Ninth to twenty fourth play a two legged tie to reach the last sixteen.
  if (place > 8) {
    earned += pay.playoff;
    const opp = pickOpp(band(pool, bands[1][0], bands[3][1]), used, rnd);
    used.add(opp.n);
    const tie = twoLegs(myAvg, opp, 'Playoff', 22, rnd);
    ties.push(tie);
    if (!tie.won) elim = 'Playoff';
  } else {
    earned += pay.topEight;
  }

  if (!elim) {
    for (let k = 0; k < EURO_KO.length; k++) {
      const [lo, hi] = koBands[k];
      const opp = pickOpp(band(pool, lo, hi), used, rnd);
      used.add(opp.n);
      const last = k === EURO_KO.length - 1;
      const tie = last
        ? oneLeg(myAvg, opp, 0, EURO_KO[k], EURO_KO_MD[k], true, rnd)
        : twoLegs(myAvg, opp, EURO_KO[k], EURO_KO_MD[k], rnd);
      ties.push(tie);
      earned += pay.ko[k];
      if (!tie.won) {
        elim = EURO_KO[k];
        break;
      }
    }
    if (!elim) earned += pay.lift;
  }

  return {
    id,
    name: COMPS[id].name,
    entered: true,
    qualified: true,
    ties,
    won: !elim,
    elim,
    stages,
    reached: elim ? Math.max(0, stages.indexOf(elim)) : stages.length,
    money: Math.round(earned * 100) / 100,
  };
}

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

/* ---------- the season ---------- */

/**
 * Which European competition a finish and a cup earn you.
 *
 * The top five go to the Champions League, which is what England has had
 * for the last two seasons on the coefficient. Winning the Europa League
 * takes you up into it and winning the FA Cup takes you into the Europa,
 * so a cup run is worth a place as well as a trophy.
 */
export function qualifyFor(
  position: number,
  wonFa: boolean,
  wonEfl: boolean,
  wonUcl: boolean,
  wonUel: boolean,
  wonUecl: boolean,
): Europe {
  if (position <= 5 || wonUcl || wonUel) return 'ucl';
  if (position === 6 || wonFa || wonUecl) return 'uel';
  if (position === 7 || wonEfl) return 'uecl';
  return null;
}

/** A generator of the cups' own, so the league's stream is never touched. */
function cupSeed(runSeed: number): number {
  let h = (runSeed ^ 0x5bf03635) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Every cup a club plays in a season.
 *
 * `europe` is where last season's finish put you, and `shield` is true if
 * you go into the season as champions or as the FA Cup holders.
 */
export function simulateSeasonCups(args: {
  myAvg: number;
  leaguePosition: number;
  europe: Europe;
  /** the Shield tie earned last season, or null if there is not one */
  shield: ShieldTie | null;
  runSeed: number;
  /** the club you manage, so you are never drawn against yourself */
  club?: string | null;
}): CupSeason {
  const { myAvg, leaguePosition, europe, shield, runSeed, club = null } = args;
  const rnd = mulberry32(cupSeed(runSeed));

  const runs: CupRun[] = [];

  /* The Shield.
     One match at Wembley the weekend before the season starts, against the
     club the rules say it is against. Ninety minutes and no extra time: if
     it is level it goes straight to penalties. Worth nothing but the day
     out, because the takings go to charity rather than to the winners. */
  if (shield) {
    const opp = { n: shield.club, r: shield.rating };
    const tie = oneLeg(myAvg, opp, 0.18, 'Final', 0, true, rnd);
    runs.push({
      id: 'shield',
      name: COMPS.shield.name,
      entered: true,
      qualified: true,
      ties: [tie],
      won: tie.won,
      elim: tie.won ? null : 'Final',
      stages: ['Final'],
      reached: tie.won ? 1 : 0,
      money: 0,
    });
  } else {
    runs.push(emptyRun('shield'));
  }

  const euroRun = europe ? european(europe, myAvg, club, rnd) : null;

  runs.push(domestic('efl', myAvg, europe !== null, club, rnd));
  runs.push(domestic('fa', myAvg, europe !== null, club, rnd));
  for (const id of ['ucl', 'uel', 'uecl'] as const) {
    runs.push(europe === id && euroRun ? euroRun : emptyRun(id));
  }

  const fa = runs.find((r) => r.id === 'fa')!;
  const efl = runs.find((r) => r.id === 'efl')!;
  const ucl = runs.find((r) => r.id === 'ucl')!;
  const uel = runs.find((r) => r.id === 'uel')!;
  const uecl = runs.find((r) => r.id === 'uecl')!;

  const trophies = runs.filter((r) => r.won).map((r) => r.id);
  const money = Math.round(runs.reduce((a, r) => a + r.money, 0) * 100) / 100;

  return {
    runs,
    money,
    trophies,
    europeNext: qualifyFor(leaguePosition, fa.won, efl.won, ucl.won, uel.won, uecl.won),
    double: leaguePosition === 1 && fa.won,
    treble: leaguePosition === 1 && fa.won && ucl.won,
  };
}

/**
 * The old two cup shape, kept for the draft.
 *
 * A draft XI is one season with no history, so it has no European place
 * to have earned. It plays the FA Cup, and the Champions League if the
 * eleven finished in the top five.
 */
export type Cups = {
  national: CupRun;
  continental: CupRun;
  double: boolean;
  treble: boolean;
};

export function simulateCups(
  myAvg: number,
  leaguePosition: number,
  runSeed: number,
): Cups {
  const season = simulateSeasonCups({
    myAvg,
    leaguePosition,
    europe: leaguePosition <= 5 ? 'ucl' : null,
    /* A draft XI has no season before it, so it has never been champions
       and has never held the FA Cup. */
    shield: null,
    runSeed,
  });
  const national = season.runs.find((r) => r.id === 'fa')!;
  const continental = season.runs.find((r) => r.id === 'ucl')!;
  return {
    national,
    continental,
    double: season.double,
    treble: season.treble,
  };
}
