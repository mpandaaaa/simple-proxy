import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { settingsStore } from '../save';

/**
 * The game's sounds, in one place, gated in one place.
 *
 * The cues are rendered from the web build's own oscillator specs by
 * scripts/make-sounds.mjs, so the app sounds like the site rather than like
 * a different game wearing its clothes.
 *
 * Every cue is loaded once, on first use, and kept. They are a few
 * kilobytes each and a goal has to fire on the frame it happens, not after
 * a file has been opened.
 *
 * Nothing here throws. A cue that will not play must never interrupt the
 * thing the player actually asked for, which is why every call is wrapped
 * and every failure is swallowed.
 */

export type Cue =
  | 'whistle'
  | 'goal'
  | 'against'
  | 'ft'
  | 'win'
  | 'lose'
  | 'tick'
  | 'pick'
  | 'trophy';

// Static requires, because Metro resolves these at build time and a
// computed path would not be bundled.
const FILES: Record<Cue, number> = {
  whistle: require('../../assets/sfx/whistle.wav'),
  goal: require('../../assets/sfx/goal.wav'),
  against: require('../../assets/sfx/against.wav'),
  ft: require('../../assets/sfx/ft.wav'),
  win: require('../../assets/sfx/win.wav'),
  lose: require('../../assets/sfx/lose.wav'),
  tick: require('../../assets/sfx/tick.wav'),
  pick: require('../../assets/sfx/pick.wav'),
  trophy: require('../../assets/sfx/trophy.wav'),
};

const players = new Map<Cue, AudioPlayer>();
let configured = false;

/**
 * Play alongside anything else the phone is doing, and do not stop it.
 *
 * Someone listening to music while drafting should keep their music. The
 * game's sounds are punctuation, not a soundtrack, so the session mixes
 * rather than taking over, and a silent switch means silent.
 */
function configure() {
  if (configured) return;
  configured = true;
  void setAudioModeAsync({
    playsInSilentMode: false,
    shouldPlayInBackground: false,
    interruptionMode: 'mixWithOthers',
  }).catch(() => {});
}

function playerFor(cue: Cue): AudioPlayer | null {
  const held = players.get(cue);
  if (held) return held;
  try {
    const p = createAudioPlayer(FILES[cue]);
    players.set(cue, p);
    return p;
  } catch {
    return null;
  }
}

export function sfx(cue: Cue): void {
  if (!settingsStore.read().sound) return;
  try {
    configure();
    const p = playerFor(cue);
    if (!p) return;
    // Rewound every time: a goal in the 80th minute must not be swallowed
    // because the same cue was still playing from the 79th.
    p.seekTo(0);
    p.play();
  } catch {
    /* a cue that will not play is never worth interrupting the game for */
  }
}

/** True when sound is on. Read at the point of use, never cached. */
export function soundOn(): boolean {
  return settingsStore.read().sound;
}

export function toggleSound(): boolean {
  const next = !settingsStore.read().sound;
  settingsStore.update((s) => ({ ...s, sound: next }));
  return next;
}

/** Free the loaded cues. Used when the app is torn down, not per screen. */
export function releaseSounds(): void {
  for (const p of players.values()) {
    try {
      p.remove();
    } catch {
      /* nothing to do about a player that is already gone */
    }
  }
  players.clear();
}
