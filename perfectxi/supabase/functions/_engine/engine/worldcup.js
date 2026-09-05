import { WC_GROUPS, WC_SQUADS, WC_TEAMS } from '../data/worldcup.js';
import { dcExpected, poissonR, strFromAvg } from './sim.js';
import { mulberry32 } from './rng.js';
export const STAGE_NAME = {
    group: 'Group Stage',
    r32: 'Round of 32',
    r16: 'Round of 16',
    qf: 'Quarter-Final',
    sf: 'Semi-Final',
    final: 'Final',
    done: 'Over',
};
/** The knockout rounds, in order, which is also the order of the bracket. */
export const KNOCKOUTS = ['r32', 'r16', 'qf', 'sf', 'final'];
/* ---------- the nations ---------- */
export function wcTeam(code) {
    return WC_TEAMS[code];
}
export function wcSquad(code) {
    return WC_SQUADS[code] ?? [];
}
/** Every nation, strongest first, for the screen that picks one. */
export function wcNations() {
    return Object.keys(WC_TEAMS)
        .map((code) => {
        const t = WC_TEAMS[code];
        return { code, name: t.n, flag: t.f, rating: t.r, group: t.g, conf: t.c };
    })
        .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
}
/**
 * The weakest nation at the tournament.
 *
 * A drafted XI has to take somebody's place, because there are forty eight
 * and there is no forty ninth. It takes the weakest one, so the draft
 * never turns into a second decision about which nation to displace and
 * never lets a player quietly hand themselves an easy group by picking a
 * seat rather than a side.
 */
export function wcWeakest() {
    const all = wcNations();
    return all[all.length - 1]?.code ?? Object.keys(WC_TEAMS)[0];
}
/** The four in a group, in the order the draw put them. */
export function groupOf(letter) {
    return Object.keys(WC_TEAMS).filter((c) => WC_TEAMS[c].g === letter);
}
/** Your rating, which is your XI's when you drafted one. */
export function ratingIn(run, code) {
    if (code === run.you && run.custom)
        return run.custom.rating;
    return WC_TEAMS[code]?.r ?? 70;
}
/** Your squad, which is your eleven when you drafted them. */
export function squadIn(run, code) {
    if (code === run.you && run.custom)
        return run.custom.squad;
    return wcSquad(code);
}
/** What goes on the scoreboard. */
export function nameIn(run, code) {
    if (code === run.you && run.custom)
        return run.custom.name;
    return WC_TEAMS[code]?.n ?? code;
}
export function flagIn(run, code) {
    if (code === run.you && run.custom)
        return run.custom.flag;
    return WC_TEAMS[code]?.f ?? '';
}
/* ---------- one match ---------- */
/**
 * Ninety minutes, and then whatever a knockout needs.
 *
 * The goals come off the same Dixon-Coles expectation and the same
 * Poisson draw the league uses, so a World Cup match and a Premier
 * League match are the same football. Neutral ground everywhere, because
 * they are neutral grounds: nobody gets the home edge.
 */
export function playMatch(a, b, knockout, rnd, 
/** overrides, for a side that was drafted rather than drawn */
ra, rb) {
    const sa = strFromAvg(typeof ra === 'number' ? ra : (WC_TEAMS[a]?.r ?? 70));
    const sb = strFromAvg(typeof rb === 'number' ? rb : (WC_TEAMS[b]?.r ?? 70));
    const { lam, mu } = dcExpected(sa, sb, 'neutral', null);
    let ga = poissonR(lam, rnd);
    let gb = poissonR(mu, rnd);
    const ga90 = ga;
    const gb90 = gb;
    if (!knockout || ga !== gb) {
        return { ga, gb, pens: null, ga90, gb90, et: false };
    }
    /* Extra time. Thirty minutes is a third of a match, and it settles it
       about a third of the time, which is roughly what happens. */
    const ea = poissonR(lam / 3, rnd);
    const eb = poissonR(mu / 3, rnd);
    ga += ea;
    gb += eb;
    if (ga !== gb)
        return { ga, gb, pens: null, ga90, gb90, et: true };
    /* Penalties. Close to a coin toss, tilted a little by who is better,
       because that is about as far as anybody has ever shown it goes. */
    const edge = 0.5 + (sa - sb) * 0.35;
    let pa = 0;
    let pb = 0;
    for (let i = 0; i < 5; i++) {
        if (rnd() < 0.76 + edge * 0.06)
            pa++;
        if (rnd() < 0.76 - edge * 0.06 + 0.06)
            pb++;
    }
    let guard = 0;
    while (pa === pb && guard++ < 20) {
        const ha = rnd() < 0.74 + edge * 0.06;
        const hb = rnd() < 0.74 - edge * 0.06 + 0.06;
        if (ha)
            pa++;
        if (hb)
            pb++;
    }
    if (pa === pb)
        pa++;
    return { ga, gb, pens: { a: pa, b: pb }, ga90, gb90, et: true };
}
/* ---------- who scored ---------- */
/**
 * Spread a scoreline across a squad.
 *
 * Weighted by position and by rating, so a ninety rated forward scores
 * far more than a full back and a goalkeeper never does. Assists go to
 * somebody else, which is why a one nil is one goal and at most one
 * assist rather than always both.
 */
