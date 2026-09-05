/**
 * What people are called.
 *
 * Every player gets a handle the first time the phone needs one, and so
 * does the Machine when it takes the other chair. Both come off this
 * list, on purpose: the point of a duel is that somebody is in it, and a
 * stand in called `BotMaster3000` announces itself as the thing the game
 * does when nobody is about.
 *
 * Ordinary names, of the kind that are actually on a five a side team
 * sheet. Nothing here identifies anybody: a handle is drawn from a
 * random number made on the device and means nothing beyond it.
 */
const HANDLES = [
    'RyanK_88', 'thefinalthird', 'AmaraO', 'gaffer_92', 'NineteenNinety8',
    'JLM', 'boot_room', 'Kez', 'stoppage_time', 'DannyR',
    'oldtrafford_ollie', 'anfieldrose', 'SixYardBox', 'TheoM', 'wingback',
    'PriyaS', 'northbank', 'goalline', 'MattyB', 'set_piece',
    'kop_end', 'lastdefender', 'ZaraH', 'onetouch', 'TommyF',
    'the_invincible', 'holdingmid', 'CalumW', 'far_post', 'NaomiA',
    'RashidM', 'the_gegenpress', 'JoeyT', 'backpost', 'EllieW',
    'sundayleague', 'OwenP', 'thederby', 'KwameA', 'targetman',
];
/**
 * A handle from a number.
 *
 * The number is hashed rather than taken modulo the list, because
 * numbers that march in step, which is what a run of duels started in
 * the same minute produces, would otherwise meet the same few people
 * over and over.
 */
export function handleFor(seed) {
    let h = (seed ^ 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x2545f491) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0x27d4eb2d) >>> 0;
    return HANDLES[(h ^ (h >>> 16)) % HANDLES.length];
}
