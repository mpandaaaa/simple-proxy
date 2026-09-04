import { defineStore } from './storage';

/**
 * How fast a match plays out.
 *
 * The broadcast is ninety minutes of clock over a handful of seconds.
 * Some people want to watch it and some people want the score, and both
 * are reasonable, so it is a setting rather than an argument.
 */
export type MatchSpeed = 'slow' | 'normal' | 'fast' | 'instant';

export type Settings = {
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  matchSpeed: MatchSpeed;
};

const fallback: Settings = {
  sound: true,
  haptics: true,
  reducedMotion: false,
  matchSpeed: 'normal',
};

const SPEEDS: readonly MatchSpeed[] = ['slow', 'normal', 'fast', 'instant'];

function isSettings(v: unknown): v is Settings {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.sound === 'boolean' &&
    typeof s.haptics === 'boolean' &&
    typeof s.reducedMotion === 'boolean' &&
    SPEEDS.indexOf(s.matchSpeed as MatchSpeed) > -1
  );
}

export const settingsStore = defineStore<Settings>({
  key: 'settings',
  version: 2,
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
      };
    },
  },
});
