/**
 * How good an XI is, ported unchanged from the web game.
 */
import type { Position, Squad } from './types';

/** Average rating of filled slots, optionally only some positions. */
export function squadAvg(squad: Squad, filter?: (pos: Position) => boolean): number {
  const pl = squad.filter((s) => s.player && (!filter || filter(s.pos)));
  if (!pl.length) return 0;
  let sum = 0;
  for (let i = 0; i < pl.length; i++) sum += pl[i].player!.rtg;
  return sum / pl.length;
}

/** Average rating to a 0.30 to 0.97 strength used by the match model. */
export function strFromAvg(avg: number): number {
  return Math.max(0.3, Math.min(0.97, (avg - 65) / 24));
}

/**
 * Squad chemistry, 0 to 100. Each player earns up to three links: a team
 * mate from the same club, or failing that from the same season.
 */
export function squadChemistry(squad: Squad): number {
  const pl = squad.filter((s) => s.player).map((s) => s.player!);
  if (pl.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < pl.length; i++) {
    let links = 0;
    for (let j = 0; j < pl.length; j++) {
      if (i === j) continue;
      if (pl[i].club && pl[i].club === pl[j].club) links++;
      else if (pl[i].season && pl[i].season === pl[j].season) links++;
      if (links >= 3) break;
    }
    total += Math.min(3, links);
  }
  return Math.round((total / (3 * pl.length)) * 100);
}

/** Chemistry is worth up to three rating points. */
export function chemBonus(squad: Squad): number {
  return Math.min(3, squadChemistry(squad) / 33);
}

/** The strength the match model actually uses for this XI. */
export function squadStrength(squad: Squad): number {
  return strFromAvg(squadAvg(squad) + chemBonus(squad));
}

export type Odds = {
  winPct: number;
  top4: number;
  top6: number;
  top10: number;
  rel: number;
  expPts: number;
  projFinish: number;
};

/** Pre-season odds card. `avg` is the raw average; chemistry is added here. */
export function calcOdds(avg: number, squad: Squad): Odds {
  const str = strFromAvg(avg + chemBonus(squad));
  const winPct = Math.max(0.3, Math.min(80, str * str * 92 - 3));
  const top4 = Math.max(2, Math.min(99.5, str * str * 80 + str * 25 - 4));
  const top6 = Math.max(6, Math.min(99.8, str * str * 60 + str * 48 - 2));
  const top10 = Math.max(20, Math.min(100, str * 55 + str * 48 + 4));
  const rel = Math.max(0, Math.min(60, 55 - str * 78));
  const expPts = Math.round(18 + str * 82);
  const projFinish = Math.max(1, Math.min(20, Math.round(20.5 - str * 19.5)));
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return { winPct: r1(winPct), top4: r1(top4), top6: r1(top6), top10: r1(top10), rel: r1(rel), expPts, projFinish };
}
