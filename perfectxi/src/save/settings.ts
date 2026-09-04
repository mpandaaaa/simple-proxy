import { defineStore } from './storage';

/**
 * How fast a match plays out.
 *
 * The broadcast is ninety minutes of clock over a handful of seconds.
 * Some people want to watch it and some people want the score, and both
 * are reasonable, so it is a setting rather than an argument.
 */
export type MatchSpeed = 'slow' | 'normal' | 'fast' | 'instant';

/**
 * Which commentator.
 *
 * The television one, or the radio one on a wet Tuesday. A hundred
 * matches in one voice starts to repeat itself.
 */
export type Voice = 'classic' | 'dry';

export type Settings = {
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  matchSpeed: MatchSpeed;
  voice: Voice;
  /** one reminder a day that the Daily is up, off unless asked for */
  remind: boolean;
  /** the hour it fires, 0 to 23 */
  remindAt: number;
};

const fallback: Settings = {
  sound: true,
  haptics: true,
  reducedMotion: false,
  matchSpeed: 'normal',
  voice: 'classic',
  remind: false,
  remindAt: 19,
};

const SPEEDS: readonly MatchSpeed[] = ['slow', 'normal', 'fast', 'instant'];

function isSettings(v: unknown): v is Settings {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.sound === 'boolean' &&
    typeof s.haptics === 'boolean' &&
    typeof s.reducedMotion === 'boolean' &&
    SPEEDS.indexOf(s.matchSpeed as MatchSpeed) > -1 &&
    (s.voice === 'classic' || s.voice === 'dry') &&
    typeof s.remind === 'boolean' &&
    typeof s.remindAt === 'number' &&
    s.remindAt >= 0 &&
    s.remindAt <= 23
  );
}

export const settingsStore = defineStore<Settings>({
  key: 'settings',
  version: 4,
  fallback,
  validate: isSettings,
  migrations: {
    /*
     * Two adds the match speed, and drops the colourblind and text size
     * switches.
     *
     * Those two were stored from the first build and never read by
     * anything, so they were switches that did nothing. A settings screen
     * that lies is worse than one that is short: text size follows the
     * phone's own setting, which is where people expect to change it.
     */
    2: (v: unknown) => {
      if (typeof v !== 'object' || v === null) return null;
      const s = v as Record<string, unknown>;
      return {
        sound: s.sound !== false,
        haptics: s.haptics !== false,
        reducedMotion: s.reducedMotion === true,
        matchSpeed: 'normal' as MatchSpeed,
        voice: 'classic' as Voice,
        remind: false,
        remindAt: 19,
      };
    },
    /* Three adds the second commentator. Everybody keeps the one they
       have been listening to. */
    3: (v: unknown) => {
      if (typeof v !== 'object' || v === null) return null;
      return { ...(v as Settings), voice: 'classic' as Voice };
    },
    /* Four adds the daily reminder. Off, because nobody asked for it. */
    4: (v: unknown) => {
      if (typeof v !== 'object' || v === null) return null;
      return { ...(v as Settings), remind: false, remindAt: 19 };
    },
  },
});
