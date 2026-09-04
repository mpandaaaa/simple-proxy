import type { Cups, DraftConfig, Dynasty, SeasonResult, UclRun, WcRun } from '../engine';

/**
 * The trophy cabinet's catalogue.
 *
 * Carried over from the web build's ACHIEVEMENTS list, same keys, same
 * names, same conditions, so a browser save could be imported later and
 * land on the right shelves. The World Cup group is here and can never be
 * earned yet, because that mode is not built. It is in the catalogue
 * anyway: a cabinet that hides what you have not done is not a cabinet.
 *
 * Pure. Nothing in this file knows what a screen is.
 */

export type AchCategory =
  | 'First Steps'
  | 'Records'
  | 'Challenges'
  | 'Milestones'
  | 'Cups'
  | 'World Cup'
  | 'Champions League'
  | 'Dynasty'
  | 'Play Today'
  | 'Collection';

export type Achievement = {
  key: string;
  mark: string;
  cat: AchCategory;
  name: string;
  desc: string;
  hint: string;
};

export const ACHIEVEMENTS: readonly Achievement[] = [
  /* first steps */
  { key: 'firstSeason', mark: '⚽', cat: 'First Steps', name: 'First Season', desc: 'Your journey starts here.', hint: 'Complete any season' },
  { key: 'firstTitle', mark: '🏆', cat: 'First Steps', name: 'Champion', desc: 'Win the Premier League title.', hint: 'Finish 1st' },
  { key: 'firstTopFour', mark: '🏁', cat: 'First Steps', name: 'European Football', desc: 'Champions League place secured.', hint: 'Finish top 4' },
  { key: 'firstUnbeaten', mark: '⚡', cat: 'First Steps', name: 'The Invincibles', desc: '38 games. Zero defeats.', hint: 'No losses in a season' },
  { key: 'firstRelegation', mark: '📦', cat: 'First Steps', name: 'Rock Bottom', desc: 'Down. Dust yourself off.', hint: 'Finish bottom three' },

  /* records */
  { key: 'pts100', mark: '💯', cat: 'Records', name: 'Century Club', desc: '100 points in a single season.', hint: '100 points or more' },
  { key: 'pts110', mark: '💥', cat: 'Records', name: 'Untouchable', desc: '110 points. Historic.', hint: '110 points or more' },
  { key: 'perfect38', mark: '⭐', cat: 'Records', name: 'Perfection', desc: '38 played. 38 won. Nothing less.', hint: 'Win all 38' },
  { key: 'goals90', mark: '🔥', cat: 'Records', name: 'Goal Machine', desc: 'Relentless attacking football.', hint: '90 goals or more' },
  { key: 'goals100', mark: '🔢', cat: 'Records', name: '100 Club', desc: 'A century of goals in a single season.', hint: '100 goals or more' },
  { key: 'concede10', mark: '🛡', cat: 'Records', name: 'Fort Knox', desc: 'Impenetrable. Barely touched all season.', hint: 'Concede 10 or fewer' },
  { key: 'concede5', mark: '🧤', cat: 'Records', name: 'Unbreachable', desc: 'Five goals all season. A goalkeeping masterclass.', hint: 'Concede 5 or fewer' },
  { key: 'streak15', mark: '📈', cat: 'Records', name: 'Unstoppable', desc: '15 wins in a row. Pure dominance.', hint: 'A 15 game winning streak' },
  { key: 'streak20', mark: '🥇', cat: 'Records', name: 'Relentless', desc: '20 consecutive wins. Jaw dropping.', hint: 'A 20 game winning streak' },
  { key: 'cs20', mark: '🥅', cat: 'Records', name: 'Brick Wall', desc: 'Shutting out the league, game after game.', hint: '20 clean sheets or more' },
  { key: 'cs30', mark: '🧤', cat: 'Records', name: 'Ghost Town', desc: '30 clean sheets. They barely touched the ball.', hint: '30 clean sheets or more' },

  /* challenges */
  { key: 'hardTitle', mark: '💀', cat: 'Challenges', name: 'Blind Champion', desc: 'Won it without seeing a single rating.', hint: 'Win the title on Hard' },
  { key: 'hardUnbeaten', mark: '👻', cat: 'Challenges', name: 'Hard Mode Invincibles', desc: 'Unbeaten all season. In the dark.', hint: 'Unbeaten on Hard' },
  { key: 'hardPerfect', mark: '😈', cat: 'Challenges', name: 'Impossible', desc: '38 from 38 on Hard. No ratings, no mercy.', hint: 'Win all 38 on Hard' },
  { key: 'lowRating', mark: '🧠', cat: 'Challenges', name: 'Tactical Genius', desc: 'Top four on a shoestring squad.', hint: 'Top 4 with an average under 78' },
  { key: 'overperform', mark: '⬆', cat: 'Challenges', name: 'Pep Would Be Proud', desc: 'You were not supposed to finish this high.', hint: 'Finish 3 places above expectation' },
  { key: 'bigOverperform', mark: '🚀', cat: 'Challenges', name: 'Miracle Season', desc: 'Nobody saw this coming. Not even you.', hint: 'Finish 6 places above expectation' },
  { key: 'allTimeTitle', mark: '🌟', cat: 'Challenges', name: 'Legends XI', desc: 'Legends united. The title was inevitable.', hint: 'Win in All Time XI mode' },
  { key: 'formationWin', mark: '🧰', cat: 'Challenges', name: 'Tactical Dinosaur', desc: 'They said 5-4-1 was dead. You proved them wrong.', hint: 'Win the title with 5-4-1 or 3-4-3' },
  { key: 'formationHunter', mark: '🎯', cat: 'Challenges', name: 'Formation Master', desc: 'Won it your way. Every way.', hint: 'Win the title with 4 different formations' },

  /* milestones */
  { key: 'runs5', mark: '📊', cat: 'Milestones', name: 'Regular', desc: 'Five seasons. You keep coming back.', hint: '5 seasons played' },
  { key: 'runs10', mark: '🎯', cat: 'Milestones', name: 'Veteran', desc: 'Ten seasons. A true student of the game.', hint: '10 seasons played' },
  { key: 'runs25', mark: '👑', cat: 'Milestones', name: 'Obsessed', desc: 'Twenty five seasons. This is more than a hobby.', hint: '25 seasons played' },
  { key: 'runs50', mark: '🏟', cat: 'Milestones', name: 'The Professor', desc: 'Fifty seasons. You live and breathe this.', hint: '50 seasons played' },
  { key: 'titles3', mark: '🥉', cat: 'Milestones', name: 'Dynasty', desc: 'Three titles. A dominant era.', hint: 'Win 3 league titles' },
  { key: 'titles5', mark: '🥈', cat: 'Milestones', name: 'Silverware Habit', desc: 'Five titles. This is what you do.', hint: 'Win 5 league titles' },
  { key: 'titles10', mark: '💎', cat: 'Milestones', name: 'Emperor', desc: 'Ten league titles. A dynasty for the ages.', hint: 'Win 10 league titles' },
  { key: 'wins100', mark: '🔥', cat: 'Milestones', name: '100 Wins', desc: 'A hundred victories across all your seasons.', hint: 'Win 100 games in total' },
  { key: 'unbeaten3', mark: '⚡', cat: 'Milestones', name: 'Three Times Invincible', desc: 'Unbeaten in three different seasons.', hint: 'Go unbeaten 3 times' },
  { key: 'phoenix', mark: '🦅', cat: 'Milestones', name: 'Phoenix', desc: 'Relegated. Returned. Conquered.', hint: 'Win the title after a relegation' },
  { key: 'survivor', mark: '🏟', cat: 'Milestones', name: 'The Great Escape', desc: 'It went right to the wire. But you stayed up.', hint: 'Finish 17th' },

  /* cups */
  { key: 'nationalCup', mark: '🏆', cat: 'Cups', name: 'Cup Royalty', desc: 'National Cup winners. Pure Wembley magic.', hint: 'Win the National Cup' },
  { key: 'continentalCup', mark: '🌍', cat: 'Cups', name: 'European Glory', desc: 'The Continental Cup. The pinnacle of club football.', hint: 'Win the Continental Cup' },
  { key: 'cupDouble', mark: '🏅', cat: 'Cups', name: 'The Double', desc: 'League and National Cup. A legendary season.', hint: 'Win the league and the National Cup' },
  { key: 'treble', mark: '💎', cat: 'Cups', name: 'The Treble', desc: 'League, National Cup, Continental Cup. Immortal.', hint: 'Win all three' },
  { key: 'continentalFinal', mark: '🎉', cat: 'Cups', name: 'Final Destination', desc: 'The Continental Cup final. One game from glory.', hint: 'Reach the Continental Cup final' },
  { key: 'cupupset', mark: '😱', cat: 'Cups', name: 'Giant Killers', desc: 'A National Cup run despite a lower rated squad.', hint: 'Reach the National Cup final with an average under 80' },

  /* world cup, not reachable until that mode is built */
  { key: 'wcDebut', mark: '🌐', cat: 'World Cup', name: 'On the World Stage', desc: 'You took a team to the World Cup.', hint: 'Complete a World Cup run' },
  { key: 'wcKnockout', mark: '🧺', cat: 'World Cup', name: 'Into the Knockouts', desc: 'Out of the group and into the bracket.', hint: 'Reach the knockout stage' },
  { key: 'wcQuarter', mark: '⚽', cat: 'World Cup', name: 'Last Eight', desc: 'A genuine contender now.', hint: 'Reach the quarter-finals' },
  { key: 'wcSemi', mark: '🥈', cat: 'World Cup', name: 'Final Four', desc: 'One of the last four standing.', hint: 'Reach the semi-finals' },
  { key: 'wcFinal', mark: '🥉', cat: 'World Cup', name: 'One Game From Glory', desc: 'A place in the World Cup final.', hint: 'Reach the final' },
  { key: 'wcChampion', mark: '🏆', cat: 'World Cup', name: 'World Champions', desc: 'Champions of the world. The ultimate prize.', hint: 'Win the World Cup' },
  { key: 'wcUnbeaten', mark: '⚡', cat: 'World Cup', name: 'Untouchable', desc: 'Lifted the trophy without losing a game.', hint: 'Win the World Cup unbeaten' },
  { key: 'wcWorldXI', mark: '🌏', cat: 'World Cup', name: 'Masters of the Universe', desc: 'A World XI conquered the planet.', hint: 'Win the World Cup with a World XI' },
  { key: 'wcBoot', mark: '🔥', cat: 'World Cup', name: 'Golden Boot Hero', desc: 'A striker on fire all tournament.', hint: 'Score 6 or more with one player' },
  { key: 'wcWall', mark: '🧤', cat: 'World Cup', name: 'Iron Curtain', desc: 'Shutting out the world, game after game.', hint: '4 or more clean sheets in a tournament' },
  { key: 'wcDynasty', mark: '👑', cat: 'World Cup', name: 'World Dynasty', desc: 'Three World Cups. An era of dominance.', hint: 'Win 3 World Cups' },
  /* champions league */
  { key: 'uclDebut', mark: '⭐', cat: 'Champions League', name: 'European Nights', desc: 'You took a club into Europe and saw it through.', hint: 'Finish a Champions League campaign' },
  { key: 'uclTop8', mark: '🎖', cat: 'Champions League', name: 'Straight Through', desc: 'Top eight in the league phase. No play-off needed.', hint: 'Finish the league phase in the top eight' },
  { key: 'uclKnockout', mark: '🔓', cat: 'Champions League', name: 'Into the Last Sixteen', desc: 'Out of the league phase and into the bracket.', hint: 'Reach the Round of 16' },
  { key: 'uclQuarter', mark: '🎯', cat: 'Champions League', name: 'Last Eight in Europe', desc: 'A genuine contender now.', hint: 'Reach the Quarter-Final' },
  { key: 'uclSemi', mark: '🥈', cat: 'Champions League', name: 'Semi-Final Nights', desc: 'Two legs from the final.', hint: 'Reach the Semi-Final' },
  { key: 'uclFinal', mark: '🎪', cat: 'Champions League', name: 'One Game From It', desc: 'A place in the Champions League final.', hint: 'Reach the final' },
  { key: 'uclChampion', mark: '🏆', cat: 'Champions League', name: 'Kings of Europe', desc: 'The Champions League. The one everybody wants.', hint: 'Win the Champions League' },
  { key: 'uclPerfect', mark: '💯', cat: 'Champions League', name: 'Eight From Eight', desc: 'The league phase, won outright.', hint: 'Win all eight matchdays' },
  { key: 'uclUnbeaten', mark: '⚡', cat: 'Champions League', name: 'Untouched in Europe', desc: 'Lifted it without losing a match.', hint: 'Win the Champions League unbeaten' },
  { key: 'uclComeback', mark: '🔄', cat: 'Champions League', name: 'The Second Leg', desc: 'Beaten in the first leg. Through on aggregate.', hint: 'Win a tie after losing the first leg' },
  { key: 'uclPens', mark: '🎲', cat: 'Champions League', name: 'From Twelve Yards', desc: 'A shootout, and you were the ones still standing.', hint: 'Win a tie on penalties' },
  { key: 'uclUnderdog', mark: '🐺', cat: 'Champions League', name: 'Nobody Fancied You', desc: 'A pot four club in the last eight.', hint: 'Reach the Quarter-Final from pot four' },
  { key: 'uclDraftWin', mark: '🌌', cat: 'Champions League', name: 'Assembled', desc: 'An XI drafted out of thirty six squads, and it won the lot.', hint: 'Win it with a drafted Champions XI' },
  { key: 'uclTreble', mark: '👑', cat: 'Champions League', name: 'European Dynasty', desc: 'Three European Cups. An era.', hint: 'Win the Champions League 3 times' },

  /* dynasty */
  { key: 'dynFirst', mark: '📋', cat: 'Dynasty', name: 'Taking the Job', desc: 'One season in the dugout, start to finish.', hint: 'Finish a Dynasty season' },
  { key: 'dynTitle', mark: '🏆', cat: 'Dynasty', name: 'Champions', desc: 'A title won across a whole season with a real squad.', hint: 'Win the league in Dynasty' },
  { key: 'dynTitles3', mark: '🥉', cat: 'Dynasty', name: 'A Proper Run', desc: 'Three titles at the same club.', hint: 'Win 3 titles in one career' },
  { key: 'dynTitles5', mark: '💎', cat: 'Dynasty', name: 'An Era', desc: 'Five titles. They will name a stand after you.', hint: 'Win 5 titles in one career' },
  { key: 'dynPromotion', mark: '⬆', cat: 'Dynasty', name: 'Going Up', desc: 'Out of the Championship and back where you belong.', hint: 'Win promotion' },
  { key: 'dynRebuild', mark: '🦅', cat: 'Dynasty', name: 'All the Way Back', desc: 'Promoted, then champions of the division above.', hint: 'Win the league after a promotion' },
  { key: 'dynFive', mark: '📆', cat: 'Dynasty', name: 'Five Seasons', desc: 'Long enough to be judged on it.', hint: '5 seasons in one career' },
  { key: 'dynTen', mark: '🗓', cat: 'Dynasty', name: 'A Decade', desc: 'Ten seasons at the wheel.', hint: '10 seasons in one career' },
  { key: 'dynTwentyFive', mark: '🏛', cat: 'Dynasty', name: 'Institution', desc: 'Twenty five seasons. Nobody remembers who came before.', hint: '25 seasons in one career' },
  { key: 'dynPts100', mark: '💯', cat: 'Dynasty', name: 'A Hundred Points', desc: 'A hundred, in a real league, with a real squad.', hint: '100 points in a Dynasty season' },
  { key: 'dynSacked', mark: '🚪', cat: 'Dynasty', name: 'Thanks For Your Time', desc: 'It happens to everybody eventually.', hint: 'Get sacked' },
  { key: 'dynAcademy', mark: '🌱', cat: 'Dynasty', name: 'One of Our Own', desc: 'A boy out of the academy in the first team.', hint: 'Promote a youth player' },

  /* play today */
  { key: 'dailyFirst', mark: '📅', cat: 'Play Today', name: 'Today\u2019s XI', desc: 'The first Daily of many.', hint: 'Play a Daily' },
  { key: 'dailyWin', mark: '🥇', cat: 'Play Today', name: 'Top of the Pile', desc: 'A Daily finished top of the table.', hint: 'Win a Daily' },
  { key: 'dailyWeek', mark: '🔥', cat: 'Play Today', name: 'Seven Days', desc: 'A week without missing one.', hint: 'A 7 day Daily streak' },
  { key: 'dailyMonth', mark: '🌙', cat: 'Play Today', name: 'Thirty Days', desc: 'A month straight. That is a habit now.', hint: 'A 30 day Daily streak' },
  { key: 'daily50', mark: '📚', cat: 'Play Today', name: 'Fifty Dailies', desc: 'Fifty puzzles deep.', hint: 'Play 50 Dailies' },
  { key: 'dailyWin10', mark: '👑', cat: 'Play Today', name: 'Serial Winner', desc: 'Ten Dailies won outright.', hint: 'Win 10 Dailies' },
  { key: 'weeklyFirst', mark: '🎡', cat: 'Play Today', name: 'This Week\u2019s Twist', desc: 'The Weekly Event, attempted.', hint: 'Play a Weekly Event' },
  { key: 'weeklyStreak4', mark: '🎠', cat: 'Play Today', name: 'Four Weeks Running', desc: 'Every week, whatever the twist was.', hint: 'A 4 week Weekly streak' },
  { key: 'duelFirst', mark: '⚔', cat: 'Play Today', name: 'Head to Head', desc: 'Your first duel.', hint: 'Play a duel' },
  { key: 'duelWin', mark: '🗡', cat: 'Play Today', name: 'Beaten Them', desc: 'A duel won.', hint: 'Win a duel' },
  { key: 'duelWin10', mark: '🛡', cat: 'Play Today', name: 'Ten Scalps', desc: 'Ten duels won.', hint: 'Win 10 duels' },
  { key: 'duelWin25', mark: '⚜', cat: 'Play Today', name: 'Unbeatable', desc: 'Twenty five duels won.', hint: 'Win 25 duels' },

  /* collection */
  { key: 'cards10', mark: '🃏', cat: 'Collection', name: 'A Start', desc: 'Ten cards in the album.', hint: 'Own 10 cards' },
  { key: 'cards100', mark: '📔', cat: 'Collection', name: 'A Hundred Cards', desc: 'The album is filling up.', hint: 'Own 100 cards' },
  { key: 'cards500', mark: '📕', cat: 'Collection', name: 'Five Hundred', desc: 'A serious collection.', hint: 'Own 500 cards' },
  { key: 'cards1000', mark: '📚', cat: 'Collection', name: 'A Thousand', desc: 'Most people stop a long way before this.', hint: 'Own 1,000 cards' },
  { key: 'firstIcon', mark: '✨', cat: 'Collection', name: 'An Icon', desc: 'Ninety or better. The ones you remember.', hint: 'Own an icon card' },
  { key: 'icons10', mark: '🌠', cat: 'Collection', name: 'Ten Icons', desc: 'A shelf of the very best.', hint: 'Own 10 icon cards' },
  { key: 'card95', mark: '💫', cat: 'Collection', name: 'The Very Best', desc: 'A ninety five. There are not many.', hint: 'Own a card rated 95 or better' },
  { key: 'setFirst', mark: '🧩', cat: 'Collection', name: 'A Complete Set', desc: 'Every card in one set.', hint: 'Complete a set' },
  { key: 'sets5', mark: '🧷', cat: 'Collection', name: 'Five Sets', desc: 'Five of them finished.', hint: 'Complete 5 sets' },
  { key: 'setsAll', mark: '🏅', cat: 'Collection', name: 'Every Set', desc: 'All of them. Nothing left to chase.', hint: 'Complete every set' },
  { key: 'level10', mark: '🔟', cat: 'Collection', name: 'Level Ten', desc: 'Ten levels in.', hint: 'Reach level 10' },
  { key: 'level25', mark: '🎖', cat: 'Collection', name: 'Level Twenty Five', desc: 'Halfway up.', hint: 'Reach level 25' },
  { key: 'level50', mark: '🏔', cat: 'Collection', name: 'The Top', desc: 'Level fifty. There is nothing above it.', hint: 'Reach level 50' },

  /* more of what one season can do */
  { key: 'pts120', mark: '🚀', cat: 'Records', name: 'Beyond Reason', desc: '120 points. That should not be possible.', hint: '120 points or more' },
  { key: 'goals120', mark: '🌋', cat: 'Records', name: 'Avalanche', desc: '120 goals in thirty eight games.', hint: '120 goals or more' },
  { key: 'gd75', mark: '📐', cat: 'Records', name: 'Not Even Close', desc: 'A goal difference nobody could live with.', hint: 'A goal difference of 75 or more' },
  { key: 'streak25', mark: '🌀', cat: 'Records', name: 'Twenty Five Straight', desc: 'Two thirds of a season, all won.', hint: 'A 25 game winning streak' },
  { key: 'blitzTitle', mark: '⏱', cat: 'Challenges', name: 'Blitz Champion', desc: 'The title, drafted against the clock.', hint: 'Win the title in Blitz' },
  { key: 'retroTitle', mark: '📼', cat: 'Challenges', name: 'Before Your Time', desc: 'Won it with players from another era.', hint: 'Win the title with an era ending before 2005' },
  { key: 'cleanSweep', mark: '🌟', cat: 'Challenges', name: 'The Perfect Year', desc: 'Everything, and not beaten once.', hint: 'Win the treble unbeaten' },
];

