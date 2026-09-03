import { CHAMPIONSHIP, PREMIER_LEAGUE } from './sim';
import type { Rng } from './rng';

/**
 * Promotion and relegation.
 *
 * The nineteen clubs you play used to be the same nineteen clubs for
 * twenty seasons: Liverpool at 0.88 in season one and 0.88 in season
 * twenty. That quietly flattens a long career, because the mountain you
 * climbed in year three is the same mountain in year fifteen.
 *
 * Now the division is alive. Three go down every May and three come up,
 * and every club that stays drifts a little, because clubs get bought and
 * clubs rot. Leicester won the league at five thousand to one and were
 * relegated nine years later; Newcastle went from nineteenth to the
 * Champions League in three seasons after a takeover. Both of those are
 * inside what this can produce.
 */

export type Club = { name: string; str: number; var: number };

/** Which division a career is in. There are only two. */
export type Division = 1 | 2;

/** How far a club can move in one summer, and how often it moves at all. */
const DRIFT = 0.035;
const TAKEOVER_ODDS = 0.05;
const TAKEOVER = 0.12;
const COLLAPSE_ODDS = 0.05;
const COLLAPSE = 0.11;

/** Nobody in the top flight is weaker than this, or stronger than this. */
const FLOOR = 0.2;
const CEIL = 0.95;

/**
 * The nineteen you start a career against.
 *
 * The real division with your own club taken out of it, because you
 * cannot play yourself. A club that is not in the top flight, which a
 * created club never is, plays the weakest twenty as its nineteen.
 */
export function startingLeague(club: string): Club[] {
  const rest = PREMIER_LEAGUE.filter((c) => c.name !== club);
  return rest.slice(0, 19).map((c) => ({ ...c }));
}

/** The division below, as a career in it plays it. */
export function startingChampionship(club: string): Club[] {
  const rest = CHAMPIONSHIP.filter((c) => c.name !== club);
  return rest.slice(0, 19).map((c) => ({ ...c }));
}

function jitter(c: Club, rnd: Rng): Club {
  let str = c.str + (rnd() - 0.5) * 2 * DRIFT;
  // A takeover, or a slow rot. Rare, and the whole reason a league moves.
  if (rnd() < TAKEOVER_ODDS) str += TAKEOVER;
  else if (rnd() < COLLAPSE_ODDS) str -= COLLAPSE;
  return {
    ...c,
    str: Math.round(Math.max(FLOOR, Math.min(CEIL, str)) * 1000) / 1000,
  };
}

export type PyramidResult = {
  /** the nineteen clubs for next season */
  league: Club[];
  /** who went down, in order */
  relegated: string[];
  /** who came up */
  promoted: string[];
  /** true if the club you manage was one of the three going down */
  youWentDown: boolean;
  /** true if you finished high enough to go up */
  youWentUp: boolean;
};

/**
 * What May does to a division.
 *
 * `table` is the finished league in order, your club included, so the
 * three at the bottom of it are the three who go down whoever they are.
 * Anybody who survives drifts. The three who come up are drawn from the
 * division below, weighted so the ones who just went down are the most
 * likely to bounce straight back, which is what actually happens.
 */
export function endOfSeason(args: {
  division: Division;
  league: readonly Club[];
  table: readonly { name: string; isYou: boolean }[];
  club: string;
  /** clubs sitting in the division below, which grows as clubs go down */
  below: readonly Club[];
  rnd: Rng;
}): PyramidResult & { below: Club[] } {
  const { division, league, table, club, rnd } = args;
  const below = args.below.map((c) => ({ ...c }));

  const bottom = table.slice(-3).map((r) => (r.isYou ? club : r.name));
  const youWentDown = division === 1 && bottom.includes(club);

  /* In the second division the top two go up automatically and third to
     sixth play off for the last place. A career that finishes in the six
     gets one shot at it, which is how it feels. */
  const myRow = table.findIndex((r) => r.isYou);
  const myPos = myRow + 1;
  const youWentUp =
    division === 2 &&
    (myPos <= 2 || (myPos >= 3 && myPos <= 6 && rnd() < 0.25));

  // Everyone left in the division drifts.
  const staying = league.filter((c) => !bottom.includes(c.name)).map((c) => jitter(c, rnd));
  const goingDown = league.filter((c) => bottom.includes(c.name));

  /* Three come up. The ones who went down most recently are strongest and
     sit at the top of the pool, so they are the likeliest to return. */
  const pool = below.length ? below : CHAMPIONSHIP.map((c) => ({ ...c }));
  const ranked = [...pool].sort((a, b) => b.str - a.str);
  const coming: Club[] = [];
  for (let i = 0; i < 3 && ranked.length; i++) {
    /* Weighted toward the top of the second division without being
       certain. Two of the three are usually the best two down there and
       one is a surprise, which is what a play-off final is. */
    const reach = Math.min(ranked.length, i === 2 ? 8 : 4);
    const pick = Math.floor(Math.pow(rnd(), 1.7) * reach);
    const [taken] = ranked.splice(pick, 1);
    if (!taken) break;
    /* Coming up is a step you rarely take clean. Every promoted side is
       weaker than the division it has joined. */
    coming.push({
      ...taken,
      str: Math.round(Math.max(FLOOR, Math.min(0.45, taken.str + 0.02)) * 1000) / 1000,
    });
  }

  /* And the division below keeps what came down, at a level that makes
     them favourites to come back. */
  const nextBelow = ranked.map((c) => jitter(c, rnd));
  for (const c of goingDown) {
    if (c.name === club) continue;
    nextBelow.push({
      ...c,
      str: Math.round(Math.max(FLOOR, Math.min(0.5, c.str - 0.03)) * 1000) / 1000,
    });
  }

  let next = [...staying, ...coming];

  /* Nineteen opponents, always. If your own relegation or promotion has
     changed who you are playing, the shortfall is made up from whichever
     division you are now in. */
  const want = 19;
  if (next.length > want) {
    next = next.sort((a, b) => b.str - a.str).slice(0, want);
  }
  while (next.length < want) {
    const extra = nextBelow.shift();
    if (!extra) break;
    next.push(extra);
  }

  return {
    league: next.sort((a, b) => b.str - a.str),
    below: nextBelow,
    relegated: bottom,
    promoted: coming.map((c) => c.name),
    youWentDown,
    youWentUp,
  };
}

/**
 * The whole division you are about to play in, after going up or down.
 *
 * Going down means nineteen clubs from the second tier and the ones who
 * came down with you. Going up means nineteen from the top flight.
 */
export function divisionFor(division: Division, club: string): Club[] {
  return division === 1 ? startingLeague(club) : startingChampionship(club);
}

/** What the division is called, for anything that has to say it. */
export function divisionName(division: Division): string {
  return division === 1 ? 'Premier League' : 'Championship';
}
