import { SQUADS } from '../data/squads.js';
import { CAPACITY, DOB, RIVALS } from '../data/dynasty.js';
import { FORMATIONS } from './formations.js';
import { FAN_CEIL, startingFans } from './dynastyClub.js';
import { divisionFor, ratingStrength, startingLeague } from './pyramid.js';
import { CHAMPIONSHIP } from './sim.js';
import { mulberry32 } from './rng.js';
import { ageIn, careerSeed, seedTracks, squadRating, starters, wage, EMPTY_STAFF, EMPTY_TACTIC, } from './dynasty.js';
export const SCENARIOS = [
    {
        id: 'giant',
        title: 'Sleeping Giant',
        desc: 'A big club underachieving badly. Huge budget, huge pressure, no patience.',
        tier: [1, 6],
        budget: 1.35,
        expect: -2,
        leash: 0.7,
    },
    {
        id: 'elite',
        title: 'Establish the Elite',
        desc: 'A solid mid-table side. Break into Europe and stay there.',
        tier: [5, 12],
        budget: 1.0,
        expect: 0,
        leash: 1.0,
    },
    {
        id: 'rebuild',
        title: 'The Rebuild',
        desc: 'A club in trouble with almost nothing to spend. Survive, then build.',
        tier: [13, 20],
        budget: 0.35,
        expect: 3,
        leash: 1.4,
    },
    {
        id: 'minnow',
        title: 'The Long Haul',
        desc: 'The smallest squad in the division. Nobody expects a thing.',
        tier: [15, 20],
        budget: 0.5,
        expect: 5,
        leash: 1.8,
    },
    {
        id: 'champs',
        title: 'Defend the Throne',
        desc: 'You inherit the champions. Anything but first is a failure.',
        tier: [1, 2],
        budget: 1.15,
        expect: -1,
        leash: 0.55,
    },
];
export function scenarioById(id) {
    return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[1];
}
/**
 * Every club you could manage, ranked by how good its squad actually is.
 *
 * The sixteen best by prime rating, averaged. Sixteen rather than eleven
 * because a squad is what you inherit, and rather than the whole list
 * because that would punish a club for having depth.
 */
export function clubOptions(year = 2026) {
    const out = [];
    for (const key of Object.keys(SQUADS)) {
        const bar = key.lastIndexOf('|');
        if (Number(key.slice(bar + 1)) !== year)
            continue;
        const arr = SQUADS[key];
        if (!arr || arr.length < 11)
            continue;
        const top = arr
            .map((p) => p.prime || p.rtg)
            .sort((a, b) => b - a)
            .slice(0, 16);
        const club = key.slice(0, bar);
        out.push({
            club,
            key,
            year,
            avg: Math.round((top.reduce((a, b) => a + b, 0) / top.length) * 10) / 10,
            rank: 0,
            squadSize: arr.length,
            capacity: CAPACITY[club] ?? 28000,
            rival: RIVALS[club] ?? null,
        });
    }
    out.sort((a, b) => b.avg - a.avg);
    out.forEach((c, i) => {
        c.rank = i + 1;
    });
    return out;
}
export function clubsForScenario(sc, year = 2026) {
    const all = clubOptions(year);
    const picked = all.filter((c) => c.rank >= sc.tier[0] && c.rank <= sc.tier[1]);
    return picked.length ? picked : all;
}
/** What the board asks of a squad of this quality. */
export function objectiveFor(avg) {
    if (avg >= 90)
        return { label: 'Win the Premier League', target: 1 };
    if (avg >= 87)
        return { label: 'Finish in the top two', target: 2 };
    if (avg >= 84)
        return { label: 'Champions League, top four', target: 4 };
    if (avg >= 80)
        return { label: 'European places, top seven', target: 7 };
    if (avg >= 76)
        return { label: 'Top half finish', target: 10 };
    return { label: 'Avoid the relegation fight', target: 17 };
}
/**
 * The words for a target.
 *
 * Always derived from the final target, never from the unadjusted one. A
 * scenario shifts the number, and a board that says "top four" while
 * demanding ninth is the sort of thing that makes a game feel broken.
 */