export const CATEGORIES: readonly AchCategory[] = [
  'First Steps',
  'Records',
  'Challenges',
  'Milestones',
  'Cups',
  'World Cup',
  'Champions League',
  'Dynasty',
  'Play Today',
  'Collection',
];

/** One line under each heading, so a shelf says what it is for. */
export const CATEGORY_NOTE: Record<AchCategory, string> = {
  'First Steps': 'The first time you did each of these',
  Records: 'What one season can be made to do',
  Challenges: 'Done the hard way, or not at all',
  Milestones: 'Everything you have ever done, added up',
  Cups: 'The National and Continental Cups',
  'World Cup': 'Forty eight nations, seven matches',
  'Champions League': 'A league phase, then the knockout',
  Dynasty: 'A career at one club, across seasons',
  'Play Today': 'The Daily, the Weekly and duels',
  Collection: 'Cards, sets and levels',
};

export function achievementFor(key: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.key === key);
}

/**
 * Everything the cabinet has to remember between seasons.
 *
 * Kept separate from the season records themselves because some of these
 * cannot be recomputed: a phoenix needs to know that the season before
 * this one ended in relegation, and once that season is off the end of a
 * capped history the fact would be gone.
 */
export type Career = {
  seasons: number;
  titles: number;
  wins: number;
  unbeaten: number;
  relegations: number;
  nationalCups: number;
  continentalCups: number;
  doubles: number;
  trebles: number;
  /** the last season ended in relegation, which is what a phoenix rises from */
  lastRelegated: boolean;
  /** formations a title has been won with */
  titleFormations: string[];

  /**
   * The tournaments and the career.
   *
   * These are counted here rather than read back off a run, because a run
   * is thrown away when the next one starts and a third World Cup has to
   * know about the first two.
   */
  wcRuns: number;
  wcTitles: number;
  /** the furthest a World Cup run has got, nought to six */
  wcBest: number;
  uclRuns: number;
  uclTitles: number;
  /** the furthest a Champions League campaign has got, nought to six */
  uclBest: number;
  dynSeasons: number;
  dynTitles: number;
  dynBestPts: number;

  earned: string[];
};

