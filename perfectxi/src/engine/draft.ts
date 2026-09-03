import { SQUADS } from '../data/squads';
import type { DraftConfig, Pick, Position, Slot } from './types';
import type { Rng } from './rng';
import { posCompat, slotsFor } from './formations';

/**
 * The draft: spin a club-season, take one player off the board, repeat
 * until the eleven is full.
 *
 * Everything here is a plain function over plain data. No React, no
 * storage, no timers. The same code runs the game on the phone, runs a
 * headless season in a script, and will re-run a submitted season inside a
 * server function to check it was really played.
 */

export const ALL_KEYS: string[] = Object.keys(SQUADS);

/** The twenty clubs offered in All Time XI mode. */
export const AT20_CLUBS: readonly string[] = [
  'Arsenal', 'Chelsea', 'Everton', 'Liverpool', 'Man United', 'Tottenham',
  'Aston Villa', 'Newcastle', 'West Ham', 'Man City', 'Southampton', 'Fulham',
  'Leicester', 'Blackburn', 'Sunderland', 'Crystal Palace', 'Wolves', 'Leeds',
  'Middlesbrough', 'Bolton',
];

/** 2003 becomes "2003/04". */
export function seasonStr(year: number): string {
  return year + '/' + (year + 1).toString().slice(2);
}

const seasonListCache = new Map<string, { club: string; season: string }[]>();

/**
 * Every club-season in an era, as scenery for the spin reel.
 *
 * Cached per era: the reel asks for this on every spin and there is no
 * reason to walk 712 keys each time.
 */
export function clubSeasons(from: number, to: number): { club: string; season: string }[] {
  const key = from + ':' + to;
  const hit = seasonListCache.get(key);
  if (hit) return hit;

  const out: { club: string; season: string }[] = [];
  for (const k of ALL_KEYS) {
    const bar = k.indexOf('|');
    const year = Number(k.slice(bar + 1));
    if (year >= from && year <= to) {
      out.push({ club: k.slice(0, bar), season: seasonStr(year) });
    }
  }
  seasonListCache.set(key, out);
  return out;
}

const eraSummaryCache = new Map<string, EraSummary>();

export type EraSummary = {
  /** distinct clubs with at least one season in range */
  clubs: number;
  /** how many seasons the range covers */
  seasons: number;
  /** club-seasons the wheel can land on */
  entries: number;
};

/**
 * What an era range actually contains.
 *
 * The site shows this live under its slider, and it is the only feedback
 * that tells you whether you have narrowed the draft to something
 * interesting or to something with four clubs in it.
 */
export function eraSummary(from: number, to: number): EraSummary {
  const key = from + ':' + to;
  const hit = eraSummaryCache.get(key);
  if (hit) return hit;

  const clubs = new Set<string>();
  let entries = 0;
  for (const k of ALL_KEYS) {
    const bar = k.indexOf('|');
    const year = Number(k.slice(bar + 1));
    if (year >= from && year <= to) {
      clubs.add(k.slice(0, bar));
      entries++;
    }
  }
  const out = { clubs: clubs.size, seasons: to - from + 1, entries };
  eraSummaryCache.set(key, out);
  return out;
}

export type DraftState = {
  config: DraftConfig;
  squad: Slot[];
  filled: number;
  total: number;
  rerolls: number;
  rerollsMax: number;
  /** the current board, or null before the first spin */
  board: Pick[] | null;
  club: string | null;
  season: string | null;
};

/** Easy gives three rerolls, normal one, hard none. */
export function rerollsFor(diff: DraftConfig['diff']): number {
  return diff === 'easy' ? 3 : diff === 'normal' ? 1 : 0;
}

export function newDraft(config: DraftConfig): DraftState {
  const squad = slotsFor(config.formation);
  return {
    config,
    squad,
    filled: 0,
    total: squad.length,
    rerolls: 0,
    rerollsMax: rerollsFor(config.diff),
    board: null,
    club: null,
    season: null,
  };
}

