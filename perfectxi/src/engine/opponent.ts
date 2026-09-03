import { canPlay, newDraft, place, slotsForPlayer, spin, squadAvg } from './draft';
import { mulberry32, type Rng } from './rng';
import type { DraftState } from './draft';
import type { DraftConfig, Pick, Slot } from './types';

/**
 * The opponent in a live duel.
 *
 * A duel is two people drafting the same spin sequence at the same time.
 * That works because the sequence comes from the seed and nothing else:
 * spinning consumes exactly two draws whatever is already in your XI, so
 * both of you see the same club and the same season on spin seven, and
 * the only difference between your board and theirs is the players each
 * of you has already taken off it.
 *
 * Which is why a bot is not a lesser version of a live duel. It drafts
 * the identical sequence on its own copy of the generator, at its own
 * pace, without ever seeing what you are doing, and so does a person.
 * The only thing a real opponent changes is where the picks come from.
 *
 * So this produces the whole of an opponent's draft up front, with the
 * time each pick landed, and the screen reveals it against the clock.
 * Nothing here touches React, the network or the wall clock, which is
 * what lets every word of it be checked headlessly and what will let a
 * real opponent's picks arrive through exactly the same shape.
 */

/**
 * Who you are drafting against.
 *
 * The names are ordinary rather than jokes, because the point of a live
 * duel is that it feels like somebody else is in it. A person called
 * `RyanK_88` reads as a person; one called `BotMaster3000` reads as the
 * thing the game does when nobody is about.
 */
const HANDLES: readonly string[] = [
  'RyanK_88', 'thefinalthird', 'AmaraO', 'gaffer_92', 'NineteenNinety8',
  'JLM', 'boot_room', 'Kez', 'stoppage_time', 'DannyR',
  'oldtrafford_ollie', 'anfieldrose', 'SixYardBox', 'TheoM', 'wingback',
  'PriyaS', 'northbank', 'goalline', 'MattyB', 'set_piece',
  'kop_end', 'lastdefender', 'ZaraH', 'onetouch', 'TommyF',
  'the_invincible', 'holdingmid', 'CalumW', 'far_post', 'NaomiA',
];

/**
 * What an opponent is called, drawn from the seed so a duel replays.
 *
 * The seed is hashed rather than taken modulo the list, because seeds
 * that march in step, which is what a test and a run of duels started in
 * the same minute both produce, would otherwise meet the same ten people
 * over and over.
 */
export function handleFor(seed: number): string {
  let h = (seed ^ 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x2545f491) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2d) >>> 0;
  return HANDLES[(h ^ (h >>> 16)) % HANDLES.length];
}

export type BotPick = {
  /** which spin it came from, counting from one */
  spin: number;
  player: Pick;
  /** the place in the XI it filled */
  slot: number;
  /** how long after the draft opened it landed, in milliseconds */
  at: number;
};

export type Opponent = {
  name: string;
  /** 0 to 1, where 1 always takes the best player on the board */
  skill: number;
  picks: BotPick[];
  squad: Slot[];
  /** what the finished XI is rated */
  rating: number;
  /** how long the whole draft took, in milliseconds */
  took: number;
  /** true when nobody was found and the game filled the other chair */
  bot: boolean;
};

/**
 * How good the opponent is.
 *
 * Not a difficulty setting. A live duel should feel like a duel against
 * a person who is roughly as good as you, so the skill is drawn around
 * three quarters: it usually takes the best player on the board and
 * sometimes takes the second or third, which is what people do.
 *
 * A skill of one is not wanted. An opponent who never makes a mistake is
 * not an opponent, it is a wall, and losing to it teaches nothing.
 */
export const SKILL_LOW = 0.55;
export const SKILL_HIGH = 0.92;

/** How long a person looks at a board before taking somebody. */
const THINK_MIN = 1400;
const THINK_MAX = 5200;
/** And how long they spin again without taking anybody. */
const PASS_MIN = 700;
const PASS_MAX = 1900;

function between(rnd: Rng, lo: number, hi: number): number {
  return lo + rnd() * (hi - lo);
}

/**
 * Draft the other XI.
 *
 * The spins come from `mulberry32(seed)`, which is the same generator the
 * run itself uses, so the opponent sees the same clubs in the same order
 * as you do. Every other draw comes from a second generator, so how good
 * the opponent is and how long it takes cannot move the sequence by a
 * single club.
 */
export function draftOpponent(args: {
  config: DraftConfig;
  seed: number;
  /** left out to draw one from the seed */
  skill?: number;
  name?: string;
  bot?: boolean;
}): Opponent {
  const { config, seed } = args;
  const spins = mulberry32(seed >>> 0);
  const mind = mulberry32((seed ^ 0x9e3779b9) >>> 0);

  const skill = args.skill ?? between(mind, SKILL_LOW, SKILL_HIGH);
  const name = args.name ?? handleFor(seed);

  let state: DraftState = newDraft(config);
  const picks: BotPick[] = [];
  let at = 0;
  let n = 0;
  let guard = 0;

  while (state.filled < state.total && guard++ < 400) {
    const result = spin(state, spins);
    if (!result) break;
    n++;

    /* Blitz shows the top three and nothing else, and the opponent plays
       by the same rule you do or the duel is not a duel. */
    const board = config.blitz ? result.board.slice(0, 3) : result.board;
    const playable = board.filter((p) => canPlay(state, p) && slotsForPlayer(state, p).length);
    if (!playable.length) {
      at += between(mind, PASS_MIN, PASS_MAX);
      continue;
    }

    /* Usually the best man on the board. Sometimes not, because a person
       takes the striker they remember over the full back they need, and
       an opponent who never does that is not a person. */
    const near = playable.slice(0, 3);
    const choice =
      mind() < skill ? playable[0] : near[Math.floor(mind() * near.length)] ?? playable[0];

    const slots = slotsForPlayer(state, choice);
    const slot = slots[0];
    state = place(state, choice, slot);

    /* A good board takes longer to look at, because there is something to
       think about on it. */
    const dwell = between(mind, THINK_MIN, THINK_MAX) * (playable.length > 6 ? 1.15 : 0.9);
    at += dwell;
    picks.push({ spin: n, player: choice, slot, at: Math.round(at) });
  }

  const squad = state.squad;
  return {
    name,
    skill: Math.round(skill * 100) / 100,
    picks,
    squad,
    rating: Math.round(squadAvg(squad)),
    took: Math.round(at),
    bot: args.bot ?? true,
  };
}

/**
 * How many of their picks have landed by now.
 *
 * The whole draft is worked out before either of you has spun once, and
 * the screen simply reads off it. That is the point: no timers holding
 * state, no way for the opponent to be in two places at once, and a duel
 * that replays exactly from its seed if it ever has to be checked.
 */
export function landedBy(opponent: Opponent, elapsed: number): BotPick[] {
  const out: BotPick[] = [];
  for (const p of opponent.picks) {
    if (p.at > elapsed) break;
    out.push(p);
  }
  return out;
}

/** Their XI as far as it has got, for the strip along the top. */
export function partialSquad(opponent: Opponent, elapsed: number): (Pick | null)[] {
  const done = landedBy(opponent, elapsed);
  const squad: (Pick | null)[] = opponent.squad.map(() => null);
  for (const p of done) squad[p.slot] = p.player;
  return squad;
}

/** True once they have finished and are waiting on you. */
export function opponentDone(opponent: Opponent, elapsed: number): boolean {
  return elapsed >= opponent.took && opponent.picks.length >= opponent.squad.length;
}
