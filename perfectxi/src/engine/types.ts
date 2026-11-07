export type Position = 'GK' | 'DEF' | 'MID' | 'ATT';

/** A player as stored in the database, plus where they were drafted from. */
export type Player = {
  n: string;
  nat?: string;
  pos: Position[];
  rtg: number;
  prime?: number;
  /** club and season of the board they were drafted from; drive chemistry */
  club?: string;
  season?: number | string;
};

/** One position in the XI. `pos` is the slot, not the player's natural role. */
export type Slot = { pos: Position; player: Player | null };
export type Squad = readonly Slot[];