export function shareGoals(squad, goals, rnd) {
    const out = [];
    const weight = (p) => {
        const pos = p.pos[0] ?? 'MID';
        const base = pos === 'ATT' ? 10 : pos === 'MID' ? 4 : pos === 'DEF' ? 1 : 0;
        return base * Math.pow(Math.max(1, p.rtg - 60) / 20, 2);
    };
    const pool = squad.filter((p) => weight(p) > 0);
    const total = pool.reduce((s, p) => s + weight(p), 0);
    if (!pool.length || total <= 0)
        return out;
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
        /* Two in three goals are made by somebody, which is about the real
           share once penalties and rebounds are taken out. */
        let assist = null;
        if (rnd() < 0.66) {
            const others = pool.filter((p) => p.n !== scorer.n);
            if (others.length)
                assist = others[Math.floor(rnd() * others.length)].n;
        }
        out.push({ scorer: scorer.n, assist });
    }
    return out;
}
/* ---------- the group ---------- */
/** The six fixtures of a group of four, in the order they are played. */
function groupFixtures(letter) {
    const [a, b, c, d] = groupOf(letter);
    return [
        [a, b],
        [c, d],
        [a, c],
        [b, d],
        [a, d],
        [b, c],
    ];
}
function emptyRow(code) {
    return { code, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
}
function applyResult(rows, a, b, ga, gb) {
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
    }
    else if (gb > ga) {
        rb.w++;
        ra.l++;
        rb.pts += 3;
    }
    else {
        ra.d++;
        rb.d++;
        ra.pts++;
        rb.pts++;
    }
    rows.set(a, ra);
    rows.set(b, rb);
}
/** Points, then goal difference, then goals scored, then the name. */
export function sortRows(rows) {
    return [...rows].sort((x, y) => y.pts - x.pts ||
        y.gf - y.ga - (x.gf - x.ga) ||
        y.gf - x.gf ||
        (WC_TEAMS[x.code]?.n ?? '').localeCompare(WC_TEAMS[y.code]?.n ?? ''));
}
/** A whole group played out, for the eleven you are not in. */
function playGroup(letter, rnd) {
    const rows = new Map();
    for (const code of groupOf(letter))
        rows.set(code, emptyRow(code));
    for (const [a, b] of groupFixtures(letter)) {
        const r = playMatch(a, b, false, rnd);
        applyResult(rows, a, b, r.ga, r.gb);
    }
    return sortRows([...rows.values()]);
}
/* ---------- starting one ---------- */
/**
 * Your three group games, in the order the fixture list has them.
 *
 * Always written with you first, because every screen that draws a
 * fixture wants to know which side is yours without having to work it
 * out, and a group game has no home team anyway.
 */
function yourGroupGames(you) {
    const letter = WC_TEAMS[you]?.g ?? 'A';
    const out = [];
    let n = 0;
    for (const [a, b] of groupFixtures(letter)) {
        if (a !== you && b !== you)
            continue;
        out.push({
            stage: 'group',
            n: n++,
            a: you,
            b: a === you ? b : a,
            ga: 0,
            gb: 0,
            pens: null,
            played: false,
            group: letter,
        });
    }
    return out;
}
export function wcStart(you, seed, custom) {
    const letter = WC_TEAMS[you]?.g ?? 'A';
    return {
        seed: seed >>> 0,
        you,
        stage: 'group',
        played: [],
        ahead: yourGroupGames(you),
        table: sortRows(groupOf(letter).map(emptyRow)),
        bracket: [],
        squad: {},
        cleanSheets: 0,
        over: false,
        outAt: null,
        won: false,
        world: [],
        custom: custom ?? null,
    };
}
/* ---------- playing the next one ---------- */
/**
 * The generator for a given match.
 *
 * Derived from the seed and how many matches have been played, so the
 * seventh match of a run is the seventh match of that run however many
 * times it is worked out, and closing the app between two of them
 * changes nothing.
 */