export const EMPTY_CAREER: Career = {
  seasons: 0,
  titles: 0,
  wins: 0,
  unbeaten: 0,
  relegations: 0,
  nationalCups: 0,
  continentalCups: 0,
  doubles: 0,
  trebles: 0,
  lastRelegated: false,
  titleFormations: [],
  wcRuns: 0,
  wcTitles: 0,
  wcBest: 0,
  uclRuns: 0,
  uclTitles: 0,
  uclBest: 0,
  dynSeasons: 0,
  dynTitles: 0,
  dynBestPts: 0,
  earned: [],
};

/**
 * Fold one finished season into the career record.
 *
 * The season is counted first, then the achievements are judged against
 * the career including it, so "five seasons played" can be earned by the
 * fifth season rather than the sixth.
 */
export function foldSeason(
  career: Career,
  result: SeasonResult,
  cups: Cups,
  config: DraftConfig,
): Career {
  const champion = result.position === 1;
  const relegated = result.position >= 18;
  const unbeaten = result.losses === 0;

  return {
    seasons: career.seasons + 1,
    titles: career.titles + (champion ? 1 : 0),
    wins: career.wins + result.wins,
    unbeaten: career.unbeaten + (unbeaten ? 1 : 0),
    relegations: career.relegations + (relegated ? 1 : 0),
    nationalCups: career.nationalCups + (cups.national.won ? 1 : 0),
    continentalCups: career.continentalCups + (cups.continental.won ? 1 : 0),
    doubles: career.doubles + (cups.double ? 1 : 0),
    trebles: career.trebles + (cups.treble ? 1 : 0),
    lastRelegated: relegated,
    titleFormations:
      champion && !career.titleFormations.includes(config.formation)
        ? [...career.titleFormations, config.formation]
        : career.titleFormations,
    wcRuns: career.wcRuns,
    wcTitles: career.wcTitles,
    wcBest: career.wcBest,
    uclRuns: career.uclRuns,
    uclTitles: career.uclTitles,
    uclBest: career.uclBest,
    dynSeasons: career.dynSeasons,
    dynTitles: career.dynTitles,
    dynBestPts: career.dynBestPts,
    earned: career.earned,
  };
}

