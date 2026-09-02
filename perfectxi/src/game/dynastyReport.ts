import type { AgeingReport } from '../engine';

/**
 * The ageing report, handed from the hub to the summer screen.
 *
 * Held outside React and outside navigation params: it carries whole
 * player objects, and a native stack serialises what it is given. It is
 * read once and dropped, so a summer cannot be reopened from the back
 * stack showing last year's departures.
 */

let report: AgeingReport | null = null;

export function setReport(r: AgeingReport): void {
  report = r;
}

export function takeReport(): AgeingReport | null {
  return report;
}

export function clearReport(): void {
  report = null;
}