function rngFor(run, n) {
    return mulberry32((run.seed ^ Math.imul(n + 1, 0x9e3779b9)) >>> 0);
}
/**
 * Play one match and nothing else.
 *
 * Everything that has to happen because of it happens here too: the
 * table moves, the bracket is drawn the moment your group is finished,
 * and being knocked out ends the run rather than leaving a fixture list
 * pointing at nothing.
 */
export function wcPlayNext(run) {
    if (run.over || !run.ahead.length)
        return null;
    const fixture = run.ahead[0];
    const rnd = rngFor(run, run.played.length);
    const knockout = fixture.stage !== 'group';
    const r = playMatch(fixture.a, fixture.b, knockout, rnd, ratingIn(run, fixture.a), ratingIn(run, fixture.b));
    const match = {
        ...fixture,
        ga: r.ga,
        gb: r.gb,
        pens: r.pens,
        ga90: r.ga90,
        gb90: r.gb90,
        et: r.et,
        played: true,
    };
    const scorers = shareGoals(squadIn(run, run.you), r.ga, rnd);
    const squad = { ...run.squad };
    for (const s of scorers) {
        const g = squad[s.scorer] ?? { g: 0, a: 0 };
        squad[s.scorer] = { g: g.g + 1, a: g.a };
        if (s.assist) {
            const a = squad[s.assist] ?? { g: 0, a: 0 };
            squad[s.assist] = { g: a.g, a: a.a + 1 };
        }
    }
    let next = {
        ...run,
        played: [...run.played, match],
        ahead: run.ahead.slice(1),
        squad,
        cleanSheets: run.cleanSheets + (r.gb === 0 ? 1 : 0),
    };
    if (fixture.stage === 'group') {
        next = afterGroupMatch(next, match, rnd);
    }
    else {
        next = afterKnockout(next, match, rnd);
    }
    return { run: next, match, scorers };
}
function afterGroupMatch(run, match, rnd) {
    const rows = new Map();
    for (const r of run.table)
        rows.set(r.code, { ...r });
    applyResult(rows, match.a, match.b, match.ga, match.gb);
    /* The other game of the same matchday.
    
       A group of four plays two fixtures a matchday, and the fixture list
       is built in matchday order, so the pair for matchday k sits at k*2
       and k*2+1. One of them is yours and the other is played here. It
       used to look for any unplayed fixture and compare one team's games
       to the number you had played, which left the table reading 3, 3, 4,
       2 after everybody should have played three. */
    const letter = match.group ?? WC_TEAMS[run.you].g;
    const fixtures = groupFixtures(letter);
    const matchday = run.played.length - 1;
    for (const [a, b] of [fixtures[matchday * 2], fixtures[matchday * 2 + 1]]) {
        if (!a || !b)
            continue;
        if (a === run.you || b === run.you)
            continue;
        const r = playMatch(a, b, false, rnd);
        applyResult(rows, a, b, r.ga, r.gb);
    }
    const table = sortRows([...rows.values()]);
    if (run.played.length < 3)
        return { ...run, table };
    /* The group is over. Everything else in the world catches up, and the
       bracket exists from here on. */
    return drawBracket({ ...run, table });
}
/* ---------- the bracket ---------- */
/**
 * The thirty two, and the order they meet in.
 *
 * The real draw pairs named group positions in a fixed pattern that only
 * makes sense with the real fixture list in front of you. This seeds the
 * qualifiers instead: group winners first, then runners up, then the
 * eight best thirds, each block in order of what they did, and pairs the
 * first with the last the way every seeded bracket has ever worked.
 *
 * It gives the same thing the real one is trying to give, which is that
 * winning your group is worth something and scraping through as a third
 * place is not.
 */