/**
 * Which achievements this season just earned.
 *
 * `career` must already include the season. `wasRelegated` is the state
 * from before it, because a phoenix is a title won by someone who went
 * down last time, not by someone who is going down now.
 */
export function earn(args: {
  career: Career;
  result: SeasonResult;
  cups: Cups;
  config: DraftConfig;
  avg: number;
  /** places finished above what a squad of that rating should manage */
  above: number;
  wasRelegated: boolean;
}): string[] {
  const { career, result, cups, config, avg, above, wasRelegated } = args;
  const has = new Set(career.earned);
  const out: string[] = [];
  const give = (key: string, when: boolean) => {
    if (when && !has.has(key)) {
      has.add(key);
      out.push(key);
    }
  };

  const champion = result.position === 1;
  const unbeaten = result.losses === 0;
  const perfect = result.wins === result.matches.length;
  const hard = config.diff === 'hard';

  give('firstSeason', true);
  give('firstTitle', champion);
  give('firstTopFour', result.position <= 4);
  give('firstUnbeaten', unbeaten);
  give('firstRelegation', result.position >= 18);

  give('pts100', result.pts >= 100);
  give('pts110', result.pts >= 110);
  give('perfect38', perfect);
  give('goals90', result.gf >= 90);
  give('goals100', result.gf >= 100);
  give('concede10', result.ga <= 10);
  give('concede5', result.ga <= 5);
  give('streak15', result.longestStreak >= 15);
  give('streak20', result.longestStreak >= 20);
  give('cs20', result.cleanSheets >= 20);
  give('cs30', result.cleanSheets >= 30);

  give('hardTitle', hard && champion);
  give('hardUnbeaten', hard && unbeaten);
  give('hardPerfect', hard && perfect);
  give('lowRating', result.position <= 4 && avg < 78);
  give('overperform', above >= 3);
  give('bigOverperform', above >= 6);
  give('allTimeTitle', champion && config.mode === 'alltime');
  give('formationWin', champion && (config.formation === '5-4-1' || config.formation === '3-4-3'));
  give('formationHunter', career.titleFormations.length >= 4);

  give('runs5', career.seasons >= 5);
  give('runs10', career.seasons >= 10);
  give('runs25', career.seasons >= 25);
  give('runs50', career.seasons >= 50);
  give('titles3', career.titles >= 3);
  give('titles5', career.titles >= 5);
  give('titles10', career.titles >= 10);
  give('wins100', career.wins >= 100);
  give('unbeaten3', career.unbeaten >= 3);
  give('phoenix', champion && wasRelegated);
  give('survivor', result.position === 17);

  give('nationalCup', cups.national.won);
  give('continentalCup', cups.continental.won);
  give('cupDouble', cups.double);
  give('treble', cups.treble);
  give(
    'continentalFinal',
    cups.continental.qualified &&
      (cups.continental.won || cups.continental.elim === 'Final'),
  );
  give(
    'cupupset',
    avg < 80 && (cups.national.won || cups.national.elim === 'Final'),
  );

  give('pts120', result.pts >= 120);
  give('goals120', result.gf >= 120);
  give('gd75', result.gf - result.ga >= 75);
  give('streak25', result.longestStreak >= 25);
  give('blitzTitle', champion && Boolean(config.blitz));
  give('retroTitle', champion && config.eraTo < 2005);
  give('cleanSweep', cups.treble && unbeaten);

  return out;
}

