/**
 * Builds realistic test XIs from the real database: each slot is filled by
 * a player from a random club-season, preferring one who plays that
 * position, with the club and season attached the way the draft does it.
 */
import squads from '../../src/data/squads.json';
import league from '../../src/data/league.json';
import { mulberry32, type Rng } from '../../src/engine/rng';
import type { Player, Position, Slot } from '../../src/engine/types';

const DB = squads as unknown as Record<string, Player[]>;
const KEYS = Object.keys(DB);
export const FORMATION_NAMES = Object.keys(league.FM);

export function randomSquad(rnd: Rng, formation: string): Slot[] {
  const rows = (league.FM as Record<string, { rows: string[][] }>)[formation].rows;
  const out: Slot[] = [];
  const used = new Set<string>();
  for (const row of rows)
    for (const pos of row as Position[]) {
      for (let attempt = 0; attempt < 50; attempt++) {
        const key = KEYS[Math.floor(rnd() * KEYS.length)];
        const pool = DB[key].filter((p) => p.pos.includes(pos) && !used.has(p.n));
        const any = DB[key].filter((p) => !used.has(p.n));
        const list = pool.length ? pool : attempt > 40 ? any : [];
        if (!list.length) continue;
        const p = list[Math.floor(rnd() * list.length)];
        const [club, season] = key.split('|');
        used.add(p.n);
        out.push({ pos, player: { ...p, club, season } });
        break;
      }
    }
  return out;
}

export function testCases(n: number, seed = 20261107) {
  const rnd = mulberry32(seed);
  const cases = [];
  for (let i = 0; i < n; i++) {
    const formation = FORMATION_NAMES[Math.floor(rnd() * FORMATION_NAMES.length)];
    cases.push({
      formation,
      squad: randomSquad(rnd, formation),
      seed: Math.floor(rnd() * 2147483647),
      ascHostile: rnd() < 0.2,
    });
  }
  return cases;
}

/**
 * A realistic Prime Mode draft: each slot spins a random club-season and
 * takes its best available player for that position, at career-best
 * rating, with the club and season attached exactly as the web draft does.
 * `top` > 1 picks at random among the best few instead, like a casual player.
 */
export function draftXI(rnd: Rng, formation: string, top = 1): Slot[] {
  const rows = (league.FM as Record<string, { rows: string[][] }>)[formation].rows;
  const out: Slot[] = [];
  const used = new Set<string>();
  for (const row of rows)
    for (const pos of row as Position[]) {
      const key = KEYS[Math.floor(rnd() * KEYS.length)];
      const [club, season] = key.split('|');
      const board = DB[key]
        .filter((p) => !used.has(p.n))
        .map((p) => ({ ...p, rtg: p.prime ?? p.rtg, club, season }))
        .sort((a, b) => b.rtg - a.rtg);
      const fit = board.filter((p) => p.pos.includes(pos));
      const list = fit.length ? fit : board;
      const p = list[Math.floor(rnd() * Math.min(top, list.length))];
      used.add(p.n);
      out.push({ pos, player: p });
    }
  return out;
}
