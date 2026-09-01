export type Position = 'GK' | 'DEF' | 'MID' | 'ATT';

/** A row as it sits in the shipped database. */
export type DbPlayer = {
  n: string;
  nat: string;
  pos: string[];
  rtg: number;
  prime: number;
};

/** A player offered on a board, already resolved to one rating. */
export type Pick = {
  n: string;
  nat: string;
  pos: string[];
  rtg: number;
  club: string;
  season: string;
};

export type Slot = {
  pos: Position;
  player: Pick | null;
};

export type RatingType = 'season' | 'prime';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type DraftMode = 'squad' | 'alltime';

export type DraftConfig = {
  formation: string;
  diff: Difficulty;
  mode: DraftMode;
  /** which rating a player is offered at */
  rtype: RatingType;
  eraFrom: number;
  eraTo: number;
  /** only the top three of a board are offered */
  blitz: boolean;
};

export const defaultConfig: DraftConfig = {
  formation: '4-3-3',
  diff: 'easy',
  mode: 'squad',
  rtype: 'prime',
  eraFrom: 1992,
  eraTo: 2026,
  blitz: false,
};
