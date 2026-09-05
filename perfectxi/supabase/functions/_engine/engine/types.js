/** Ratings are hidden on Hard regardless of the toggle. */
export function ratingsHidden(config) {
    return config.diff === 'hard' || !config.showRatings;
}
export const defaultConfig = {
    formation: '4-3-3',
    diff: 'easy',
    mode: 'squad',
    rtype: 'prime',
    eraFrom: 1992,
    eraTo: 2026,
    blitz: false,
    showRatings: true,
};
