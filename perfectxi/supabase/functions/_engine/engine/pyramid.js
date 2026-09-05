import { CHAMPIONSHIP, PREMIER_LEAGUE } from './sim.js';
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
export function startingLeague(club) {
    const rest = PREMIER_LEAGUE.filter((c) => c.name !== club);
    return rest.slice(0, 19).map((c) => ({ ...c }));
}
/** The division below, as a career in it plays it. */
export function startingChampionship(club) {
    const rest = CHAMPIONSHIP.filter((c) => c.name !== club);
    return rest.slice(0, 19).map((c) => ({ ...c }));
}
function jitter(c, rnd) {
    let str = c.str + (rnd() - 0.5) * 2 * DRIFT;
    // A takeover, or a slow rot. Rare, and the whole reason a league moves.
    if (rnd() < TAKEOVER_ODDS)
        str += TAKEOVER;
    else if (rnd() < COLLAPSE_ODDS)
        str -= COLLAPSE;
    return {
        ...c,
        str: Math.round(Math.max(FLOOR, Math.min(CEIL, str)) * 1000) / 1000,
    };
}
/**
 * What May does to a division.
 *
 * `table` is the finished league in order, your club included, so the
 * three at the bottom of it are the three who go down whoever they are.
 * Anybody who survives drifts. The three who come up are drawn from the
 * division below, weighted so the ones who just went down are the most
 * likely to bounce straight back, which is what actually happens.
 */
export function endOfSeason(args) {
    const { division, league, table, club, rnd } = args;
    const below = args.below.map((c) => ({ ...c }));
    const bottom = table.slice(-3).map((r) => (r.isYou ? club : r.name));
    const youWentDown = division === 1 && bottom.includes(club);
    /* In the second division the top two go up automatically and third to
       sixth play off for the last place. A career that finishes in the six
       gets one shot at it, which is how it feels. */
    const myRow = table.findIndex((r) => r.isYou);
    const myPos = myRow + 1;
    const youWentUp = division === 2 &&
        (myPos <= 2 || (myPos >= 3 && myPos <= 6 && rnd() < 0.25));
    // Everyone left in the division drifts.
    const staying = league.filter((c) => !bottom.includes(c.name)).map((c) => jitter(c, rnd));
    const goingDown = league.filter((c) => bottom.includes(c.name));
    /* Three come up. The ones who went down most recently are strongest and
       sit at the top of the pool, so they are the likeliest to return. */
    /* Never the club you manage. The division below carries across a change
       of job, so a club you once relegated can still be sitting in it when
       you take over at that very club, and it would then be promoted into
       your own league and you would play yourself. */
    const pool = (below.length ? below : CHAMPIONSHIP.map((c) => ({ ...c }))).filter((c) => c.name !== club);
    const ranked = [...pool].sort((a, b) => b.str - a.str);
    const coming = [];
    for (let i = 0; i < 3 && ranked.length; i++) {
        /* Weighted toward the top of the second division without being
           certain. Two of the three are usually the best two down there and
           one is a surprise, which is what a play-off final is. */
        const reach = Math.min(ranked.length, i === 2 ? 8 : 4);
        const pick = Math.floor(Math.pow(rnd(), 1.7) * reach);
        const [taken] = ranked.splice(pick, 1);
        if (!taken)
            break;
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
        if (c.name === club)
            continue;
        nextBelow.push({
            ...c,
            str: Math.round(Math.max(FLOOR, Math.min(0.5, c.str - 0.03)) * 1000) / 1000,
        });
    }
    /* Nineteen opponents, always, and never two of anybody nor yourself.
  
       The order matters and it used to be wrong. Trimming and topping up
       first and only then removing duplicates left eighteen clubs in the
       division, because a club promoted out of the tier below could already
       be in it: relegation hands you a whole new division while the tier
       below still lists the clubs now in it. Deduplicating first and topping
       up afterwards cannot produce that, and the top up keeps going until it
       has nineteen. */
    const want = 19;
    const uniq = (all) => all
        .filter((c) => c.name !== club)
        .filter((c, i, list) => list.findIndex((x) => x.name === c.name) === i);
    let next = uniq([...staying, ...coming]);
    if (next.length > want) {
        next = next.sort((a, b) => b.str - a.str).slice(0, want);
    }
    const add = (c) => {
        if (next.length >= want)
            return;
        if (c.name === club || next.some((x) => x.name === c.name))
            return;
        next.push({ ...c });
    };
    while (next.length < want && nextBelow.length)
        add(nextBelow.shift());
    /* And if the tier below has run dry as well, from the division itself,
       because a league with eighteen clubs in it is not a league. */
    for (const c of divisionFor(division, club))
        add(c);
    for (const c of CHAMPIONSHIP)
        add({ ...c });
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
export function divisionFor(division, club) {
    return division === 1 ? startingLeague(club) : startingChampionship(club);
}
/**
 * A club's strength as a rating on the same 30 to 99 scale as a player.
 *
 * Strength runs to 0.95 and drift can push it there, which came out as a
 * club "rated 103". Everything that shows a club's quality to a person
 * goes through here so it cannot happen again.
 */
export function clubRating(str) {
    return Math.max(30, Math.min(99, Math.round(str * 100 + 8)));
}
/** The other way round, for putting a club into a league at a known level. */
export function ratingStrength(rating) {
    return Math.round(Math.max(FLOOR, Math.min(CEIL, (rating - 8) / 100)) * 1000) / 1000;
}
/** What the division is called, for anything that has to say it. */
export function divisionName(division) {
    return division === 1 ? 'Premier League' : 'Championship';
}
