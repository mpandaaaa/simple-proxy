import { FORMATIONS } from './formations';
import type { Position } from './types';
import type { Dynasty, Tactic } from './dynasty';
import { bench, starters } from './dynasty';

/**
 * Tactics.
 *
 * Every control is an additive delta in log space, so the effects compound
 * multiplicatively on lambda and lambda can never go negative. Ported
 * unchanged from the web build.
 *
 * The rule that makes it a decision rather than a slider: attacking raises
 * the goals at both ends by the same coefficient. There is no free lunch.
 * Attacking helps a strong squad because it scores more than it concedes,
 * and hurts a weak one for the same reason.
 */

export type StyleId = 'possession' | 'balanced' | 'direct';

export const STYLES: Record<
  StyleId,
  { title: string; desc: string; att: number; def: number; scale: number; varr: number }
> = {
  possession: {
    title: 'Possession',
    desc: 'Control the ball. Devastating with a strong squad, suicidal with a weak one.',
    att: 0,
    def: 0,
    scale: 1,
    varr: -0.15,
  },
  balanced: {
    title: 'Balanced',
    desc: 'No strong bias. Reliable whoever you have.',
    att: 0.012,
    def: -0.012,
    scale: 0,
    varr: 0,
  },
  direct: {
    title: 'Counter',
    desc: 'Sit deep and break fast. The underdog’s weapon.',
    att: 0,
    def: 0,
    scale: -1,
    varr: 0.3,
  },
};

export const MENTALITIES = [
  'Defensive',
  'Cautious',
  'Balanced',
  'Positive',
  'Attacking',
] as const;

export type TacticDeltas = {
  att: number;
  def: number;
  oppAtt: number;
  varr: number;
  fam: number;
};

/**
 * What the tactics are worth, in log space.
 *
 * A style pays off relative to squad quality. Possession needs good
 * players to be worth anything; counter attacking is what you use when
 * you have not got them, and it falls away as you improve.
 */
export function tacticDeltas(t: Tactic, strength: number): TacticDeltas {
  const st = STYLES[t.style] ?? STYLES.balanced;
  const edge = (strength - 0.62) * 1.9;
  const sm = st.scale * edge;

  let att = 0.065 * t.mentality + st.att + sm * 0.13 + 0.03 * t.press + 0.02 * t.line;
  const def = st.def - sm * 0.11;
  const oppAtt = 0.065 * t.mentality + 0.035 * t.press + 0.04 * t.line;
  const varr = st.varr + 0.1 * Math.abs(t.tempo);

  // A shape the squad does not know yet underperforms until they learn it.
  const fam = Math.max(0.85, Math.min(1, t.fam));
  att *= fam;

  const shape = FORMATIONS[t.form] ?? FORMATIONS['4-3-3'];
  att += Math.log(shape.att || 1) * 0.6;

  return { att, def: def - Math.log(shape.def || 1) * 0.6, oppAtt, varr, fam };
}

/**
 * What a place on the pitch is called.
 *
 * "Playing at mid" is a slot name leaking onto the screen. He is playing
 * in midfield.
 */
export function placeName(pos: Position): string {
  return pos === 'GK'
    ? 'in goal'
    : pos === 'DEF'
      ? 'in defence'
      : pos === 'MID'
        ? 'in midfield'
        : 'in attack';
}

/** How well a player suits the place he is being asked to fill. */
export const FIT = { exact: 1.0, near: 0.94, far: 0.82, keeper: 0.5 } as const;

const NEAR: Record<Position, Position[]> = {
  GK: [],
  DEF: ['MID'],
  MID: ['DEF', 'ATT'],
  ATT: ['MID'],
};

/**
 * Can this player fill this place at all?
 *
 * A striker at centre back is a bad decision. A goalkeeper at centre back
 * is not a decision, it is a bug, and so is an outfield player in goal.
 * Nothing in the app may offer either, so every place that takes a player
 * asks this first.
 */
export function canFill(playerPos: Position, slotPos: Position): boolean {
  return (playerPos === 'GK') === (slotPos === 'GK');
}

/**
 * The same question for a real place in the squad.
 *
 * The three places on the bench take anybody, because a bench with no
 * room for a reserve keeper is not a bench. The eleven are strict.
 */
export function slotAccepts(d: Dynasty, index: number, pos: Position): boolean {
  if (index >= 11) return true;
  return canFill(pos, d.slots[index] ?? pos);
}

export function posFit(playerPos: Position, slotPos: Position): number {
  if (playerPos === slotPos) return FIT.exact;
  // Nothing should reach this, but an old career saved before the rule
  // existed still has to load and still has to be honest about the cost.
  if (!canFill(playerPos, slotPos)) return FIT.keeper;
  return NEAR[slotPos].includes(playerPos) ? FIT.near : FIT.far;
}

/**
 * What the bench is actually worth.
 *
 * Depth is insurance, not free rating. A better bench than starting eleven
 * counts for nothing until somebody is missing, and it is capped at 2.2
 * so a strong bench can never carry a weak XI.
 */
export function benchCover(d: Dynasty): number {
  const b = bench(d);
  if (!b.length) return 0;
  const q = b.reduce((a, p) => a + p.rtg, 0) / b.length;
  const xi = starters(d);
  const sq = xi.length ? xi.reduce((a, p) => a + p.rtg, 0) / xi.length : 70;
  const injured = d.injuries.length;
  return Math.max(0, Math.min(2.2, ((q - sq + 12) / 12) * Math.min(3, injured) * 0.45));
}

/**
 * The rating the match engine should actually use.
 *
 * Every starter counted at how well he fits the place he is in, plus
 * whatever the bench is worth given who is injured. A striker at
 * centre back is a striker at centre back.
 */
export function effectiveRating(d: Dynasty): number {
  const shape = FORMATIONS[d.tactic.form] ?? FORMATIONS['4-3-3'];
  const slots: Position[] = [];
  for (const row of shape.rows) for (const p of row) slots.push(p);

  let total = 0;
  let n = 0;
  for (let i = 0; i < Math.min(d.roster.length, 11); i++) {
    const p = d.roster[i];
    if (!p) continue;
    total += p.rtg * posFit(p.pos, slots[i] ?? d.slots[i] ?? p.pos);
    n++;
  }
  return (n ? total / n : 0) + benchCover(d);
}

/** How many players are out of position, for the tactics screen to say so. */
export function misfits(d: Dynasty): { name: string; from: Position; to: Position }[] {
  const shape = FORMATIONS[d.tactic.form] ?? FORMATIONS['4-3-3'];
  const slots: Position[] = [];
  for (const row of shape.rows) for (const p of row) slots.push(p);

  const out: { name: string; from: Position; to: Position }[] = [];
  for (let i = 0; i < Math.min(d.roster.length, 11); i++) {
    const p = d.roster[i];
    const want = slots[i] ?? d.slots[i];
    if (p && want && p.pos !== want) out.push({ name: p.n, from: p.pos, to: want });
  }
  return out;
}

/** Set pieces are 27.4% of goals, and a coach moves that. */
export function setPieceShare(d: Dynasty): number {
  return 0.274 * (0.85 + 0.06 * d.staff.setpiece);
}

/** Familiarity climbs with repetition and resets when the shape changes. */
export function learnTactic(t: Tactic): Tactic {
  return { ...t, fam: Math.min(1, t.fam + 0.035) };
}

export function changeShape(t: Tactic, form: string): Tactic {
  if (t.form === form) return t;
  return { ...t, form, fam: 0.86 };
}
