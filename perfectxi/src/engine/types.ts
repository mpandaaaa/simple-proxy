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
  /**
   * Whether ratings are visible on a board. Hard always hides them, whatever
   * this says, which is why the two are separate: the toggle is a choice
   * everywhere else.
   */
  showRatings: boolean;
  /**
   * Only players of this nationality appear on a board.
   *
   * Used by the Weekly Event's Homegrown week and nothing else. Left out
   * everywhere else, which is every other mode.
   */
  nation?: string;
};

/** Ratings are hidden on Hard regardless of the toggle. */
export function ratingsHidden(config: DraftConfig): boolean {
  return config.diff === 'hard' || !config.showRatings;
}

export const defaultConfig: DraftConfig = {
  formation: '4-3-3',
  diff: 'easy',
  mode: 'squad',
  rtype: 'prime',
  eraFrom: 1992,
  eraTo: 2026,
  blitz: false,
  showRatings: true,
};
