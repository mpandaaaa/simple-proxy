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

export { simulateCups, NATIONAL_CLUBS, CONTINENTAL_CLUBS } from './cups';
export type { Cups, CupRun, CupTie, CupClub } from './cups';
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