export function objectiveLabel(target) {
    if (target <= 1)
        return 'Win the Premier League';
    if (target <= 2)
        return 'Finish in the top two';
    if (target <= 4)
        return 'Champions League, top four';
    if (target <= 7)
        return 'European places, top seven';
    if (target <= 10)
        return 'Top half finish';
    if (target <= 14)
        return 'Comfortable mid-table';
    return 'Avoid the relegation fight';
}
/**
 * The same objective, as a clause that reads inside a sentence.
 *
 * "You were asked to win the Premier League", not "to win the premier
 * league". Lower casing the label whole was doing that to every proper
 * noun in it, so the clause is written out rather than mangled.
 */
export function objectiveClause(target, division = 1) {
    if (division === 2)
        return 'win promotion';
    if (target <= 1)
        return 'win the Premier League';
    if (target <= 2)
        return 'finish in the top two';
    if (target <= 4)
        return 'finish in the Champions League places';
    if (target <= 7)
        return 'finish in the European places';
    if (target <= 10)
        return 'finish in the top half';
    if (target <= 14)
        return 'finish comfortably in mid-table';
    return 'stay out of the relegation fight';
}
/** What a finish is worth in transfer money next summer, in £m. */
export function budgetFor(finish) {
    return finish === 1
        ? 160
        : finish === 2
            ? 130
            : finish === 3
                ? 110
                : finish === 4
                    ? 95
                    : finish <= 7
                        ? 75
                        : finish <= 10
                            ? 58
                            : finish <= 14
                                ? 45
                                : finish <= 17
                                    ? 34
                                    : 25;
}
/**
 * How old a player was in his best season.
 *
 * A player shown at his peak rating has to be shown at the age he actually
 * was then. Schmeichel is 34 for the treble, Henry 25 for 2003/04. Using
 * one age for every era turns a squad of legends into a squad of twenty
 * year olds.
 */
export function primeAge(name) {
    const dob = DOB[name];
    if (!dob)
        return null;
    return Math.max(18, Math.min(37, dob[2] - dob[0] - dob[1]));
}
/**
 * Inherit a real club and its real squad.
 *
 * Every slot in the formation, then three substitutes, filled with the
 * best unused player at that position from that club's own squad, at his
 * prime rating and the age he was when he reached it. A slot with nobody
 * to fill it stays empty rather than being given a stranger.
 */
