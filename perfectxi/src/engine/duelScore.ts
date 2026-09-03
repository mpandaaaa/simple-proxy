/**
 * What a duel is scored on.
 *
 * League points alone made half of a season not count. Two people finish
 * on eighty six, one of them has won the Continental Cup and the other
 * went out in the second round, and the game calls it a draw. So the cups
 * are worth something, and what they are worth is set here rather than in
 * a screen, so both phones and any server that ever replays a duel agree
 * to the point.
 *
 * The numbers are chosen against the spread of a season. A league finish
 * is forty to a hundred and ten points, so a cup has to be worth enough
 * to overturn a place or two in the table and never enough to make the
 * league itself an afterthought. Fifteen for the title is about the gap
 * between first and third. Eighteen for the Continental Cup is the
 * largest single thing on the list, because it is the hardest.
 */

export const DUEL_BONUS = {
  /** the league itself, on top of the points that won it */
  champions: 15,
  national: 10,
  continental: 18,
  /** all three, on top of all three */
  treble: 12,
  /** the league and one cup */
  double: 5,
} as const;

export type DuelHonours = {
  champions: boolean;
  national: boolean;
  continental: boolean;
};

export type DuelScore = {
  /** what the league gave */
  pts: number;
  /** what the cups gave */
  bonus: number;
  /** the number the two of you compare */
  total: number;
  honours: DuelHonours;
  /** one line each, for the scoreboard */
  lines: { label: string; value: number }[];
};

/**
 * Add a season up.
 *
 * The treble pays on top of the double, which pays on top of the three
 * things themselves, because a treble should feel like a treble and
 * because somebody who has done it has beaten a season nobody else will
 * have had.
 */
export function duelScore(
  pts: number,
  position: number,
  won: { national: boolean; continental: boolean },
): DuelScore {
  const honours: DuelHonours = {
    champions: position === 1,
    national: won.national,
    continental: won.continental,
  };

  const lines: { label: string; value: number }[] = [
    { label: 'League points', value: pts },
  ];
  let bonus = 0;
  if (honours.champions) {
    bonus += DUEL_BONUS.champions;
    lines.push({ label: 'Champions', value: DUEL_BONUS.champions });
  }
  if (honours.national) {
    bonus += DUEL_BONUS.national;
    lines.push({ label: 'National Cup', value: DUEL_BONUS.national });
  }
  if (honours.continental) {
    bonus += DUEL_BONUS.continental;
    lines.push({ label: 'Continental Cup', value: DUEL_BONUS.continental });
  }

  const cups = Number(honours.national) + Number(honours.continental);
  const treble = honours.champions && cups === 2;
  const double = honours.champions && cups === 1;
  if (treble) {
    bonus += DUEL_BONUS.treble;
    lines.push({ label: 'The Treble', value: DUEL_BONUS.treble });
  } else if (double) {
    bonus += DUEL_BONUS.double;
    lines.push({ label: 'The Double', value: DUEL_BONUS.double });
  }

  return { pts, bonus, total: pts + bonus, honours, lines };
}

/** What to call it, in a word, from one side's point of view. */
export function duelVerdict(mine: number, theirs: number): 'won' | 'drew' | 'lost' {
  return mine > theirs ? 'won' : mine === theirs ? 'drew' : 'lost';
}

/**
 * How the two seasons compare, line by line.
 *
 * The review is a comparison rather than a report, so every number on it
 * needs a side. This is that list, and it is here rather than in the
 * screen because which way round "better" runs is a rule: fewer goals
 * conceded is better and fewer goals scored is not.
 */
export type Compare = {
  label: string;
  mine: number;
  theirs: number;
  /** true when the smaller number is the better one */
  lower?: boolean;
  /** true when it is the headline rather than a detail */
  big?: boolean;
};

export function compareSeasons(
  mine: { pts: number; position: number; w: number; d: number; l: number; gf: number; ga: number; rating: number; cleanSheets: number; score: number },
  theirs: typeof mine,
): Compare[] {
  return [
    { label: 'Score', mine: mine.score, theirs: theirs.score, big: true },
    { label: 'League points', mine: mine.pts, theirs: theirs.pts, big: true },
    { label: 'Position', mine: mine.position, theirs: theirs.position, lower: true, big: true },
    { label: 'Won', mine: mine.w, theirs: theirs.w },
    { label: 'Drawn', mine: mine.d, theirs: theirs.d },
    { label: 'Lost', mine: mine.l, theirs: theirs.l, lower: true },
    { label: 'Goals for', mine: mine.gf, theirs: theirs.gf },
    { label: 'Goals against', mine: mine.ga, theirs: theirs.ga, lower: true },
    { label: 'Goal difference', mine: mine.gf - mine.ga, theirs: theirs.gf - theirs.ga },
    { label: 'Clean sheets', mine: mine.cleanSheets, theirs: theirs.cleanSheets },
    { label: 'XI rating', mine: mine.rating, theirs: theirs.rating },
  ];
}

/** Which side of a comparison is ahead. */
export function winnerOf(row: Compare): 'mine' | 'theirs' | 'level' {
  if (row.mine === row.theirs) return 'level';
  const mineBetter = row.lower ? row.mine < row.theirs : row.mine > row.theirs;
  return mineBetter ? 'mine' : 'theirs';
}
