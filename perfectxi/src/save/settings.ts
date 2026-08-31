import { defineStore } from './storage';

export type TextSize = 'default' | 'large' | 'larger';

export type Settings = {
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  colourblind: boolean;
  textSize: TextSize;
};

const fallback: Settings = {
  sound: true,
  haptics: true,
  reducedMotion: false,
  colourblind: false,
  textSize: 'default',
};

function isSettings(v: unknown): v is Settings {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.sound === 'boolean' &&
    typeof s.haptics === 'boolean' &&
    typeof s.reducedMotion === 'boolean' &&
    typeof s.colourblind === 'boolean' &&
    (s.textSize === 'default' || s.textSize === 'large' || s.textSize === 'larger')
  );
}

export const settingsStore = defineStore<Settings>({
  key: 'settings',
  version: 1,
  fallback,
  validate: isSettings,
  // migrations: { 2: (old) => ({ ...(old as Settings), newField: false }) }
});