export type Target = {
  achievement: Achievement;
  /** where you are, and what you need, when the condition is countable */
  have: number;
  need: number;
};

/**
 * What you are closest to earning.
 *
 * Only the countable ones can honestly show progress: seasons played,
 * titles, total wins, unbeaten campaigns, cups. The rest are one shot
 * conditions, and a bar that reads "0 of 1" until the moment it reads
 * "1 of 1" tells you nothing you did not already know.
 *
 * Sorted by how close you are, so the front of the list is the thing worth
 * playing another season for.
 */
export function nextUp(career: Career, limit = 3): Target[] {
  const has = new Set(career.earned);
  const countable: { key: string; have: number; need: number }[] = [
    { key: 'runs5', have: career.seasons, need: 5 },
    { key: 'runs10', have: career.seasons, need: 10 },
    { key: 'runs25', have: career.seasons, need: 25 },
    { key: 'runs50', have: career.seasons, need: 50 },
    { key: 'titles3', have: career.titles, need: 3 },
    { key: 'titles5', have: career.titles, need: 5 },
    { key: 'titles10', have: career.titles, need: 10 },
    { key: 'wins100', have: career.wins, need: 100 },
    { key: 'unbeaten3', have: career.unbeaten, need: 3 },
    { key: 'formationHunter', have: career.titleFormations.length, need: 4 },
    { key: 'firstTitle', have: career.titles, need: 1 },
    { key: 'nationalCup', have: career.nationalCups, need: 1 },
    { key: 'continentalCup', have: career.continentalCups, need: 1 },
    { key: 'cupDouble', have: career.doubles, need: 1 },
    { key: 'treble', have: career.trebles, need: 1 },
    { key: 'wcDebut', have: career.wcRuns, need: 1 },
    { key: 'wcChampion', have: career.wcTitles, need: 1 },
    { key: 'wcDynasty', have: career.wcTitles, need: 3 },
    { key: 'uclDebut', have: career.uclRuns, need: 1 },
    { key: 'uclChampion', have: career.uclTitles, need: 1 },
    { key: 'uclTreble', have: career.uclTitles, need: 3 },
    { key: 'dynFirst', have: career.dynSeasons, need: 1 },
    { key: 'dynFive', have: career.dynSeasons, need: 5 },
    { key: 'dynTen', have: career.dynSeasons, need: 10 },
    { key: 'dynTwentyFive', have: career.dynSeasons, need: 25 },
    { key: 'dynTitle', have: career.dynTitles, need: 1 },
    { key: 'dynTitles3', have: career.dynTitles, need: 3 },
    { key: 'dynTitles5', have: career.dynTitles, need: 5 },
  ];

  return countable
    .filter((c) => !has.has(c.key))
    .map((c) => {
      const achievement = achievementFor(c.key);
      return achievement ? { achievement, have: Math.min(c.have, c.need), need: c.need } : null;
    })
    .filter((t): t is Target => t !== null)
    .sort((a, b) => b.have / b.need - a.have / a.need || a.need - b.need)
    .slice(0, limit);
}

