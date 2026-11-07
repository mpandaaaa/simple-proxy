/**
 * Dixon-Coles match model (Dixon and Coles 1997, JRSS-C 46:265-280).
 *
 *   lambda = exp(c + att_home + def_away + gamma)
 *   gamma = 0.27 home advantage (about 1.31x), tau corrects low scores, rho = -0.13
 *
 * Ported unchanged from the web game. These constants are tuned: 2.75 goals
 * a game, champions near 90 points. Do not touch them here; the golden
 * tests will fail if anything moves.
 */
import type { Rng } from '../rng';

export const DC = { GAMMA: 0.27, RHO: -0.13, BASE: 0.13 } as const;

/** Formation multipliers on attack and defence, from the FM table. */
export type FormationMod = { att?: number; def?: number } | null | undefined;

/** Log-space tactical adjustments, from an active Dynasty. Zero otherwise. */
export type TacticalDeltas = { att: number; def: number; oppAtt: number };
export const NO_TACTICS: TacticalDeltas = { att: 0, def: 0, oppAtt: 0 };

export function dcTau(x: number, y: number, l: number, m: number, rho: number): number {
  if (x === 0 && y === 0) return 1 - l * m * rho;
  if (x === 0 && y === 1) return 1 + l * rho;
  if (x === 1 && y === 0) return 1 + m * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

export function dcPois(k: number, lam: number): number {
  let p = Math.exp(-lam);
  for (let i = 1; i <= k; i++) p *= lam / i;
  return p;
}

/** Strength (0.30 to 0.97) to attack and defence on the log scale. */
export function dcParams(str: number, fmod: FormationMod): { att: number; def: number } {
  const s = Math.max(0.2, Math.min(0.99, str));
  const att = (s - 0.62) * 2.15 + Math.log(fmod && fmod.att ? fmod.att : 1);
  const def = -(s - 0.62) * 2.0 - Math.log(fmod && fmod.def ? fmod.def : 1);
  return { att, def };
}

export function dcMatrix(lam: number, mu: number, rho: number): number[][] {
  const MAXG = 9;
  const rows: number[][] = [];
  let tot = 0;
  for (let x = 0; x <= MAXG; x++) {
    rows[x] = [];
    for (let y = 0; y <= MAXG; y++) {
      let p = dcTau(x, y, lam, mu, rho) * dcPois(x, lam) * dcPois(y, mu);
      if (p < 0) p = 0;
      rows[x][y] = p;
      tot += p;
    }
  }
  if (tot > 0) for (let x = 0; x <= MAXG; x++) for (let y = 0; y <= MAXG; y++) rows[x][y] /= tot;
  return rows;
}

/** Draw a scoreline. Consumes exactly one random number. */
export function dcDraw(lam: number, mu: number, rho: number, rnd: Rng): { gf: number; ga: number } {
  const m = dcMatrix(lam, mu, rho);
  const r = rnd();
  let cum = 0;
  for (let x = 0; x < m.length; x++)
    for (let y = 0; y < m[x].length; y++) {
      cum += m[x][y];
      if (r <= cum) return { gf: x, ga: y };
    }
  return { gf: 1, ga: 1 };
}

/** Expected goals for and against. */
export function dcExpected(
  myStr: number,
  oppStr: number,
  isHome: boolean,
  fmod: FormationMod,
  td: TacticalDeltas = NO_TACTICS,
): { lam: number; mu: number } {
  const me = dcParams(myStr, fmod);
  const op = dcParams(oppStr, null);
  const lam = Math.exp(DC.BASE + me.att + td.att + op.def + (isHome ? DC.GAMMA : 0));
  const mu = Math.exp(DC.BASE + op.att + td.oppAtt + me.def + td.def + (isHome ? 0 : DC.GAMMA));
  return { lam: Math.max(0.12, Math.min(6, lam)), mu: Math.max(0.12, Math.min(6, mu)) };
}
