import { allKeepsakes } from './levels';

/**
 * What there is to own, and what it actually looks like.
 *
 * Three kinds, and every one of them is drawn by the app rather than
 * described by it. A shop that lists a thing the game does not render is
 * worse than a shop with three items in it, because the first time
 * somebody spends nine hundred coins and nothing changes, they stop
 * believing any of it.
 *
 *   Frames   the border and fill of a card in the collection
 *   Pitches  the turf the draft is played on
 *   Titles   the word beside your name, which is the only one of the
 *            three another player ever sees
 *
 * Nothing here changes a rating, a board, or a season. It is all paint.
 */

export type CosmeticKind = 'frame' | 'pitch' | 'title';

export type Cosmetic = {
  id: string;
  kind: CosmeticKind;
  name: string;
  blurb: string;
  /** what it costs in coins, or 0 when it only comes from a level */
  price: number;
  /** the level that grants it, or 0 when it is bought */
  level: number;
  /** what to draw. A frame and a pitch are colours; a title is a word. */
  a: string;
  b: string;
};

/**
 * The frames.
 *
 * `a` is the edge and `b` is the wash behind the card. They are picked to
 * stay legible on the dark ground the whole app uses, which is why none
 * of them is a pale fill: white text on parchment is unreadable here and
 * a frame nobody can read a name through is not a reward.
 */
const FRAMES: readonly Cosmetic[] = [
  { id: 'frame.plain', kind: 'frame', name: 'Plain', blurb: 'What everybody starts with.', price: 0, level: 1, a: 'rgba(255,255,255,0.14)', b: 'rgba(255,255,255,0.04)' },
  { id: 'frame.slate', kind: 'frame', name: 'Slate', blurb: 'Cold and quiet.', price: 0, level: 2, a: '#5B6B78', b: 'rgba(91,107,120,0.16)' },
  { id: 'frame.copper', kind: 'frame', name: 'Copper', blurb: 'Warm, and it shows its age.', price: 0, level: 6, a: '#B87333', b: 'rgba(184,115,51,0.16)' },
  { id: 'frame.chalk', kind: 'frame', name: 'Chalk', blurb: 'A line drawn on a board.', price: 0, level: 13, a: '#DCE6E0', b: 'rgba(220,230,224,0.1)' },
  { id: 'frame.gold', kind: 'frame', name: 'Gold', blurb: 'The one everybody wants first.', price: 0, level: 22, a: '#D6B25E', b: 'rgba(214,178,94,0.18)' },
  { id: 'frame.neon', kind: 'frame', name: 'Neon', blurb: 'A Tuesday night under the lights.', price: 0, level: 33, a: '#2FD4B6', b: 'rgba(47,212,182,0.18)' },
  { id: 'frame.icon', kind: 'frame', name: 'Icon', blurb: 'For the ones rated ninety and up.', price: 0, level: 46, a: '#B98CF2', b: 'rgba(185,140,242,0.2)' },
  { id: 'frame.perfect', kind: 'frame', name: 'Perfect XI', blurb: 'Level fifty. There is nothing after it.', price: 0, level: 50, a: '#1FC57E', b: 'rgba(31,197,126,0.22)' },

  /* bought */
  { id: 'frame.ink', kind: 'frame', name: 'Ink', blurb: 'Newsprint, the morning after.', price: 400, level: 0, a: '#8A93A8', b: 'rgba(138,147,168,0.14)' },
  { id: 'frame.rose', kind: 'frame', name: 'Rose', blurb: 'Loud, and it knows it.', price: 700, level: 0, a: '#F06A9A', b: 'rgba(240,106,154,0.16)' },
  { id: 'frame.amber', kind: 'frame', name: 'Amber', blurb: 'Late sun on an empty ground.', price: 700, level: 0, a: '#F5A524', b: 'rgba(245,165,36,0.16)' },
  { id: 'frame.pine', kind: 'frame', name: 'Pine', blurb: 'The colour the app was built in.', price: 1200, level: 0, a: '#2FD4B6', b: 'rgba(31,197,126,0.14)' },
  { id: 'frame.midnight', kind: 'frame', name: 'Midnight', blurb: 'Almost nothing at all.', price: 1600, level: 0, a: '#4CA0FF', b: 'rgba(76,160,255,0.14)' },
];

/**
 * The pitches.
 *
 * `a` is the turf and `b` is the mowing band that runs across it. Both
 * stay dark enough for a white shirt number to read on top, which is the
 * only real constraint: a pitch you cannot see your own XI on is not a
 * reward either.
 */