/** The most recently earned, newest first. */
export function recent(career: Career, limit = 4): Achievement[] {
  const out: Achievement[] = [];
  for (let i = career.earned.length - 1; i >= 0 && out.length < limit; i--) {
    const a = achievementFor(career.earned[i]);
    if (a) out.push(a);
  }
  return out;
}

/* ================= the tournaments ================= */

/**
 * How far a World Cup run got, as a number.
 *
 * Nought is the group stage and six is the trophy, so "reached the
 * quarter-finals" is one comparison rather than a chain of them.
 */
const WC_ORDER: readonly string[] = ['group', 'r32', 'r16', 'qf', 'sf', 'final'];

export function wcReached(run: WcRun): number {
  if (run.won) return 6;
  const at = WC_ORDER.indexOf(run.outAt ?? 'group');
  return at < 0 ? 0 : at;
}

/** One finished World Cup, folded into the career. */
export function foldWorldCup(career: Career, run: WcRun): Career {
  return {
    ...career,
    wcRuns: career.wcRuns + 1,
    wcTitles: career.wcTitles + (run.won ? 1 : 0),
    wcBest: Math.max(career.wcBest, wcReached(run)),
  };
}

/**
 * What a finished World Cup earned.
 *
 * `career` must already have the run folded in, the same way the season
 * ones work, so a third World Cup can be the one that earns the third.
 */
