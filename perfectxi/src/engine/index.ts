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
  budgetFor,
  primeAge,
  startCareer,
} from './career';
export type { Scenario, ScenarioId, ClubOption, Mode } from './career';
export { matchRating, expectedRating, perfBeta, development, seasonRatings } from './dynastyRatings';
export type { MatchContext, Development } from './dynastyRatings';
export {
  STYLES, MENTALITIES, FIT, tacticDeltas, posFit, canFill, slotAccepts, benchCover,
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
