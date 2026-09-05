import { ENGINE_VERSION } from './version.js';
import { mulberry32 } from './rng.js';
import { newDraft, place, spin, chemBonus } from './draft.js';
import { simulateSeason } from './sim.js';
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
];
/**
 * Replay a submission against the puzzle it claims to be from.
 *
 * `seed` and `config` come from the board's own definition, worked out
 * by the caller from the puzzle number. They are never taken from the
 * submission: a phone that could choose its own config could choose an
 * easy one.
 */
export function verifySubmission(sub, seed, config) {
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
            if (!spin(state, rnd))
                return { ok: false, why: 'no board' };
        }
        const offered = spin(state, rnd);
        if (!offered)
            return { ok: false, why: 'no board' };
        /*
         * The player is found on the board rather than taken from the
         * submission, so a rating sent from a phone is never used for
         * anything. If the name is not on the board this run did not happen.
         */
        const chosen = offered.board.find((c) => c.n === p.name);
        if (!chosen)
            return { ok: false, why: 'not offered' };
        const next = place(state, chosen, p.slot);
        /* place refuses a filled slot or a position that cannot hold them */
        if (next === state)
            return { ok: false, why: 'illegal slot' };
        state = next;
    }
    if (state.filled !== state.total)
        return { ok: false, why: 'incomplete' };
    const result = simulateSeason(state.squad, config.formation, chemBonus(state.squad), rnd);
    const you = result.table.find((r) => r.isYou);
    if (!you)
        return { ok: false, why: 'incomplete' };
    /*
     * Exact, not near enough.
     *
     * Every number here came out of the same arithmetic on both sides, so
     * anything but an exact match means the run was not the run.
     */
    if (you.pts !== sub.claim.pts || you.gf !== sub.claim.gf || you.ga !== sub.claim.ga) {
        return { ok: false, why: 'score' };
    }
    const rating = Math.round(state.squad.reduce((a, s) => a + (s.player ? s.player.rtg : 0), 0) / state.total);
    return { ok: true, pts: you.pts, gf: you.gf, ga: you.ga, rating };
}
