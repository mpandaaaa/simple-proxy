/**
 * Every saved record on this device is wrapped in an envelope carrying the
 * schema version it was written with. Nothing is ever read raw.
 *
 * The web build learned this the hard way: only Dynasty carried a version,
 * so only Dynasty could be changed safely. Here everything can.
 */
export type Envelope<T> = {
  /** schema version this record was written with */
  v: number;
  /** epoch ms of the last write, for debugging and stale record pruning */
  t: number;
  data: T;
};

/**
 * A migration takes the previous shape and returns the next one.
 * Keyed by the version it upgrades *to*.
 */
export type Migration = (old: unknown) => unknown;
export type Migrations = Record<number, Migration>;

export type StoreDef<T> = {
  key: string;
  version: number;
  fallback: T;
  migrations?: Migrations;
  /**
   * Last line of defence. If a record survives migration but is still not
   * the shape we expect (hand edited, partial write, corrupted), this
   * rejects it and the fallback is used instead of crashing the app.
   */
  validate?: (value: unknown) => value is T;
};