/**
 * Clubs grouped by name within an era, so every club is equally likely
 * regardless of how many of its seasons are in the database. Without this
 * the spin would land on Arsenal far more often than on Blackburn purely
 * because Arsenal has been in the league longer.
 */
function clubsInEra(from: number, to: number): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const k of ALL_KEYS) {
    const bar = k.indexOf('|');
    const year = Number(k.slice(bar + 1));
    if (year >= from && year <= to) {
      const club = k.slice(0, bar);
      (map[club] ??= []).push(k);
    }
  }
  return map;
}

function ratingOf(p: { rtg: number; prime: number }, rtype: DraftConfig['rtype']): number {
  return rtype === 'prime' ? p.prime : p.rtg;
}

export type SpinResult = {
  club: string;
  /** "2003/04", or "All Eras" in All Time XI mode */
  season: string;
  board: Pick[];
};

/**
 * Spin for a new board.
 *
 * A player already in the eleven never appears again, so the board is
 * always something you can actually pick from. The board is sorted best
 * first, which is how the web build presents it.
 */
export function spin(state: DraftState, rnd: Rng): SpinResult | null {
  const placed = new Set<string>();
  for (const s of state.squad) if (s.player) placed.add(s.player.n);

  if (state.config.mode === 'alltime') {
    const club = AT20_CLUBS[Math.floor(rnd() * AT20_CLUBS.length)];
    // One entry per player across every season the club has, kept at the
    // best rating they ever held there.
    const best: Record<string, Pick> = {};
    for (const k of ALL_KEYS) {
      const bar = k.indexOf('|');
      if (k.slice(0, bar) !== club) continue;
      const year = Number(k.slice(bar + 1));
      for (const p of SQUADS[k]) {
        if (placed.has(p.n)) continue;
        if (state.config.nation && p.nat !== state.config.nation) continue;
        const rtg = ratingOf(p, state.config.rtype);
        if (!best[p.n] || rtg > best[p.n].rtg) {
          best[p.n] = {
            n: p.n,
            nat: p.nat,
            pos: p.pos,
            rtg,
            club,
            season: seasonStr(year),
          };
        }
      }
    }
    const board = Object.values(best).sort((a, b) => b.rtg - a.rtg);
    return { club, season: 'All Eras', board };
  }

  const map = clubsInEra(state.config.eraFrom, state.config.eraTo);
  const clubs = Object.keys(map);
  if (!clubs.length) return null;

  // Equal weight per club, then a season from within that club.
  const club = clubs[Math.floor(rnd() * clubs.length)];
  const keys = map[club];
  const key = keys[Math.floor(rnd() * keys.length)];
  const year = Number(key.slice(key.indexOf('|') + 1));

  /* A nationality rule, when there is one, is applied to the board rather
     than to the draw, so you still spin the same clubs in the same order
     and simply see fewer names on some of them. */
  const board = SQUADS[key]
    .filter((p) => !placed.has(p.n))
    .filter((p) => !state.config.nation || p.nat === state.config.nation)
    .map((p) => ({
      n: p.n,
      nat: p.nat,
      pos: p.pos,
      rtg: ratingOf(p, state.config.rtype),
      club,
      season: seasonStr(year),
    }))
    .sort((a, b) => b.rtg - a.rtg);

  return { club, season: seasonStr(year), board };
}

/** Blitz cuts the board to the top three, so there is no safe pick. */
export function visibleBoard(board: Pick[], blitz: boolean): Pick[] {
  return blitz && board.length > 3 ? board.slice(0, 3) : board;
}

/** The open slots this player is allowed to fill. */
export function slotsForPlayer(state: DraftState, player: Pick): number[] {
  const out: number[] = [];
  state.squad.forEach((s, i) => {
    if (!s.player && posCompat(player.pos, s.pos)) out.push(i);
  });
  return out;
}

