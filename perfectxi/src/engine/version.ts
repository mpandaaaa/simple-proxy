/**
 * Bumped whenever a change can alter the result of replaying a run.
 *
 * A leaderboard entry is verified by replaying the seed, the config and the
 * eleven picks on the server and checking the points match. That only works
 * if both sides are running the same arithmetic, so every run records the
 * version it was played on and a replay refuses to judge a run from a
 * version it is not.
 *
 * Change this for: the Dixon-Coles constants, the strength curve, the
 * chemistry bonus, formation modifiers, the fixture order, the opposition
 * league, or the order in which random numbers are drawn. Do not change it
 * for anything that only affects what is drawn on screen.
 */
export const ENGINE_VERSION = 1;