function drawBracket(run) {
    const rnd = mulberry32((run.seed ^ 0x5f356495) >>> 0);
    const others = {};
    const mine = WC_TEAMS[run.you].g;
    for (const letter of WC_GROUPS) {
        others[letter] = letter === mine ? run.table : playGroup(letter, rnd);
    }
    const firsts = [];
    const seconds = [];
    const thirds = [];
    for (const letter of WC_GROUPS) {
        const rows = others[letter];
        if (rows[0])
            firsts.push(rows[0]);
        if (rows[1])
            seconds.push(rows[1]);
        if (rows[2])
            thirds.push(rows[2]);
    }
    const rank = (rows) => sortRows(rows);
    const bestThirds = rank(thirds).slice(0, 8);
    const seeded = [...rank(firsts), ...rank(seconds), ...bestThirds].map((r) => r.code);
    const through = seeded.includes(run.you);
    if (!through) {
        return {
            ...run,
            bracket: seeded,
            stage: 'done',
            ahead: [],
            over: true,
            outAt: 'group',
            world: worldAwards(run.seed, seeded),
        };
    }
    const first = knockoutFixture(seeded, run.you, 'r32');
    return {
        ...run,
        bracket: seeded,
        stage: 'r32',
        ahead: first ? [first] : [],
        world: worldAwards(run.seed, seeded),
    };
}
/** Who you meet in a round, given who is left and where you sit. */
function knockoutFixture(order, you, stage) {
    const at = order.indexOf(you);
    if (at < 0)
        return null;
    const other = order.length - 1 - at;
    const opp = order[other];
    if (!opp || opp === you)
        return null;
    return {
        stage,
        n: Math.min(at, other),
        a: you,
        b: opp,
        ga: 0,
        gb: 0,
        pens: null,
        played: false,
    };
}
/**
 * What a knockout result does.
 *
 * Losing ends it. Winning halves the bracket, which is done by keeping
 * the seeded order and dropping everybody who cannot still be in it: the
 * survivors of a seeded bracket are exactly the winners of each pairing,
 * and they are decided here for the whole round rather than only for
 * your own tie, because the next opponent has to be a real one.
 */
function afterKnockout(run, match, rnd) {
    const won = match.pens ? match.pens.a > match.pens.b : match.ga > match.gb;
    if (!won) {
        return { ...run, stage: 'done', ahead: [], over: true, outAt: match.stage, won: false };
    }
    if (match.stage === 'final') {
        return { ...run, stage: 'done', ahead: [], over: true, outAt: 'final', won: true };
    }
    /* Everybody else's tie in this round, so the half that survives is a
       real half rather than a guess. */
    const order = run.bracket;
    const next = [];
    for (let i = 0; i < order.length / 2; i++) {
        const a = order[i];
        const b = order[order.length - 1 - i];
        if (a === run.you || b === run.you) {
            next.push(run.you);
            continue;
        }
        const r = playMatch(a, b, true, rnd);
        const aWon = r.pens ? r.pens.a > r.pens.b : r.ga > r.gb;
        next.push(aWon ? a : b);
    }
    const stage = KNOCKOUTS[KNOCKOUTS.indexOf(match.stage) + 1] ?? 'final';
    const fixture = knockoutFixture(next, run.you, stage);
    return {
        ...run,
        bracket: next,
        stage,
        ahead: fixture ? [fixture] : [],
    };
}
/* ---------- the awards everybody is playing for ---------- */
/**
 * The Golden Boot and the Golden Glove, contested by the whole world.
 *
 * Every other nation gets a tournament of its own: how far it went, and
 * therefore how many matches its forward had to score in. It is worked
 * out once, when the groups finish, because it only has to be right at
 * the end and simulating forty seven full tournaments a match would be
 * absurd.
 */
