/**
 * The engine's identity. Load bearing.
 *
 * Online results are scored on the server by replaying a run. If the phone
 * and the server replay with different engine builds, honest players get
 * rejected after an app update. So every submission carries this, and the
 * server replays with the matching build.
 *
 * Bump ENGINE_VERSION whenever any change could alter the result of a
 * seeded run, even by one goal. The parity and golden tests will tell you
 * when that has happened.
 */
export const ENGINE_VERSION = 1;

/** The web game build this engine was ported from and is tested against. */
export const ENGINE_SOURCE_BUILD = 's67-1';
