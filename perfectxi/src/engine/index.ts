export { ENGINE_VERSION } from './version';
export {
  CLUB_COLOURS,
  clubColour,
  clubCode,
  lastName,
  initials,
  tierFor,
  tierLabel,
  faceStats,
  eraOf,
} from './clubs';
export type { CardTier, Era } from './clubs';
export { mulberry32, systemRng, shuffle } from './rng';
export type { Rng } from './rng';
export * from './types';
export {
  FORMATIONS,
  FORMATION_NAMES,
  POSITION_LABEL,
  posGroups,
  posCompat,
  slotsFor,
} from './formations';
export type { Formation } from './formations';
export {
  ALL_KEYS,
  AT20_CLUBS,
  seasonStr,
  clubSeasons,
  eraSummary,
  newDraft,
  rerollsFor,
  spin,
  visibleBoard,
  slotsForPlayer,
  canPlay,
  place,
  squadAvg,
  squadChem,
  chemBonus,
  chemistryLinks,
  CHEM_WEIGHT,
} from './draft';
export type { DraftState, SpinResult, ChemLink, EraSummary } from './draft';
export {
  SIM_LEAGUE,
  leagueFor,
  strFromAvg,
  dcExpected,
  seasonGrade,
  simulateSeason,
  calcOdds,
  ordinal,
  strongerThan,
  verdictFor,
  verdict,
  awards,
  livePosition,
  expectedFinish,
  expectation,
  finishFor,
  highlights,
} from './sim';
export type {
  Odds,
  Verdict,
  Award,
  Outcome,
  Scorer,
  MatchResult,
  TableRow,
  PlayerStat,
  Grade,
  SeasonResult,
  Expectation,
  Finish,
  FinishTone,
  Highlight,
} from './sim';

export {
  simulateCups,
  simulateSeasonCups,
  qualifyFor,
  COMPS,
  NATIONAL_CLUBS,
  CONTINENTAL_CLUBS,
  EUROPA_CLUBS,
  CONFERENCE_CLUBS,
} from './cups';
export type {
  Cups,
  CupRun,
  CupTie,
  CupClub,
  CupLeg,
  CupSeason,
  CompId,
  Europe,
} from './cups';
export {
  overall,
  ageIn,
  seasonYear,
  seedTracks,
  saleBlock,
  signedThisSeason,
  ageOne,
  retireOdds,
  value,
  playerValue,
  wage,
  startDynasty,
  advanceSeason,
  squadRating,
  squadValue,
  wageBill,
  asSquad,
} from './dynasty';
export type { Dynasty, DynastyPlayer, Contract, AgeingReport } from './dynasty';
export { starters, bench, everyone, careerSeed } from './dynasty';
export {
  SCENARIOS,
  scenarioById,
  clubOptions,
  clubsForScenario,
  objectiveFor,
  objectiveLabel,
  objectiveClause,
  takeJob,
  stature,
  statureFloor,
  boardTarget,
  scaleSquadTo,
  clubAt,
  budgetFor,
  primeAge,
  startCareer,
} from './career';
export type { Scenario, ScenarioId, ClubOption, Mode } from './career';
export { matchRating, expectedRating, perfBeta, development, seasonRatings } from './dynastyRatings';
export type { MatchContext, Development } from './dynastyRatings';
export {
  STYLES, MENTALITIES, FIT, tacticDeltas, posFit, canFill, slotAccepts, placeName, benchCover,
  effectiveRating, misfits, setPieceShare, learnTactic, changeShape,
} from './dynastyTactics';
export type { StyleId, TacticDeltas } from './dynastyTactics';
export {
  STAFF, STAR_NAMES, staffCost, staffUpgradeCost, staffWages, devMultiplier,
  injuryMultiplier, trainingMultiplier, SEAT_COST, STADIUM_STEP, ticketYield,
  matchdayRevenue, stadiumCost, stadiumPayback, wageBill as clubWageBill,
  amortTotal, revenue, closeBooks, nextBudget, baseBudget,
  RETAIL_COST, FAN_FLOOR, FAN_CEIL, startingFans, fanChange, nextFans,
  retailMultiplier, merchRevenue,
} from './dynastyClub';
export type { StaffRole } from './dynastyClub';
export {
  seasonInjuries, makeYouth, intakeSize, scoutRange, renewalTerms,
  expiring, autoRenews, market, sign, sell, promote, releaseYouth, emptySlots, tidySquad,
} from './dynastySquad';
export type { Listing, RenewalTerms } from './dynastySquad';
export { processSeasonEnd } from './dynastySeason';
export type { SummerReport } from './dynastySeason';
export type { Tactic, Staff, Infra, Ledger, SeasonRow, AllTime, InboxItem } from './dynasty';
export { EMPTY_TACTIC, EMPTY_STAFF } from './dynasty';

export {
  MORALE_BASE,
  MORALE_UNHAPPY,
  moraleFit,
  moraleWord,
  moraleAfterSeason,
  offersFor,
  spendCap,
  acceptOffer,
  rejectOffer,
  seasonCards,
  LOAN_CLUBS,
  LOAN_LIMIT,
  loanClubFor,
  loanSeason,
  autoLoanPicks,
  averageWage,
  reputation,
  jobOffers,
} from './dynastyPeople';
export type { Offer, Discipline, LoanSpell, JobOffer } from './dynastyPeople';

export {
  styleOf,
  playerStyle,
  styleFit,
  squadStyleFit,
  styleMisfits,
  STYLE_EDGE,
} from './dynastyStyles';
export type { PlayerStyle } from './dynastyStyles';

export {
  endOfSeason,
  startingLeague,
  startingChampionship,
  divisionFor,
  divisionName,
  clubRating,
  ratingStrength,
} from './pyramid';
export type { Club, Division } from './pyramid';

export { PREMIER_LEAGUE, CHAMPIONSHIP } from './sim';

export {
  DAILY_EPOCH,
  DAILY_ERAS,
  dailyNumber,
  nextDailyAt,
  untilNextDaily,
  dailyDate,
  dailySeed,
  dailyFor,
  today,
  scorecard,
  dailyTitle,
  DAILY_KEEP,
  EMPTY_DAILY,
  bankDaily,
  liveStreak,
  playedToday,
  resultFor,
} from './daily';
export type { Daily, DailyEra, DailyResult, DailyRecord } from './daily';

export {
  weekNumber,
  nextWeekAt,
  untilNextWeek,
  TWISTS,
  weeklyFor,
  thisWeek,
  nextTwist,
  twistName,
  WEEKLY_KEEP,
  EMPTY_WEEKLY,
  bankWeekly,
  bestThisWeek,
  weeklyStreak,
} from './weekly';
export { EMPTY_DUELS, bankDuel, sendDuel } from './weekly';
export type {
  Twist,
  Weekly,
  WeeklyBest,
  WeeklyRecord,
  DuelResult,
  DuelRecord,
} from './weekly';

export {
  DUEL_SHAPES,
  encodeDuel,
  decodeDuel,
  newDuel,
  duelOutcome,
  duelRules,
} from './duel';
export type { Duel } from './duel';
