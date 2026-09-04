import type { MatchNight } from './components';

/**
 * The Champions League colourway.
 *
 * The rest of the app is pine and emerald. This competition has been navy
 * and silver under floodlights for thirty years and would look wrong in
 * anything else, so it carries its own palette rather than borrowing the
 * league's.
 *
 * Kept here and not in tokens.ts because it belongs to one mode. Only the
 * blue card tone on the home screen is shared, so the front door does not
 * need to know about this file.
 */
export const ucl = {
  /** the ground under a Champions League screen */
  ink: '#050D22',
  /** a panel on that ground */
  panel: 'rgba(79, 143, 255, 0.055)',
  panelOn: 'rgba(79, 143, 255, 0.13)',
  /** hairlines */
  edge: 'rgba(120, 166, 255, 0.2)',
  edgeHi: 'rgba(120, 166, 255, 0.46)',
  /** the competition's own blue */
  blue: '#4FC3FF',
  deep: '#2E6BFF',
  /** the silver that everything official is written in */
  silver: '#C9D6F0',
  /** the trophy */
  gold: '#D6B25E',
  /** through, out, and the line between them */
  through: '#4FC3FF',
  play: '#7C86FF',
  out: '#E5484D',
} as const;

/** The broadcast, in the competition's colours rather than the league's. */
export const uclNight: MatchNight = {
  top: 'linear-gradient(160deg, #143A8F 0%, #0A1E52 52%, #040C22 100%)',
  edge: 'rgba(120, 166, 255, 0.36)',
  hot: '#9BB8FF',
  me: '#4FC3FF',
  opp: '#FF6F91',
  base: '#050B18',
};