export function earnWorldCup(career: Career, run: WcRun): string[] {
  const has = new Set(career.earned);
  const out: string[] = [];
  const give = (key: string, when: boolean) => {
    if (when && !has.has(key)) {
      has.add(key);
      out.push(key);
    }
  };

  const got = wcReached(run);
  const lost = run.played.some((m) =>
    m.pens ? m.pens.a < m.pens.b : m.ga < m.gb,
  );
  const topScorer = Math.max(0, ...Object.values(run.squad).map((s) => s.g));

  give('wcDebut', true);
  give('wcKnockout', got >= 1);
  give('wcQuarter', got >= 3);
  give('wcSemi', got >= 4);
  give('wcFinal', got >= 5);
  give('wcChampion', run.won);
  give('wcUnbeaten', run.won && !lost);
  give('wcWorldXI', run.won && Boolean(run.custom));
  give('wcBoot', topScorer >= 6);
  give('wcWall', run.cleanSheets >= 4);
  give('wcDynasty', career.wcTitles >= 3);

  return out;
}

const UCL_ORDER: readonly string[] = ['league', 'po', 'r16', 'qf', 'sf', 'final'];

export function uclReached(run: UclRun): number {
  if (run.won) return 6;
  const at = UCL_ORDER.indexOf(run.outAt ?? 'league');
  return at < 0 ? 0 : at;
}

/** One finished Champions League campaign, folded into the career. */
export function foldUcl(career: Career, run: UclRun): Career {
  return {
    ...career,
    uclRuns: career.uclRuns + 1,
    uclTitles: career.uclTitles + (run.won ? 1 : 0),
    uclBest: Math.max(career.uclBest, uclReached(run)),
  };
}

export function earnUcl(career: Career, run: UclRun, pot: number): string[] {
  const has = new Set(career.earned);
  const out: string[] = [];
  const give = (key: string, when: boolean) => {
    if (when && !has.has(key)) {
      has.add(key);
      out.push(key);
    }
  };

  const got = uclReached(run);
  const league = run.played.filter((m) => m.stage === 'league');
  const leagueWins = league.filter((m) => m.ga > m.gb).length;
  const lost = run.played.some((m) => m.ga < m.gb);
  const rank = run.rank[run.you] ?? 36;

  /* A comeback is a first leg lost and the tie won anyway, which is
     readable off the second leg's aggregate. */
  let comeback = false;
  let shootout = false;
  for (let i = 0; i < run.played.length; i++) {
    const m = run.played[i];
    if (m.stage === 'league' || m.stage === 'final') continue;
    if (m.n !== 2 || !m.agg) continue;
    const wonTie = m.pens ? m.pens.a > m.pens.b : m.agg.a > m.agg.b;
    if (m.pens && m.pens.a > m.pens.b) shootout = true;
    const first = run.played[i - 1];
    if (wonTie && first && first.n === 1 && first.ga < first.gb) comeback = true;
  }

  give('uclDebut', true);
  give('uclTop8', run.order.length > 0 && rank <= 8);
  give('uclKnockout', got >= 2);
  give('uclQuarter', got >= 3);
  give('uclSemi', got >= 4);
  give('uclFinal', got >= 5);
  give('uclChampion', run.won);
  give('uclPerfect', league.length === 8 && leagueWins === 8);
  give('uclUnbeaten', run.won && !lost);
  give('uclComeback', comeback);
  give('uclPens', shootout);
  give('uclUnderdog', got >= 3 && pot === 4);
  give('uclDraftWin', run.won && Boolean(run.custom));
  give('uclTreble', career.uclTitles >= 3);

  return out;
}

