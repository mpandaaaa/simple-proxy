import { STYLES } from './dynastyTactics.js';
const GK_STYLES = [
    {
        id: 'shotstopper',
        name: 'Shot stopper',
        note: 'Lives on his line and saves what he should not',
        loves: ['direct'],
        hates: ['possession'],
    },
    {
        id: 'sweeper',
        name: 'Sweeper keeper',
        note: 'Starts the move and defends the space behind',
        loves: ['possession'],
        hates: ['direct'],
    },
];
const DEF_STYLES = [
    {
        id: 'ballplayer',
        name: 'Ball playing defender',
        note: 'Comfortable on it, steps into midfield',
        loves: ['possession'],
        hates: ['direct'],
    },
    {
        id: 'stopper',
        name: 'Stopper',
        note: 'Heads it, kicks it, wins the first ball',
        loves: ['direct'],
        hates: ['possession'],
    },
    {
        id: 'fullback',
        name: 'Attacking full back',
        note: 'Gets to the byline and puts it in',
        loves: ['balanced', 'possession'],
        hates: [],
    },
];
const MID_STYLES = [
    {
        id: 'anchor',
        name: 'Holding midfielder',
        note: 'Sits, screens and gives it simple',
        loves: ['direct'],
        hates: [],
    },
    {
        id: 'boxtobox',
        name: 'Box to box',
        note: 'Covers every blade of grass',
        loves: ['balanced'],
        hates: [],
    },
    {
        id: 'playmaker',
        name: 'Playmaker',
        note: 'Everything goes through him',
        loves: ['possession'],
        hates: ['direct'],
    },
];
const ATT_STYLES = [
    {
        id: 'poacher',
        name: 'Poacher',
        note: 'Does nothing for eighty nine minutes and wins you the game',
        loves: ['direct'],
        hates: [],
    },
    {
        id: 'target',
        name: 'Target man',
        note: 'Holds it up and brings others in',
        loves: ['direct'],
        hates: ['possession'],
    },
    {
        id: 'winger',
        name: 'Winger',
        note: 'Takes people on and puts it across',
        loves: ['balanced', 'possession'],
        hates: [],
    },
];
const BY_POS = {
    GK: GK_STYLES,
    DEF: DEF_STYLES,
    MID: MID_STYLES,
    ATT: ATT_STYLES,
};
function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
/** The same player is always the same kind of player. */
export function styleOf(name, pos) {
    const list = BY_POS[pos] ?? MID_STYLES;
    return list[hash(name + pos) % list.length];
}
export function playerStyle(p) {
    return styleOf(p.n, p.pos);
}
/** Everything a style can be worth, in either direction. */
export const STYLE_EDGE = 0.025;
/**
 * What his style is worth in the shape you play.
 *
 * A multiplier on his rating, never more than two and a half percent
 * either way. A squad of poachers under a possession manager is worth
 * about two rating points less than the same squad playing direct, which
 * is a real decision and not a landslide.
 */
export function styleFit(p, style) {
    const s = playerStyle(p);
    if (s.loves.includes(style))
        return 1 + STYLE_EDGE;
    if (s.hates.includes(style))
        return 1 - STYLE_EDGE;
    return 1;
}
/** How well the eleven suits the way you have asked them to play. */
export function squadStyleFit(d) {
    const xi = d.roster.slice(0, 11).filter((p) => p !== null);
    if (!xi.length)
        return 1;
    const style = d.tactic.style ?? 'balanced';
    return xi.reduce((a, p) => a + styleFit(p, style), 0) / xi.length;
}
/** The players who do not suit the way you play, worst first. */
export function styleMisfits(d) {
    const style = d.tactic.style ?? 'balanced';
    const out = [];
    for (const p of d.roster.slice(0, 11)) {
        if (!p)
            continue;
        const s = playerStyle(p);
        if (s.hates.includes(style)) {
            out.push({ name: p.n, style: s.name, want: STYLES[style]?.title ?? style });
        }
    }
    return out;
}
