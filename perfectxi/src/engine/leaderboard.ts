import { ENGINE_VERSION } from './version';
import { mulberry32 } from './rng';
import { newDraft, place, spin, chemBonus } from './draft';
import { simulateSeason } from './sim';
import type { DraftConfig, Pick } from './types';

/**
 * Proving a submitted run was really played.
 *
 * A leaderboard that trusts the number a phone sends it is not a
 * leaderboard, it is a text box. Anyone who can read the network traffic
 * can put themselves top and stay there, and one person doing it makes
 * the whole board worthless to everybody else.
 *
 * This is why the engine imports nothing from React. The same code runs
 * on the phone that played the run and on the server that checks it, so
 * there is exactly one definition of what a season does, and no chance
 * of the two drifting into disagreeing about an honest player's score.
 *
 * What makes it possible: a seed and a config fully determine the club
 * seasons a draft offers, in order. Which players appear on a board
 * depends only on who has already been taken. So a seed, a config and
 * the eleven picks in the order they were made replay the entire run,
 * spin for spin, and produce exactly one possible final table.
 *
 * That means a submission cannot lie about any of:
 *
 *   the score, because the season is simulated here rather than read
 *   the players, because their ratings come from this database, not the
 *     submission
 *   who was available, because a pick that was never on the board it
 *     claims to be from is refused
 *   the rules, because the config is derived from the puzzle number and
 *     not sent by the phone at all
 *
 * What it deliberately does not do is decide whether somebody is allowed
 * on the board. That is the caller's business, and it is a different
 * question from whether the run is real.
 */

/** One decision, in the order it was made. */
export type SubmittedPick = {
  /** the player's name, resolved against this database rather than trusted */
  name: string;
  /** which slot in the formation they filled */
  slot: number;
  /**
   * How many boards were rerolled away immediately before this pick.
   *
   * A reroll does not refund a pick, it replaces the board. Each one
   * consumes a spin, so the replay has to spend them in the same places
   * or every board after the first reroll is a different one.
   */
  rerolls: number;
};

/** What a phone sends when it has finished a run worth ranking. */
export type Submission = {
  /** which board this is for, for example 'daily-1263' */
  board: string;
  /** the build that played it */
  engine: number;
  /** a random id made on the device, identifying nobody */
  player: string;
  /** the only thing another player ever sees */
  handle: string;
  picks: SubmittedPick[];
  /** what the phone says it scored, checked against what it must have */
  claim: { pts: number; gf: number; ga: number };
};

export type Verdict =
  | { ok: true; pts: number; gf: number; ga: number; rating: number }
  | { ok: false; why: string };

/** Every way a submission can be refused, so the caller can count them. */
export const REFUSALS = [
  'engine',
  'shape',
  'rerolls',
  'no board',
  'not offered',
  'illegal slot',
  'incomplete',
  'score',
] as const;

/**
 * Replay a submission against the puzzle it claims to be from.
 *
 * `seed` and `config` come from the board's own definition, worked out
 * by the caller from the puzzle number. They are never taken from the
 * submission: a phone that could choose its own config could choose an
 * easy one.
 */
export function verifySubmission(
  sub: Submission,
  seed: number,
  config: DraftConfig,
): Verdict {
  /*
   * The engine version first.
   *
   * Two builds can disagree about a season without either being wrong,
   * so a run played on one and checked by another is not evidence of
   * cheating, it is evidence of an update. Refusing it by name means an
   * honest player gets told to update rather than accused.
   */
  if (sub.engine !== ENGINE_VERSION) {
    return { ok: false, why: 'engine' };
  }

  let state = newDraft(config);

  if (!Array.isArray(sub.picks) || sub.picks.length !== state.total) {
    return { ok: false, why: 'shape' };
  }

  /* The allowance comes from the config, which comes from the puzzle
     number, so it cannot be passed in wrongly by a caller. */
  const totalRerolls = sub.picks.reduce((a, p) => a + (p.rerolls || 0), 0);
  if (totalRerolls < 0 || totalRerolls > state.rerollsMax) {
    return { ok: false, why: 'rerolls' };
  }

  const rnd = mulberry32(seed);

  for (const p of sub.picks) {
    /* the boards thrown away, which still cost a spin each */
    for (let i = 0; i < (p.rerolls || 0); i++) {
      if (!spin(state, rnd)) return { ok: false, why: 'no board' };
    }

    const offered = spin(state, rnd);
    if (!offered) return { ok: false, why: 'no board' };

    /*
     * The player is found on the board rather than taken from the
     * submission, so a rating sent from a phone is never used for
     * anything. If the name is not on the board this run did not happen.
     */
    const chosen: Pick | undefined = offered.board.find((c) => c.n === p.name);
    if (!chosen) return { ok: false, why: 'not offered' };

    const next = place(state, chosen, p.slot);
    /* place refuses a filled slot or a position that cannot hold them */
    if (next === state) return { ok: false, why: 'illegal slot' };
    state = next;
  }

  if (state.filled !== state.total) return { ok: false, why: 'incomplete' };

  const result = simulateSeason(
    state.squad,
    config.formation,
    chemBonus(state.squad),
    rnd,
  );

  const you = result.table.find((r) => r.isYou);
  if (!you) return { ok: false, why: 'incomplete' };

  /*
   * Exact, not near enough.
   *
   * Every number here came out of the same arithmetic on both sides, so
   * anything but an exact match means the run was not the run.
   */
  if (you.pts !== sub.claim.pts || you.gf !== sub.claim.gf || you.ga !== sub.claim.ga) {
    return { ok: false, why: 'score' };
  }

  const rating = Math.round(
    state.squad.reduce((a, s) => a + (s.player ? s.player.rtg : 0), 0) / state.total,
  );

  return { ok: true, pts: you.pts, gf: you.gf, ga: you.ga, rating };
}
