import type { Cups, DraftConfig, SeasonResult } from '../engine';

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
  | 'World Cup';

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
];

export const CATEGORIES: readonly AchCategory[] = [
  'First Steps',
  'Records',
  'Challenges',
  'Milestones',
  'Cups',
  'World Cup',
];

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
