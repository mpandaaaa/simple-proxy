import { defaultConfig } from './types.js';
/**
 * The Daily.
 *
 * One puzzle a day, the same one for everybody in the world, and one
 * attempt at it. That is the whole shape of the app: the front door is
 * today, and the games are the content.
 *
 * Everything here is derived from the date and nothing else, so two
 * phones on opposite sides of the world hand back an identical board
 * without ever speaking to each other or to a server. It is the same
 * property that lets a run be replayed to check it, which is what an
 * online leaderboard will need later.
 *
 * The day boundary is UTC. A day that started when your phone said so
 * would give somebody in Auckland a different puzzle from somebody in
 * Los Angeles, and then it would not be the same puzzle for everybody.
 */
/** Daily number one. The first puzzle of the app. */
export const DAILY_EPOCH = Date.UTC(2026, 0, 1);
const DAY = 86400000;
/** Which puzzle a moment in time belongs to. Number one is 1 January 2026. */
export function dailyNumber(now = Date.now()) {
    return Math.floor((now - DAILY_EPOCH) / DAY) + 1;
}
/** When the next one opens, so a screen can count down to it. */
export function nextDailyAt(now = Date.now()) {
    return DAILY_EPOCH + dailyNumber(now) * DAY;
}
/** How long until then, in whole seconds. */
export function untilNextDaily(now = Date.now()) {
    return Math.max(0, Math.round((nextDailyAt(now) - now) / 1000));
}
/** The date a puzzle belongs to, for a screen that wants to write it out. */
export function dailyDate(n) {
    return new Date(DAILY_EPOCH + (n - 1) * DAY);
}
/**
 * A seed from a puzzle number.
 *
 * Hashed rather than used raw, so puzzle 101 has nothing in common with
 * puzzle 102 and nobody can guess tomorrow from today.
 */
export function dailySeed(n) {
    let h = (n ^ 0x9e3779b9) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x21f0aaad) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x735a2d97) >>> 0;
    return (h ^ (h >>> 15)) >>> 0;
}
/** A small deterministic generator of its own, so the config never moves. */
function stream(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/**
 * The shapes a Daily is played in.
 *
 * Not all twelve formations. These are the ones that make a different
 * puzzle rather than a slightly different one, and a five at the back
 * asks a genuinely different question of the same board from a 4-2-4.
 */
const DAILY_SHAPES = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '4-2-4', '5-3-2', '4-1-4-1'];
export const DAILY_ERAS = [
    { from: 1992, to: 2026, name: 'All time', note: 'Every season in the database' },
    { from: 1992, to: 1999, name: 'The nineties', note: 'Cantona, Shearer, Bergkamp' },
    { from: 2000, to: 2009, name: 'The 2000s', note: 'The Invincibles and the Treble chasers' },
    { from: 2010, to: 2019, name: 'The 2010s', note: 'Tiki-taka, gegenpressing and Leicester' },
    { from: 2015, to: 2026, name: 'The modern game', note: 'The last ten years' },
    { from: 1992, to: 2009, name: 'Before the money', note: 'The league as it was' },
];
/**
 * Today's puzzle.
 *
 * The shape and the era move day to day so it is a new question every
 * morning, and the difficulty is fixed because a daily everyone plays has
 * to be the same difficulty for everyone. Blitz shows up about one day in
 * five, which is the day people talk about.
 */
export function dailyFor(n) {
    const seed = dailySeed(n);
    const rnd = stream(seed);
    const formation = DAILY_SHAPES[Math.floor(rnd() * DAILY_SHAPES.length)];
    const era = DAILY_ERAS[Math.floor(rnd() * DAILY_ERAS.length)];
    const blitz = rnd() < 0.2;
    /* Ratings hidden about one day in six. It is the same board and a much
       harder puzzle, which is exactly what a daily wants now and then. */
    const blind = rnd() < 0.17;
    const config = {
        ...defaultConfig,
        formation,
        diff: 'normal',
        mode: 'squad',
        rtype: 'prime',
        eraFrom: era.from,
        eraTo: era.to,
        blitz,
        showRatings: !blind,
    };
    const parts = [formation, era.name];
    if (blitz)
        parts.push('Blitz, top three only');
    if (blind)
        parts.push('no ratings');
    return { n, seed, config, era, twist: parts.join(' · ') };
}
/** Today's, from the clock. */
export function today(now = Date.now()) {
    return dailyFor(dailyNumber(now));
}
/**
 * The scorecard, as thirty eight squares.
 *
 * The thing somebody actually shares. Five rows of eight, which is how a
 * season fits on a phone screen and how it reads as a shape rather than a
 * list of scores.
 */
export function scorecard(form) {
    const marks = form
        .split('')
        .map((c) => (c === 'w' ? '🟩' : c === 'd' ? '🟨' : '🟥'));
    const rows = [];
    for (let i = 0; i < marks.length; i += 8)
        rows.push(marks.slice(i, i + 8).join(''));
    return rows;
}
/** What one puzzle is called out loud. */
export function dailyTitle(n) {
    return `Daily #${n}`;
}
/** How many are worth keeping. A year of playing is thirty rows. */
export const DAILY_KEEP = 30;
export const EMPTY_DAILY = {
    last: 0,
    streak: 0,
    best: 0,
    played: 0,
    won: 0,
    results: [],
};
/**
 * Bank a finished Daily.
 *
 * The streak counts consecutive puzzle numbers rather than consecutive
 * days on a clock, which is the same thing said in a way that cannot be
 * broken by a time zone or by a phone whose date is wrong. Playing today
 * having played yesterday continues it; a gap of any size starts it again
 * at one.
 *
 * Replaying a puzzle already banked changes nothing at all, and neither
 * does going back to an older one, which is what makes it one attempt.
 */
export function bankDaily(record, result) {
    if (result.n <= record.last)
        return record;
    const continued = result.n === record.last + 1;
    return {
        last: result.n,
        streak: continued ? record.streak + 1 : 1,
        best: Math.max(record.best, result.pts),
        played: record.played + 1,
        won: record.won + (result.position === 1 ? 1 : 0),
        results: [result, ...record.results].slice(0, DAILY_KEEP),
    };
}
/**
 * The streak as it stands today, rather than as it stood when it was set.
 *
 * A streak is only alive if the last puzzle played was today's or
 * yesterday's. Miss a day and it is gone, and the screen has to say so
 * before you play rather than after.
 */
export function liveStreak(record, todayNumber) {
    if (!record.last)
        return 0;
    return todayNumber - record.last <= 1 ? record.streak : 0;
}
/** Whether today's has been played. */
export function playedToday(record, todayNumber) {
    return record.last >= todayNumber;
}
/** One result back, if it is still kept. */
export function resultFor(record, n) {
    return record.results.find((r) => r.n === n) ?? null;
}
