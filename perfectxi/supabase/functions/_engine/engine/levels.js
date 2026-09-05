/**
 * Levels, and what they are allowed to give you.
 *
 * One rule decides everything else in this file: a level never changes
 * how the game plays. Not a formation, not an era, not a reroll, not a
 * rating you can see that somebody else cannot. Perfect XI is free, has
 * no adverts and sells nothing, and the whole point of the Daily and of
 * a duel is that two people are playing the identical puzzle. A reward
 * that touched any of that would quietly make the game about how long
 * you have owned it.
 *
 * So a level gives coins, and it gives things to look at: a frame for a
 * card, a pitch to play the draft on, a title beside your name where
 * another player can see it. Nothing on that list can win anybody a
 * match, and everything on it is real: nothing is listed here that the
 * app does not actually draw.
 *
 * The curve is built backwards from what a season actually pays. A
 * season is worth about four hundred and forty experience and a title
 * season about eight hundred, so:
 *
 *   level 2      one season
 *   level 5      about six
 *   level 10     about twenty
 *   level 20     about sixty five
 *   level 50     a long time, and it is meant to be
 */
export const MAX_LEVEL = 50;
/**
 * The experience needed to have reached a level.
 *
 * Level one is nought, and every level after it costs more than the last
 * without ever becoming a wall: the gap from forty nine to fifty is
 * about eleven seasons, not a hundred.
 */
export function xpToReach(level) {
    const n = Math.max(1, Math.min(MAX_LEVEL, Math.round(level)));
    if (n <= 1)
        return 0;
    return Math.round(220 * Math.pow(n - 1, 1.7));
}
/** What level a given amount of experience is. */
export function levelFor(xp) {
    const x = Math.max(0, xp);
    let lvl = 1;
    while (lvl < MAX_LEVEL && x >= xpToReach(lvl + 1))
        lvl++;
    return lvl;
}
export function levelProgress(xp) {
    const level = levelFor(xp);
    if (level >= MAX_LEVEL) {
        return { level: MAX_LEVEL, into: 0, span: 0, frac: 1, toNext: 0, maxed: true };
    }
    const base = xpToReach(level);
    const next = xpToReach(level + 1);
    const span = Math.max(1, next - base);
    const into = Math.max(0, Math.min(span, xp - base));
    return {
        level,
        into,
        span,
        frac: into / span,
        toNext: Math.max(0, next - xp),
        maxed: false,
    };
}
/**
 * Every level pays coins, and one in two or so gives something to keep.
 *
 * The coins climb with the level because the seasons behind each one are
 * longer, and because a shop with nothing affordable in it is not a
 * shop. Reaching level twenty pays for a Gold pack on its own.
 */
export function coinsForLevel(level) {
    return 60 + Math.round(Math.pow(Math.max(0, level - 1), 1.35) * 22);
}
/** The things a level can hand over, in the order they are reached. */
const KEEPSAKES = [
    { level: 2, kind: 'frame', id: 'frame.slate', name: 'The Slate card frame' },
    { level: 3, kind: 'pack', id: 'pack.bronze', name: 'A Bronze Pack' },
    { level: 4, kind: 'title', id: 'title.hopeful', name: 'The title Hopeful' },
    { level: 5, kind: 'pitch', id: 'pitch.floodlit', name: 'The Floodlit pitch' },
    { level: 6, kind: 'frame', id: 'frame.copper', name: 'The Copper card frame' },
    { level: 8, kind: 'title', id: 'title.gaffer', name: 'The title Gaffer' },
    { level: 9, kind: 'pack', id: 'pack.silver', name: 'A Silver Pack' },
    { level: 11, kind: 'pitch', id: 'pitch.frost', name: 'The Frost pitch' },
    { level: 13, kind: 'frame', id: 'frame.chalk', name: 'The Chalk card frame' },
    { level: 15, kind: 'title', id: 'title.tactician', name: 'The title Tactician' },
    { level: 17, kind: 'pack', id: 'pack.gold', name: 'A Gold Pack' },
    { level: 19, kind: 'pitch', id: 'pitch.wembley', name: 'The Wembley pitch' },
    { level: 22, kind: 'frame', id: 'frame.gold', name: 'The Gold card frame' },
    { level: 25, kind: 'title', id: 'title.mastermind', name: 'The title Mastermind' },
    { level: 28, kind: 'pack', id: 'pack.gold', name: 'A Gold Pack' },
    { level: 30, kind: 'pitch', id: 'pitch.classic', name: 'The Nineties pitch' },
    { level: 33, kind: 'frame', id: 'frame.neon', name: 'The Neon card frame' },
    { level: 36, kind: 'title', id: 'title.legend', name: 'The title Legend' },
    { level: 40, kind: 'pack', id: 'pack.icon', name: 'An Icon Pack' },
    { level: 43, kind: 'pitch', id: 'pitch.night', name: 'The Midnight pitch' },
    { level: 46, kind: 'frame', id: 'frame.icon', name: 'The Icon card frame' },
    { level: 48, kind: 'title', id: 'title.immortal', name: 'The title Immortal' },
    { level: 50, kind: 'frame', id: 'frame.perfect', name: 'The Perfect XI frame' },
];
/** What arrives on reaching this level. Always coins, sometimes more. */
export function rewardsFor(level) {
    const out = [];
    const coins = coinsForLevel(level);
    out.push({ level, kind: 'coins', id: 'coins', name: `${coins} coins`, coins });
    for (const k of KEEPSAKES) {
        if (k.level === level)
            out.push({ ...k, coins: 0 });
    }
    return out;
}
/** Everything between two levels, for the moment a season pushes you up. */
export function rewardsBetween(from, to) {
    const out = [];
    for (let l = from + 1; l <= Math.min(MAX_LEVEL, to); l++)
        out.push(...rewardsFor(l));
    return out;
}
/** The next thing worth having, so a level bar has a reason on it. */
export function nextKeepsake(level) {
    for (const k of KEEPSAKES) {
        if (k.level > level)
            return { level: k.level, name: k.name };
    }
    return null;
}
/** Every keepsake, for the page that lists what there is to reach. */
export function allKeepsakes() {
    return KEEPSAKES;
}
/**
 * What a season is worth.
 *
 * Kept here rather than on the screen that awards it, so that the curve
 * above and the thing that feeds it cannot drift apart, and so a check
 * can ask how long a level actually takes.
 */
export function seasonXp(pts, position) {
    return (140 +
        pts * 3 +
        (position === 1 ? 400 : position <= 4 ? 180 : position <= 10 ? 60 : 0));
}
export function seasonCoins(pts, position) {
    return 30 + Math.round(pts / 2) + (position === 1 ? 120 : position <= 4 ? 45 : 0);
}