/** True if the player can go anywhere at all in what is left of the shape. */
export function canPlay(state: DraftState, player: Pick): boolean {
  return state.squad.some((s) => !s.player && posCompat(player.pos, s.pos));
}

/** Put a player in a slot. Returns a new state; the old one is untouched. */
export function place(state: DraftState, player: Pick, slotIndex: number): DraftState {
  const slot = state.squad[slotIndex];
  if (!slot || slot.player) return state;
  if (!posCompat(player.pos, slot.pos)) return state;

  const squad = state.squad.slice();
  squad[slotIndex] = { pos: slot.pos, player };

  return {
    ...state,
    squad,
    filled: state.filled + 1,
    board: null,
    club: null,
    season: null,
  };
}

export function squadAvg(squad: Slot[], only?: Position): number {
  const picked = squad.filter((s) => s.player && (!only || s.pos === only));
  if (!picked.length) return 0;
  let sum = 0;
  for (const s of picked) sum += s.player!.rtg;
  return sum / picked.length;
}

/**
 * What one teammate is worth to another.
 *
 * A shared club is the real thing: they actually played together. A shared
 * season is an era, which is nearly as good. A shared nationality is the
 * weakest of the three and deliberately so, because England turns up in
 * roughly every squad in the database and a link everyone has for free is
 * not a link worth drafting for.
 *
 * A pair is worth its strongest connection, not the sum of them. Two
 * Liverpool players who are both English are still one pairing.
 */
export const CHEM_WEIGHT = { club: 1, season: 0.75, nation: 0.5 } as const;

function pairChem(a: Pick, b: Pick): number {
  if (a.club && a.club === b.club) return CHEM_WEIGHT.club;
  if (a.season && a.season === b.season) return CHEM_WEIGHT.season;
  if (a.nat && a.nat === b.nat) return CHEM_WEIGHT.nation;
  return 0;
}

/**
 * Squad chemistry: how much of your eleven knows each other, capped at
 * three links a player. A side drafted from one club, one era or one
 * country hangs together; eleven strangers do not.
 */
export function squadChem(squad: Slot[]): number {
  const pl = squad.filter((s) => s.player).map((s) => s.player!);
  if (pl.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < pl.length; i++) {
    let links = 0;
    for (let j = 0; j < pl.length && links < 3; j++) {
      if (i === j) continue;
      links += pairChem(pl[i], pl[j]);
    }
    total += Math.min(3, links);
  }
  return Math.round((total / (3 * pl.length)) * 100);
}

export type ChemLink = { name: string; count: number };

/**
 * What the chemistry is actually made of.
 *
 * squadChem returns a percentage, which tells you there is chemistry but
 * not where it came from. This names it: the clubs and the seasons two or
 * more of your XI share, most shared first. Knowing that three of your side
 * are Liverpool 2010/11 is what turns chemistry from a number you are given
 * into something you can draft towards.
 */
export function chemistryLinks(squad: Slot[]): {
  clubs: ChemLink[];
  seasons: ChemLink[];
  nations: ChemLink[];
} {
  const clubs = new Map<string, number>();
  const seasons = new Map<string, number>();
  const nations = new Map<string, number>();
  for (const s of squad) {
    if (!s.player) continue;
    clubs.set(s.player.club, (clubs.get(s.player.club) ?? 0) + 1);
    seasons.set(s.player.season, (seasons.get(s.player.season) ?? 0) + 1);
    if (s.player.nat) nations.set(s.player.nat, (nations.get(s.player.nat) ?? 0) + 1);
  }
  const top = (m: Map<string, number>): ChemLink[] =>
    [...m.entries()]
      .filter(([, n]) => n >= 2)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  return { clubs: top(clubs), seasons: top(seasons), nations: top(nations) };
}

/** Chemistry is worth at most three rating points on top of the average. */
export function chemBonus(squad: Slot[]): number {
  return Math.min(3, squadChem(squad) / 33);
}
