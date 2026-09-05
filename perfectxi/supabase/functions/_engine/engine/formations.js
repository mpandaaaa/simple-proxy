export const FORMATIONS = {
    '4-3-3': { desc: 'Attacking with width. Three forwards create constant threat.', att: 1.08, def: 1.0, rows: [['GK'], ['DEF', 'DEF', 'DEF', 'DEF'], ['MID', 'MID', 'MID'], ['ATT', 'ATT', 'ATT']] },
    '4-4-2': { desc: 'Classic and balanced. Two strikers, solid in all areas.', att: 1.0, def: 1.0, rows: [['GK'], ['DEF', 'DEF', 'DEF', 'DEF'], ['MID', 'MID', 'MID', 'MID'], ['ATT', 'ATT']] },
    '4-2-3-1': { desc: 'Double pivot for security; a creative hub behind the striker.', att: 1.02, def: 1.08, rows: [['GK'], ['DEF', 'DEF', 'DEF', 'DEF'], ['MID', 'MID'], ['MID', 'MID', 'MID'], ['ATT']] },
    '4-5-1': { desc: 'Midfield dominance. Compact, defensive, hard to break down.', att: 0.88, def: 1.12, rows: [['GK'], ['DEF', 'DEF', 'DEF', 'DEF'], ['MID', 'MID', 'MID', 'MID', 'MID'], ['ATT']] },
    '3-4-3': { desc: 'Ultra-attacking. Loads of forwards, but exposed at the back.', att: 1.15, def: 0.85, rows: [['GK'], ['DEF', 'DEF', 'DEF'], ['DEF', 'MID', 'MID', 'DEF'], ['ATT', 'ATT', 'ATT']] },
    '3-5-2': { desc: 'Midfield control with wing-backs providing width.', att: 1.05, def: 1.05, rows: [['GK'], ['DEF', 'DEF', 'DEF'], ['DEF', 'MID', 'MID', 'MID', 'DEF'], ['ATT', 'ATT']] },
    '5-4-1': { desc: 'Defensive fortress. Five at the back, lethal on the counter.', att: 0.8, def: 1.2, rows: [['GK'], ['DEF', 'DEF', 'DEF', 'DEF', 'DEF'], ['MID', 'MID', 'MID', 'MID'], ['ATT']] },
    '5-3-2': { desc: 'Two banks of five. Incredibly solid, dangerous on the break.', att: 0.88, def: 1.22, rows: [['GK'], ['DEF', 'DEF', 'DEF', 'DEF', 'DEF'], ['MID', 'MID', 'MID'], ['ATT', 'ATT']] },
    '4-2-4': { desc: 'All-out attack. Four forwards, two holding midfielders.', att: 1.28, def: 0.78, rows: [['GK'], ['DEF', 'DEF', 'DEF', 'DEF'], ['MID', 'MID'], ['ATT', 'ATT', 'ATT', 'ATT']] },
    '4-1-4-1': { desc: 'Single striker, packed midfield. Hard to break down, clinical on the counter.', att: 0.84, def: 1.1, rows: [['GK'], ['DEF', 'DEF', 'DEF', 'DEF'], ['MID'], ['MID', 'MID', 'MID', 'MID'], ['ATT']] },
    '3-4-2-1': { desc: 'Three defenders, two playmakers behind a lone striker.', att: 1.0, def: 0.92, rows: [['GK'], ['DEF', 'DEF', 'DEF'], ['MID', 'MID', 'MID', 'MID'], ['ATT', 'ATT'], ['ATT']] },
    '4-3-1-2': { desc: 'The Christmas Tree. Playmaker feeds two pacey strikers.', att: 1.1, def: 1.02, rows: [['GK'], ['DEF', 'DEF', 'DEF', 'DEF'], ['MID', 'MID', 'MID'], ['ATT'], ['ATT', 'ATT']] },
};
export const FORMATION_NAMES = Object.keys(FORMATIONS);
export const POSITION_LABEL = {
    GK: 'Goalkeeper',
    DEF: 'Defender',
    MID: 'Midfielder',
    ATT: 'Attacker',
};
/**
 * Which formation buckets a database position can fill.
 *
 * The database records real positions (LWB, CAM, RW and so on) while a
 * formation only has four buckets, so this is the map between them. Wide
 * forwards can drop into midfield and attacking midfielders can push up,
 * which is what makes a board playable rather than a lottery.
 */
export function posGroups(pos) {
    switch (pos) {
        case 'GK':
            return ['GK'];
        case 'DEF':
        case 'CB':
        case 'LCB':
        case 'RCB':
        case 'SW':
            return ['DEF'];
        case 'LB':
        case 'RB':
        case 'LWB':
        case 'RWB':
        case 'WB':
            return ['DEF'];
        case 'MID':
        case 'CM':
        case 'CDM':
        case 'DM':
        case 'LCM':
        case 'RCM':
            return ['MID'];
        case 'CAM':
        case 'AM':
        case 'LM':
        case 'RM':
            return ['MID', 'ATT'];
        case 'LW':
        case 'RW':
        case 'LF':
        case 'RF':
            return ['ATT', 'MID'];
        case 'ATT':
        case 'ST':
        case 'CF':
        case 'SS':
        case 'FW':
            return ['ATT'];
        default:
            return [];
    }
}
/** True if any of a player's positions can fill this formation slot. */
export function posCompat(playerPos, slot) {
    if (!playerPos)
        return false;
    for (const p of playerPos) {
        if (p === slot)
            return true;
        if (posGroups(p).indexOf(slot) > -1)
            return true;
    }
    return false;
}
/** The eleven empty slots of a formation, in the order they are drawn. */
export function slotsFor(formation) {
    const fm = FORMATIONS[formation];
    if (!fm)
        throw new Error(`unknown formation: ${formation}`);
    const slots = [];
    for (const row of fm.rows) {
        for (const pos of row)
            slots.push({ pos, player: null });
    }
    return slots;
}