export function startCareer(args) {
    const { clubKey, scenario, mode, formation, seed } = args;
    const sc = scenarioById(scenario);
    const rnd = mulberry32(careerSeed(seed, 0));
    const arr = SQUADS[clubKey] ?? [];
    const bar = clubKey.lastIndexOf('|');
    const club = clubKey.slice(0, bar);
    const year = Number(clubKey.slice(bar + 1));
    const shape = FORMATIONS[formation] ?? FORMATIONS['4-3-3'];
    const slots = [];
    for (const row of shape.rows)
        for (const p of row)
            slots.push(p);
    // Three substitutes, one of each outfield line.
    slots.push('DEF', 'MID', 'ATT');
    const used = new Set();
    const roster = [];
    for (const pos of slots) {
        let best = -1;
        let bestRtg = -1;
        for (let i = 0; i < arr.length; i++) {
            if (used.has(i))
                continue;
            const p = arr[i];
            if (!p.pos || p.pos.indexOf(pos) < 0)
                continue;
            const v = p.prime || p.rtg;
            if (v > bestRtg) {
                best = i;
                bestRtg = v;
            }
        }
        if (best < 0) {
            roster.push(null);
            continue;
        }
        used.add(best);
        const p = arr[best];
        const rtg = p.prime || p.rtg;
        const age = primeAge(p.n) ?? ageIn(p.n, year, pos);
        roster.push(seedTracks({
            n: p.n,
            nat: p.nat ?? '',
            pos,
            club,
            season: `${year}/${String(year + 1).slice(2)}`,
            rtg,
            age,
            contract: { yrs: 2 + Math.floor(rnd() * 4), wage: wage(rtg, age) },
        }, rnd));
    }
    const filled = roster.filter((p) => p !== null);
    const avg = filled.length ? filled.reduce((s, p) => s + p.rtg, 0) / filled.length : 0;
    const target = Math.max(1, Math.min(20, objectiveFor(avg).target + sc.expect));
    return {
        seed,
        club,
        year: 1,
        formation,
        mode,
        scenario,
        roster,
        slots,
        retired: [],
        seasons: [],
        titles: 0,
        mgr: 55,
        budget: Math.round(budgetFor(target) * sc.budget),
        leash: sc.leash,
        objective: { label: objectiveLabel(target), target },
        capacity: CAPACITY[club] ?? 28000,
        fans: startingFans(CAPACITY[club] ?? 28000),
        /* Where the club was last season, before you took it. A giant is in
           the Champions League on the day you walk in; a minnow is in
           nothing. */
        europe: target <= 4 ? 'ucl' : target <= 6 ? 'uel' : target <= 8 ? 'uecl' : null,
        honours: {},
        division: 1,
        league: startingLeague(club),
        below: CHAMPIONSHIP.map((c) => ({ ...c })),
        parachute: 0,
        offers: [],
        jobs: [],
        autoLoan: false,
        /* Off to begin with. A manager who wants them can turn them on from
           the club screen. */
        injuriesOn: false,
        derby: { w: 0, d: 0, l: 0 },
        spells: [],
        lastCups: null,
        /* You have not won anything yet, so there is no Shield to play in. */
        shield: null,
        rival: RIVALS[club] ?? null,
        tactic: { ...EMPTY_TACTIC, form: formation },
        staff: { ...EMPTY_STAFF },
        infra: {
            stadium: 0,
            training: 2,
            academy: 2,
            capacity: CAPACITY[club] ?? 28000,
            retail: 1,
        },
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
/**
 * Lift or drop a whole squad to the level a club has reached.
 *
 * The nineteen other clubs drift across a career: one gets bought and
 * climbs, one rots and falls. That is their strength in the league, and
 * until now it was only a number. The squad the database holds for them
 * is the squad they had in 2026 and never changes, so joining a club that
 * had grown into a ninety eight handed over the eighty four they were
 * seventeen seasons ago.
 *
 * So the squad is brought to the club. Every player moves by the same
 * amount, which keeps the shape of the side, who its best player is and
 * where it is thin. Wages follow the new ratings, because a better squad
 * is a more expensive one and a club that has climbed pays for it.
 */
export function scaleSquadTo(d, target) {
    const xi = starters(d);
    if (!xi.length)
        return d;
    const now = squadRating(xi);
    const shift = Math.round(target - now);
    if (shift === 0)
        return d;
    const move = (p) => {
        const rtg = clamp(p.rtg + shift, 40, 99);
        return {
            ...p,
            rtg,
            phys: clamp(p.phys + shift, 40, 99),
            tech: clamp(p.tech + shift, 40, 99),
            ment: clamp(p.ment + shift, 40, 99),
            pot: clamp(Math.max(p.pot + shift, rtg), 40, 99),
            contract: { ...p.contract, wage: wage(rtg, p.age) },
        };
    };
    return {
        ...d,
        roster: d.roster.map((p) => (p ? move(p) : null)),
        youth: d.youth.map(move),
    };
}
/**
 * The club that goes with a squad of this quality.
 *
 * A side rated in the nineties has a training ground, an academy, a
 * backroom and a ground to match, because that is how it got there. The
 * facilities used to be whatever a 2026 career started with whoever you
 * joined, so a ninety eight rated club came with a two star everything
 * and a following of three million.
 */
export function clubAt(d, rating) {
    // Nought at 72 and one at 96, which is the range of a top flight club.
    const level = Math.max(0, Math.min(1, (rating - 72) / 24));
    const stars = (from, to) => Math.round(from + (to - from) * level);
    return {
        ...d,
        staff: {
            coach: stars(1, 5),
            medical: stars(1, 4),
            youth: stars(1, 4),
            setpiece: stars(1, 4),
            scout: stars(1, 4),
        },
        infra: {
            ...d.infra,
            training: stars(2, 5),
            academy: stars(2, 5),
            retail: stars(1, 4),
            capacity: Math.round(d.infra.capacity * (1 + level * 0.45)),
        },
        fans: Math.round(Math.min(FAN_CEIL, startingFans(d.infra.capacity) * (1 + level * 1.9)) * 100) / 100,
    };
}
/**
 * Take the job.
 *
 * A career belongs to the manager, so what you won stays with you: the
 * trophies, the seasons you have been at it, the clubs you have been at.
 * Everything that belongs to the club is left behind, because it does:
 * their squad, their money, their stadium, their following, their books.
 *
 * The seed moves with you so the new club is not a replay of somebody
 * else's season, and the objective is the one they set out in the offer.
 */
function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
}
export function takeJob(d, offer) {
    const option = clubOptions(2026).find((o) => o.club === offer.club);
    if (!option)
        return null;
    const fresh = startCareer({
        clubKey: option.key,
        scenario: d.scenario,
        mode: d.mode,
        formation: d.tactic.form,
        seed: (d.seed ^ Math.imul(d.year + 1, 0x27d4eb2d)) >>> 0,
    });
    // What this manager did at the club he is leaving.
    const spell = {
        club: d.club,
        from: d.spells.reduce((a, s) => a + s.seasons, 1),
        to: d.spells.reduce((a, s) => a + s.seasons, 0) + d.seasons.length,
        seasons: d.seasons.length,
        titles: d.titles,
        cups: Object.values(d.honours ?? {}).reduce((a, n) => a + n, 0),
        best: d.seasons.length ? Math.min(...d.seasons.map((s) => s.fin)) : 20,
    };
    /* The club is whatever it has become, not whatever it was in 2026, so
       the squad in the offer is the squad that arrives. */
    const rating = offer.rating ?? option.avg;
    const lifted = scaleSquadTo(fresh, rating);
    /* Which division you are joining. The offers come out of the division
       you are in, so it is that one, and it used to be hard coded to the
       top flight: a manager relegated in May and hired in June carried
       nineteen second tier clubs into a season the game insisted was the
       Premier League, with a board asking him to win it. */
    const division = offer.division === 2 ? 2 : 1;
    const target = division === 2 ? 2 : clamp(objectiveFor(rating).target, 1, 20);
    /* And a club that has climbed has built. A side rated in the nineties
       did not get there with a two star training ground, an empty academy
       and thirty thousand seats, so everything off the pitch is brought up
       to the level too. */
    const built = clubAt(lifted, rating);
    /* The league comes with you.
       It used to be rebuilt from the 2026 defaults, so seventeen seasons of
       clubs rising and falling were thrown away the moment you changed job:
       an Arsenal you had left rated eighty came back the next season at
       ninety five because that is what the book says they are.
  
       So the division you were in carries over, the club you are joining
       comes out of it because you cannot play yourself, and the club you
       have just left goes in at the strength of the squad you left behind. */
    /* Only if you are staying in the same division. Moving between them
       means a different set of clubs entirely, so the one you are joining
       is built fresh. */
    const carried = (division !== d.division ? divisionFor(division, offer.club) : d.league)
        .filter((c) => c.name !== offer.club)
        .concat([
        ...(division === d.division
            ? [
                {
                    name: d.club,
                    str: ratingStrength(squadRating(starters(d))),
                    var: 0.09,
                },
            ]
            : []),
    ])
        .filter((c, i, all) => all.findIndex((x) => x.name === c.name) === i);
    /* Exactly nineteen, always. When the club you are joining was not one of
       your nineteen there is one too many, and when something has been
       deduplicated there is one too few, so the list is topped up from the
       default division rather than thrown away: giving up on the whole thing
       is what put a club you had left rated eighty back at ninety five. */
    for (const c of divisionFor(division, offer.club)) {
        if (carried.length >= 19)
            break;
        if (carried.some((x) => x.name === c.name) || c.name === d.club)
            continue;
        carried.push({ ...c });
    }
    carried.sort((a, b) => b.str - a.str);
    const nineteen = carried.slice(0, 19);
    const mustKeep = carried.find((c) => c.name === d.club);
    if (mustKeep && !nineteen.some((c) => c.name === d.club)) {
        nineteen[nineteen.length - 1] = mustKeep;
    }
    return {
        ...built,
        league: nineteen.length === 19 ? nineteen : divisionFor(division, offer.club),
        below: d.below.map((c) => ({ ...c })),
        division,
        /* The manager's record, which is his and not the club's. */
        spells: [...d.spells, spell],
        honours: { ...(d.honours ?? {}) },
        titles: d.titles,
        year: d.year,
        /* A new board that has just hired you starts you well thought of. */
        mgr: 62,
        objective: {
            label: division === 2 ? 'Win promotion' : objectiveLabel(target),
            target,
        },
        budget: offer.budget,
    };
}
/**
 * How big a club is, on a scale of nought to a hundred.
 *
 * Not how good this year's team is. How big the club is: how many people
 * follow it, what it has won under you, how many it holds, and the best
 * it has managed lately. Those are the things a boardroom actually
 * measures itself by, and they are why Arsenal and Luton are not asked
 * the same question even in a season where their squads are level.
 *
 * It moves. A club that wins things gains supporters, and a club that
 * keeps finishing fourth is expected to finish fourth, so a side climbing
 * out of nothing is asked for more every year without anybody rewriting
 * the rule.
 */
export function stature(d) {
    // The following is the loudest signal, because it is the one that grows.
    const support = Math.min(46, ((d.fans ?? 2.5) / 12) * 46);
    // What has been won here.
    const cups = Object.values(d.honours ?? {}).reduce((a, n) => a + n, 0);
    const silverware = Math.min(24, d.titles * 6 + cups * 2);
    // The size of the place.
    const ground = Math.min(14, ((d.infra?.capacity ?? 30000) / 62000) * 14);
    // And what the club has actually been doing.
    const recent = d.seasons.slice(-5);
    const form = recent.length
        ? Math.min(16, (recent.reduce((a, s) => a + Math.max(0, 21 - s.fin), 0) / recent.length) * 0.9)
        : 6;
    return Math.round(Math.max(0, Math.min(100, support + silverware + ground + form)));
}
/**
 * The worst finish a club of this size will accept.
 *
 * A hard floor rather than an average, because that is what it is. Arsenal
 * do not ask their manager to avoid relegation whatever the squad looks
 * like, and no amount of a bad season makes them.
 */
export function statureFloor(s) {
    if (s >= 90)
        return 4;
    if (s >= 80)
        return 6;
    if (s >= 70)
        return 9;
    if (s >= 58)
        return 12;
    if (s >= 46)
        return 15;
    return 18;
}
/**
 * What the board will ask for next season.
 *
 * Three things, in the order a boardroom weighs them. What you have been
 * delivering, because last season is the number everybody in the building
 * remembers. What the squad is actually worth, because they are not
 * completely unreasonable. And the size of the club, which sets a floor
 * neither of the other two can push through.
 *
 * The floor is what was missing. The target used to come from the squad
 * rating alone, so Arsenal with seven titles, twelve million supporters
 * and a squad that had been allowed to slide were asked to avoid
 * relegation, and were then pleased with ninth.
 */
export function boardTarget(d, avg, expect) {
    const fromSquad = objectiveFor(avg).target + expect;
    /* What you have been doing lately, and they always want a little more
       of it. Three seasons, because one is luck and five is history. */
    const recent = d.seasons.slice(-3);
    const fromForm = recent.length
        ? Math.round(recent.reduce((a, s) => a + s.fin, 0) / recent.length) - 1
        : fromSquad;
    const blended = Math.round(fromSquad * 0.45 + fromForm * 0.55);
    const floor = statureFloor(stature(d));
    return Math.max(1, Math.min(20, Math.min(blended, floor)));
}
