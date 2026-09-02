import type { SeasonResult } from '../engine';

/**
 * The season just played, handed from the season screen to the summer.
 *
 * Outside React and outside navigation params, because it carries thirty
 * eight matches and every player's tally, and a native stack serialises
 * what it is given. Read once and dropped, so a summer cannot be reopened
 * from the back stack and processed twice.
 */

let result: SeasonResult | null = null;

export function setSeasonResult(r: SeasonResult): void {
  result = r;
}

export function takeSeasonResult(): SeasonResult | null {
  return result;
}

export function clearSeasonResult(): void {
  result = null;
}