/* ================= dynasty ================= */

/** One finished Dynasty season, folded into the career. */
export function foldDynasty(career: Career, d: Dynasty): Career {
  return {
    ...career,
    dynSeasons: Math.max(career.dynSeasons, d.year),
    dynTitles: Math.max(career.dynTitles, d.titles),
    dynBestPts: Math.max(career.dynBestPts, d.records?.bestPts ?? 0),
  };
}

export function earnDynasty(career: Career, d: Dynasty): string[] {
  const has = new Set(career.earned);
  const out: string[] = [];
  const give = (key: string, when: boolean) => {
    if (when && !has.has(key)) {
      has.add(key);
      out.push(key);
    }
  };

  const rows = d.seasons ?? [];
  /* Promotion is a season in the division below followed by one above it,
     which is the only place the fact survives. */
  let promoted = false;
  let titleAfterPromotion = false;
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i - 1].div ?? 1) === 2 && (rows[i].div ?? 1) === 1) promoted = true;
    if (promoted && (rows[i].div ?? 1) === 1 && rows[i].fin === 1) titleAfterPromotion = true;
  }
  if (rows.length && (rows[rows.length - 1].div ?? 1) === 1 && rows.some((r) => (r.div ?? 1) === 2)) {
    promoted = true;
  }

  /* A shirt in the first team that came out of the academy. The youth
     themselves sit outside the roster until they are promoted, so a
     roster place is exactly the fact worth rewarding. */
  const roster = d.roster ?? [];
  const academy = roster.some((p) => p !== null && p.season === 'Academy');

  give('dynFirst', rows.length >= 1);
  give('dynTitle', d.titles >= 1);
  give('dynTitles3', d.titles >= 3);
  give('dynTitles5', d.titles >= 5);
  give('dynPromotion', promoted);
  give('dynRebuild', titleAfterPromotion);
  give('dynFive', d.year >= 5);
  give('dynTen', d.year >= 10);
  give('dynTwentyFive', d.year >= 25);
  give('dynPts100', (d.records?.bestPts ?? 0) >= 100);
  give('dynSacked', Boolean(d.sacked));
  give('dynAcademy', academy);

  return out;
}

/* ================= everything that can be re-read ================= */

/**
 * What the rest of the app is holding, as the cabinet needs to see it.
 *
 * These conditions are all re-derivable: how many cards are in the album,
 * what level you are, how long the Daily streak is. Nothing here has to be
 * caught at the moment it happens, so rather than wiring a hook into every
 * screen that could earn one, the cabinet sweeps them whenever it opens
 * and whenever a run ends. A condition that can be checked later should be
 * checked later; only the ones that would be lost need a hook.
 */
export type Standing = {
  /** cards owned, by rarity and in total */
  cards: { all: number; icon: number };
  /** the best rated card in the album */
  bestCard: number;
  /** sets finished, and how many there are */
  sets: number;
  setsTotal: number;
  level: number;
  daily: { played: number; won: number; streak: number };
  weekly: { played: number; streak: number };
  duels: { played: number; won: number };
};

export function sweep(career: Career, now: Standing): string[] {
  const has = new Set(career.earned);
  const out: string[] = [];
  const give = (key: string, when: boolean) => {
    if (when && !has.has(key)) {
      has.add(key);
      out.push(key);
    }
  };

  give('cards10', now.cards.all >= 10);
  give('cards100', now.cards.all >= 100);
  give('cards500', now.cards.all >= 500);
  give('cards1000', now.cards.all >= 1000);
  give('firstIcon', now.cards.icon >= 1);
  give('icons10', now.cards.icon >= 10);
  give('card95', now.bestCard >= 95);
  give('setFirst', now.sets >= 1);
  give('sets5', now.sets >= 5);
  give('setsAll', now.setsTotal > 0 && now.sets >= now.setsTotal);
  give('level10', now.level >= 10);
  give('level25', now.level >= 25);
  give('level50', now.level >= 50);

  give('dailyFirst', now.daily.played >= 1);
  give('dailyWin', now.daily.won >= 1);
  give('dailyWeek', now.daily.streak >= 7);
  give('dailyMonth', now.daily.streak >= 30);
  give('daily50', now.daily.played >= 50);
  give('dailyWin10', now.daily.won >= 10);
  give('weeklyFirst', now.weekly.played >= 1);
  give('weeklyStreak4', now.weekly.streak >= 4);
  give('duelFirst', now.duels.played >= 1);
  give('duelWin', now.duels.won >= 1);
  give('duelWin10', now.duels.won >= 10);
  give('duelWin25', now.duels.won >= 25);

  return out;
}