const PITCHES: readonly Cosmetic[] = [
  { id: 'pitch.grass', kind: 'pitch', name: 'Grass', blurb: 'A Saturday afternoon.', price: 0, level: 1, a: '#1F5A32', b: 'rgba(255,255,255,0.035)' },
  { id: 'pitch.floodlit', kind: 'pitch', name: 'Floodlit', blurb: 'Colder, brighter, and it is a Wednesday.', price: 0, level: 5, a: '#1B6440', b: 'rgba(255,255,255,0.055)' },
  { id: 'pitch.frost', kind: 'pitch', name: 'Frost', blurb: 'Boxing Day, and the ball skids.', price: 0, level: 11, a: '#26564A', b: 'rgba(210,235,255,0.06)' },
  { id: 'pitch.wembley', kind: 'pitch', name: 'Wembley', blurb: 'The one with the arch over it.', price: 0, level: 19, a: '#1A6B3A', b: 'rgba(255,255,255,0.07)' },
  { id: 'pitch.classic', kind: 'pitch', name: 'Nineties', blurb: 'Worn through by March, the way it used to be.', price: 0, level: 30, a: '#3A5A2C', b: 'rgba(190,170,120,0.07)' },
  { id: 'pitch.night', kind: 'pitch', name: 'Midnight', blurb: 'Nobody left in the ground.', price: 0, level: 43, a: '#123528', b: 'rgba(120,200,255,0.05)' },

  /* bought */
  { id: 'pitch.sand', kind: 'pitch', name: 'Deep Winter', blurb: 'More mud than grass.', price: 500, level: 0, a: '#4A4A2E', b: 'rgba(230,220,180,0.06)' },
  { id: 'pitch.emerald', kind: 'pitch', name: 'Emerald', blurb: 'Watered an hour before kick off.', price: 900, level: 0, a: '#136F45', b: 'rgba(255,255,255,0.08)' },
  { id: 'pitch.slate', kind: 'pitch', name: 'Training Ground', blurb: 'No crowd, no cameras.', price: 900, level: 0, a: '#2A4038', b: 'rgba(255,255,255,0.04)' },
  { id: 'pitch.violet', kind: 'pitch', name: 'Under Lights', blurb: 'Purple on the far touchline.', price: 1500, level: 0, a: '#2C2A55', b: 'rgba(185,140,242,0.07)' },
];

/**
 * The titles.
 *
 * The only cosmetic anybody else sees, because it goes beside your name
 * when you take somebody on. `a` is the colour it is drawn in.
 */
const TITLES: readonly Cosmetic[] = [
  { id: 'title.none', kind: 'title', name: 'No title', blurb: 'Just your name.', price: 0, level: 1, a: '#6E7E74', b: '' },
  { id: 'title.hopeful', kind: 'title', name: 'Hopeful', blurb: 'Four levels in.', price: 0, level: 4, a: '#A9B7AF', b: '' },
  { id: 'title.gaffer', kind: 'title', name: 'Gaffer', blurb: 'You have been at this a while.', price: 0, level: 8, a: '#4CA0FF', b: '' },
  { id: 'title.tactician', kind: 'title', name: 'Tactician', blurb: 'Fifteen levels of it.', price: 0, level: 15, a: '#2FD4B6', b: '' },
  { id: 'title.mastermind', kind: 'title', name: 'Mastermind', blurb: 'Twenty five.', price: 0, level: 25, a: '#B98CF2', b: '' },
  { id: 'title.legend', kind: 'title', name: 'Legend', blurb: 'Thirty six.', price: 0, level: 36, a: '#D6B25E', b: '' },
  { id: 'title.immortal', kind: 'title', name: 'Immortal', blurb: 'Forty eight. Almost nobody.', price: 0, level: 48, a: '#F06A9A', b: '' },

  /* bought */
  { id: 'title.collector', kind: 'title', name: 'The Collector', blurb: 'For somebody with a full shelf.', price: 1200, level: 0, a: '#F5A524', b: '' },
  { id: 'title.scout', kind: 'title', name: 'The Scout', blurb: 'Found them before anybody else did.', price: 800, level: 0, a: '#A6D74F', b: '' },
  { id: 'title.romantic', kind: 'title', name: 'The Romantic', blurb: 'Picks with the heart, every time.', price: 800, level: 0, a: '#F06A9A', b: '' },
  { id: 'title.archivist', kind: 'title', name: 'The Archivist', blurb: 'Knows what happened in 1994.', price: 1000, level: 0, a: '#8A93A8', b: '' },
  { id: 'title.perfectionist', kind: 'title', name: 'The Perfectionist', blurb: 'Nothing but the best of every board.', price: 2000, level: 0, a: '#1FC57E', b: '' },
];

export const COSMETICS: readonly Cosmetic[] = [...FRAMES, ...PITCHES, ...TITLES];

export function cosmeticById(id: string): Cosmetic | null {
  return COSMETICS.find((c) => c.id === id) ?? null;
}

export function cosmeticsOfKind(kind: CosmeticKind): Cosmetic[] {
  return COSMETICS.filter((c) => c.kind === kind);
}

/** What can be bought, which is everything a level does not hand over. */
export function forSale(): Cosmetic[] {
  return COSMETICS.filter((c) => c.price > 0);
}

/** What everybody has from the first second, before anything is earned. */
export const DEFAULTS = {
  frame: 'frame.plain',
  pitch: 'pitch.grass',
  title: 'title.none',
} as const;

/**
 * Whether a level has handed this over.
 *
 * Levels are the record. Nothing is stored when a level is reached, so
 * going back over old ground is impossible: reaching level twenty two is
 * owning the Gold frame, for as long as the save exists.
 */
export function unlockedByLevel(c: Cosmetic, level: number): boolean {
  return c.level > 0 && level >= c.level;
}

/**
 * Everything the level curve promises, matched against what exists.
 *
 * A level that hands over an id nothing draws is a broken promise, and
 * it is exactly the sort of thing that survives right up until somebody
 * reaches level thirty. The check calls this and refuses an unknown one.
 */
export function danglingRewards(): string[] {
  const out: string[] = [];
  for (const k of allKeepsakes()) {
    if (k.kind === 'pack' || k.kind === 'coins') continue;
    const found = cosmeticById(k.id);
    if (!found) out.push(`${k.id} at level ${k.level} is not a thing`);
    else if (found.level !== k.level) {
      out.push(`${k.id} is given at level ${k.level} and listed at ${found.level}`);
    }
  }
  return out;
}
