/**
 * Render the game's sounds to WAV files.
 *
 * The web build has no audio files: it synthesises every cue with Web Audio
 * oscillators, a handful of tones per event. A phone cannot do that without
 * dragging in an audio engine, so the same tones are rendered here, once,
 * from the same specification. Frequencies, waveforms, start times,
 * durations and volumes are lifted straight out of the site's `wcSound`
 * and `pxSfx`, so the app sounds exactly like the site does.
 *
 * The envelope is the site's too: an exponential ramp up over 20ms and an
 * exponential ramp down across the rest of the tone, which is what stops a
 * square wave clicking at its edges.
 *
 * Run with: npm run sounds
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'assets', 'sfx');
const RATE = 22050;

/** One oscillator: [frequency, start, duration, waveform, volume]. */
const CUES = {
  // the referee, twice, as the site does it
  whistle: [
    [1760, 0, 0.13, 'square', 0.1],
    [2090, 0.14, 0.2, 'square', 0.1],
  ],
  // a rising major arpeggio, which is what a goal sounds like here
  goal: [
    [523, 0, 0.26, 'triangle', 0.17],
    [659, 0.085, 0.26, 'triangle', 0.17],
    [784, 0.17, 0.26, 'triangle', 0.17],
    [1047, 0.255, 0.26, 'triangle', 0.17],
  ],
  // and the same idea falling, on a saw, for one against
  against: [
    [340, 0, 0.22, 'sawtooth', 0.1],
    [247, 0.13, 0.42, 'sawtooth', 0.1],
  ],
  ft: [
    [1560, 0, 0.16, 'square', 0.11],
    [1560, 0.2, 0.16, 'square', 0.11],
    [1300, 0.4, 0.5, 'square', 0.11],
  ],
  win: [
    [523, 0, 0.42, 'triangle', 0.17],
    [659, 0.12, 0.42, 'triangle', 0.17],
    [784, 0.24, 0.42, 'triangle', 0.17],
    [1047, 0.36, 0.42, 'triangle', 0.17],
    [1319, 0.48, 0.42, 'triangle', 0.17],
  ],
  lose: [
    [440, 0, 0.42, 'sawtooth', 0.11],
    [392, 0.15, 0.42, 'sawtooth', 0.11],
    [330, 0.3, 0.42, 'sawtooth', 0.11],
    [262, 0.45, 0.42, 'sawtooth', 0.11],
  ],
  // the reel stepping, one click per card
  tick: [[760, 0, 0.05, 'square', 0.035]],
  // a player signed
  pick: [
    [520, 0, 0.09, 'triangle', 0.07],
    [780, 0.05, 0.1, 'sine', 0.05],
  ],
  // the trophy
  trophy: [
    [523, 0, 0.5, 'triangle', 0.15],
    [784, 0.1, 0.5, 'triangle', 0.15],
    [1047, 0.2, 0.6, 'triangle', 0.16],
    [1319, 0.34, 0.75, 'triangle', 0.15],
    [1568, 0.5, 0.9, 'triangle', 0.14],
  ],
};

function wave(type, phase) {
  switch (type) {
    case 'square':
      return phase % 1 < 0.5 ? 1 : -1;
    case 'sawtooth':
      return 2 * (phase % 1) - 1;
    case 'triangle': {
      const p = phase % 1;
      return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
    }
    default:
      return Math.sin(phase * Math.PI * 2);
  }
}

function render(tones) {
  const end = Math.max(...tones.map(([, start, dur]) => start + dur)) + 0.05;
  const n = Math.ceil(end * RATE);
  const buf = new Float32Array(n);

  for (const [freq, start, dur, type, vol] of tones) {
    const from = Math.floor(start * RATE);
    const len = Math.floor(dur * RATE);
    const rampUp = Math.max(1, Math.floor(0.02 * RATE));
    for (let i = 0; i < len; i++) {
      const idx = from + i;
      if (idx >= n) break;
      // The site's envelope: exponential up, exponential down. Anything
      // squarer than this clicks.
      const g =
        i < rampUp
          ? 0.0001 * Math.pow(vol / 0.0001, i / rampUp)
          : vol * Math.pow(0.0001 / vol, (i - rampUp) / Math.max(1, len - rampUp));
      buf[idx] += wave(type, (freq * i) / RATE) * g;
    }
  }

  // A short fade at each end so the file itself cannot pop.
  const fade = Math.floor(0.004 * RATE);
  for (let i = 0; i < fade; i++) {
    buf[i] *= i / fade;
    buf[n - 1 - i] *= i / fade;
  }

  const pcm = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, buf[i]));
    pcm.writeInt16LE(Math.round(s * 32767), i * 2);
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [name, tones] of Object.entries(CUES)) {
  const wav = render(tones);
  writeFileSync(join(OUT, `${name}.wav`), wav);
  total += wav.length;
  console.log(`  ${name}.wav`.padEnd(18) + `${(wav.length / 1024).toFixed(1)} KB`);
}
console.log(`${Object.keys(CUES).length} cues, ${(total / 1024).toFixed(0)} KB in total`);