function worldAwards(seed, qualified) {
    const rnd = mulberry32((seed ^ 0x27d4eb2d) >>> 0);
    const out = [];
    for (const code of Object.keys(WC_TEAMS)) {
        const team = WC_TEAMS[code];
        const squad = wcSquad(code);
        const at = qualified.indexOf(code);
        /* How far they got: a top seed plays more matches than a nation that
           went out in the groups, and a nation that did not qualify played
           three. */
        const rounds = at < 0 ? 3 : at < 2 ? 3 + 5 : at < 4 ? 3 + 4 : at < 8 ? 3 + 3 : at < 16 ? 3 + 2 : 3 + 1;
        const forwards = squad
            .filter((p) => (p.pos[0] ?? '') === 'ATT')
            .sort((a, b) => b.rtg - a.rtg);
        const keeper = squad.filter((p) => (p.pos[0] ?? '') === 'GK').sort((a, b) => b.rtg - a.rtg)[0];
        const best = forwards[0];
        if (best) {
            /* A tournament's leading scorer is on about a goal every other
               game, and the best of them a little more. */
            const rate = 0.34 + Math.max(0, best.rtg - 78) * 0.028;
            let goals = 0;
            for (let i = 0; i < rounds; i++)
                if (rnd() < rate)
                    goals += 1 + (rnd() < 0.22 ? 1 : 0);
            out.push({
                code,
                n: best.n,
                goals,
                keeper: keeper?.n ?? '',
                cleanSheets: 0,
            });
        }
        const row = out[out.length - 1];
        if (row && keeper) {
            const rate = 0.2 + Math.max(0, (team.r - 70)) * 0.014;
            let cs = 0;
            for (let i = 0; i < rounds; i++)
                if (rnd() < rate)
                    cs++;
            row.cleanSheets = cs;
        }
    }
    return out;
}
/** Who wins the Golden Boot, once your own goals are counted in. */
export function goldenBoot(run) {
    const mine = Object.entries(run.squad)
        .map(([n, s]) => ({ n, code: run.you, goals: s.g }))
        .sort((a, b) => b.goals - a.goals)[0];
    const world = [...run.world].sort((a, b) => b.goals - a.goals)[0];
    if (mine && world)
        return mine.goals >= world.goals ? mine : { n: world.n, code: world.code, goals: world.goals };
    if (mine)
        return mine;
    return world
        ? { n: world.n, code: world.code, goals: world.goals }
        : { n: '', code: '', goals: 0 };
}
export function goldenGlove(run) {
    const keeper = squadIn(run, run.you)
        .filter((p) => (p.pos[0] ?? '') === 'GK')
        .sort((a, b) => b.rtg - a.rtg)[0];
    const mine = keeper
        ? { n: keeper.n, code: run.you, cleanSheets: run.cleanSheets }
        : null;
    const world = [...run.world].sort((a, b) => b.cleanSheets - a.cleanSheets)[0];
    if (mine && world) {
        return mine.cleanSheets >= world.cleanSheets
            ? mine
            : { n: world.keeper, code: world.code, cleanSheets: world.cleanSheets };
    }
    if (mine)
        return mine;
    return world
        ? { n: world.keeper, code: world.code, cleanSheets: world.cleanSheets }
        : { n: '', code: '', cleanSheets: 0 };
}
/* ---------- what it added up to ---------- */
/** How far a nation of that rating ought to get. */
export function wcExpected(rating) {
    /* Measured against what the tournament actually does rather than
       against what a fan would say. Forty two in a hundred runs end in the
       group and three in a hundred end in the final, so expecting a very
       good side to reach the final made almost everybody a failure. These
       thresholds put roughly a third over, a third level and a third
       under, which is what makes a badge on the report worth having. */
    if (rating >= 87)
        return 'sf';
    if (rating >= 83)
        return 'qf';
    if (rating >= 79)
        return 'r16';
    if (rating >= 74)
        return 'r32';
    return 'group';
}
const ORDER = ['group', 'r32', 'r16', 'qf', 'sf', 'final'];
/** Better, level or worse than a nation that good should have managed. */
export function wcVerdict(run) {
    const want = ORDER.indexOf(wcExpected(ratingIn(run, run.you)));
    const got = run.won ? ORDER.length : ORDER.indexOf(run.outAt ?? 'group');
    if (got > want)
        return 'over';
    if (got < want)
        return 'under';
    return 'met';
}
/** The whole run, as numbers. */
export function wcSummary(run) {
    let w = 0;
    let d = 0;
    let l = 0;
    let gf = 0;
    let ga = 0;
    let best = 0;
    for (const m of run.played) {
        gf += m.ga;
        ga += m.gb;
        const won = m.pens ? m.pens.a > m.pens.b : m.ga > m.gb;
        const lost = m.pens ? m.pens.a < m.pens.b : m.ga < m.gb;
        if (m.ga === m.gb && m.pens)
            d++;
        else if (won)
            w++;
        else if (lost)
            l++;
        else
            d++;
        best = Math.max(best, m.ga - m.gb);
    }
    return { w, d, l, gf, ga, cleanSheets: run.cleanSheets, best, played: run.played.length };
}
/** Your own scorers, best first. */
export function wcScorers(run) {
    return Object.entries(run.squad)
        .map(([n, s]) => ({ n, g: s.g, a: s.a }))
        .sort((x, y) => y.g - x.g || y.a - x.a || x.n.localeCompare(y.n));
}
