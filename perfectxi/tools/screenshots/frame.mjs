/**
 * The App Store screenshots, second edition.
 *
 *     cd tools/screenshots
 *     npm install
 *     npm run frames
 *
 * Reads the real captures in raw/ and the words in frames.en.json, and
 * writes finished frames to out/iphone and out/ipad, one folder per App
 * Store slot, numbered in the order they go up. A contact sheet for each
 * sits beside the folders, never inside them.
 *
 * The rule from the first edition still holds: nothing here draws any part
 * of the app. Every pixel of a screen is a pixel the phone captured. The
 * one new move is the lift: a part of the real capture (the card being
 * signed, the trophy, the scoreline) shown again a little larger, over the
 * screen it came from, so the moment that matters reads at thumbnail size.
 * It is the same pixels, enlarged, never redrawn.
 *
 * What changed from the first edition, and why, from the competitor
 * research of 14 November 2026:
 *
 *   Caption first and argued. The first three frames are the only ones a
 *   search result shows, so each makes a whole claim alone: what you do,
 *   the mechanic, the payoff. Captions are questions and dares rather
 *   than feature names, because a football fan answers a question.
 *
 *   Two tone. One phrase in every headline is lifted out in a second
 *   colour, which is what the best of the field does and what makes the
 *   words land before they are read.
 *
 *   A colour per mode. Green for the draft, gold for winning, the match
 *   in its own pink, Europe in its blue. The set reads as a collection
 *   of games, which is what the app is.
 *
 *   No marks in the words. The captions never say Premier League,
 *   Champions League, World Cup, FIFA or UEFA, and never say free.
 *   Whatever the app itself shows is the app, and is left alone.
 */

import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const FONTS = join(ROOT, 'node_modules', '@expo-google-fonts');

GlobalFonts.registerFromPath(join(FONTS, 'anton/400Regular/Anton_400Regular.ttf'), 'Anton');
GlobalFonts.registerFromPath(
  join(FONTS, 'barlow-condensed/600SemiBold/BarlowCondensed_600SemiBold.ttf'),
  'Barlow Semi',
);
GlobalFonts.registerFromPath(
  join(FONTS, 'barlow-condensed/500Medium/BarlowCondensed_500Medium.ttf'),
  'Barlow Medium',
);
GlobalFonts.registerFromPath(join(FONTS, 'inter/600SemiBold/Inter_600SemiBold.ttf'), 'Inter Semi');

/* The two slots. A capture is matched by its own size, and anything else
   is refused rather than resized, because Apple refuses a frame that is
   off by a pixel and a resized capture is soft. */
const DEVICES = {
  iphone: {
    size: [1320, 2868],
    sources: [[1320, 2868]],
    statusBar: 185,
    margin: 92,
    eyebrowTop: 168,
    eyebrowSize: 50,
    headMax: 196,
    headLines: 3,
    subSize: 62,
    shotW: 1104,
    corner: 74,
    gap: 78,
  },
  ipad: {
    size: [2064, 2752],
    sources: [
      [2064, 2752],
      [1640, 2360],
      [1668, 2388],
    ],
    statusBar: 48,
    margin: 170,
    eyebrowTop: 150,
    eyebrowSize: 56,
    headMax: 210,
    headLines: 2,
    subSize: 70,
    shotW: 1560,
    corner: 56,
    gap: 86,
  },
};

const hex = (h, a = 1) => {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/* Split a headline into words, each knowing whether it is in the lifted
   phrase. [square brackets] in the JSON mark that phrase. */
function tokens(text) {
  const out = [];
  let lifted = false;
  for (const part of text.split(/(\[|\])/)) {
    if (part === '[') lifted = true;
    else if (part === ']') lifted = false;
    else for (const w of part.split(/\s+/).filter(Boolean)) out.push({ w: w.toUpperCase(), lifted });
  }
  return out;
}

function layout(ctx, words, size, maxW, maxLines, breakAtLift = false) {
  ctx.font = `${size}px Anton`;
  const space = ctx.measureText(' ').width;
  const lines = [[]];
  let w = 0;
  for (let i = 0; i < words.length; i++) {
    const t = words[i];
    /* The coloured phrase starts its own line, so it is never split
       across two lines with the plain words. */
    if (breakAtLift && i > 0 && t.lifted !== words[i - 1].lifted && lines[lines.length - 1].length) {
      lines.push([]);
      w = 0;
    }
    const tw = ctx.measureText(t.w).width;
    if (tw > maxW) return null;
    const cur = lines[lines.length - 1];
    if (cur.length && w + space + tw > maxW) {
      lines.push([t]);
      w = tw;
    } else {
      w += (cur.length ? space : 0) + tw;
      cur.push(t);
    }
  }
  return lines.length <= maxLines ? lines : null;
}

/* The largest headline that fits, so a short line is big rather than
   needlessly small. Never below a size a search thumbnail can read. */
function fitHeadline(ctx, words, D, W) {
  const maxW = W - D.margin * 2;
  /* First choice: break where the colour changes, at any size a
     thumbnail can still read. Only then fall back to filling lines. */
  /* Fewer lines beats bigger type: two lines at 170 read faster than three
     at 196, and leave the screen more room. */
  for (const breakAtLift of [true, false]) {
    for (let most = 1; most <= D.headLines; most++) {
      for (let size = D.headMax; size >= (breakAtLift ? 140 : 120); size -= 2) {
        const lines = layout(ctx, words, size, maxW, most, breakAtLift);
        if (lines) return { size, lines };
      }
    }
  }
  throw new Error(`headline will not fit: ${words.map((t) => t.w).join(' ')}`);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function ground(ctx, W, H, f) {
  const g = ctx.createLinearGradient(0, 0, W * 0.35, H);
  g.addColorStop(0, f.top);
  g.addColorStop(1, f.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  /* The sash from the app icon, faint, so the store page and the icon on
     the home screen look like the same thing. */
  ctx.save();
  ctx.translate(W / 2, H * 0.42);
  ctx.rotate((-38 * Math.PI) / 180);
  ctx.fillStyle = hex('#FFFFFF', 0.09);
  ctx.fillRect(-W * 2, -H * 0.08, W * 4, H * 0.16);
  ctx.restore();

  /* A glow where the screen will sit, so it lifts off the ground. */
  const r = ctx.createRadialGradient(W / 2, H * 0.62, 10, W / 2, H * 0.62, W * 0.9);
  r.addColorStop(0, hex('#FFFFFF', 0.16));
  r.addColorStop(1, hex('#FFFFFF', 0));
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, W, H);
}

function caption(ctx, f, D, W) {
  let y = D.eyebrowTop;

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  /* The eyebrow: a small pill, so it reads as a label not a sentence. */
  ctx.font = `${D.eyebrowSize}px "Barlow Semi"`;
  ctx.letterSpacing = `${Math.round(D.eyebrowSize * 0.16)}px`;
  const ebText = f.eyebrow.toUpperCase();
  const ebW = ctx.measureText(ebText).width;
  const padX = D.eyebrowSize * 0.6;
  const pillH = D.eyebrowSize * 1.55;
  const pillX = (W - ebW - padX * 2) / 2;
  roundRect(ctx, pillX, y, ebW + padX * 2, pillH, pillH / 2);
  ctx.fillStyle = hex(f.pill, 1);
  ctx.fill();
  ctx.fillStyle = f.pillInk;
  ctx.fillText(ebText, pillX + padX, y + pillH * 0.7);
  ctx.letterSpacing = '0px';
  y += pillH + D.eyebrowSize * 0.85;

  /* The headline, centred line by line, the lifted phrase in its colour. */
  const { size, lines } = fitHeadline(ctx, tokens(f.headline), D, W);
  ctx.font = `${size}px Anton`;
  const space = ctx.measureText(' ').width;
  const lead = size * 0.98;
  y += size * 0.82;
  for (const line of lines) {
    const widths = line.map((t) => ctx.measureText(t.w).width);
    const total = widths.reduce((a, b) => a + b, 0) + space * (line.length - 1);
    let x = (W - total) / 2;
    line.forEach((t, i) => {
      ctx.fillStyle = t.lifted ? f.lift : f.ink;
      ctx.fillText(t.w, x, y);
      x += widths[i] + space;
    });
    y += lead;
  }
  y -= lead - size * 0.2;

  /* The subline. */
  if (f.sub) {
    ctx.font = `${D.subSize}px "Barlow Medium"`;
    ctx.fillStyle = f.subInk;
    y += D.subSize * 1.2;
    const sw = ctx.measureText(f.sub).width;
    ctx.fillText(f.sub, (W - sw) / 2, y);
    y += D.subSize * 0.3;
  }
  return y;
}

function shadowed(ctx, blur, offY, alpha, draw) {
  ctx.save();
  ctx.shadowColor = `rgba(0,0,0,${alpha})`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = offY;
  draw();
  ctx.restore();
}

async function frame(device, D, given, file) {
  /* A capture from the other device can show different players, so a
     headline naming them can be swapped for that device alone. A caption
     that names somebody who is not on the screen beneath it is untrue. */
  const f =
    device === 'ipad' && given.headline_ipad ? { ...given, headline: given.headline_ipad } : given;
  const shot = await loadImage(file);
  const ok = D.sources.some(([w, h]) => w === shot.width && h === shot.height);
  if (!ok) {
    throw new Error(
      `${file} is ${shot.width} by ${shot.height}. A ${device} frame takes ` +
        D.sources.map(([w, h]) => `${w} by ${h}`).join(' or ') +
        '. Capture it again rather than resizing it.',
    );
  }

  const [W, H] = D.size;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ground(ctx, W, H, f);
  const capEnd = caption(ctx, f, D, W);

  /* The screen, status bar cropped off, running off the bottom edge. A
     frame holding a whole device is a slide about the app; one that is cut
     off is a window into it. */
  const srcY = D.statusBar;
  const srcH = shot.height - srcY;
  const scale = D.shotW / shot.width;
  const x = (W - D.shotW) / 2;
  const top = Math.round(capEnd + D.gap);
  const h = srcH * scale;

  shadowed(ctx, 90, 36, 0.5, () => {
    roundRect(ctx, x, top, D.shotW, h + D.corner, D.corner);
    ctx.fillStyle = '#000';
    ctx.fill();
  });
  ctx.save();
  roundRect(ctx, x, top, D.shotW, h + D.corner, D.corner);
  ctx.clip();
  ctx.drawImage(shot, 0, srcY, shot.width, srcH, x, top, D.shotW, h);
  ctx.restore();
  /* A hairline, the slimmest frame there is, so a dark screen still has
     an edge against a dark ground. */
  roundRect(ctx, x + 1.5, top + 1.5, D.shotW - 3, h + D.corner, D.corner - 1.5);
  ctx.strokeStyle = hex('#FFFFFF', 0.28);
  ctx.lineWidth = 3;
  ctx.stroke();

  /* The lift. A region of the same capture, in capture pixels, drawn again
     over itself a little larger, centred where it already sits. */
  const lift = device === 'iphone' ? f.lift_iphone : f.lift_ipad;
  if (lift) {
    const [lx, ly, lw, lh] = lift.rect;
    const k = lift.scale ?? 1.12;
    const cx = x + (lx + lw / 2) * scale;
    const cy = top + (ly - srcY + lh / 2) * scale;
    const dw = lw * scale * k;
    const dh = lh * scale * k;
    const r = (lift.corner ?? 60) * scale * k;
    shadowed(ctx, 110, 44, 0.6, () => {
      roundRect(ctx, cx - dw / 2, cy - dh / 2, dw, dh, r);
      ctx.fillStyle = '#000';
      ctx.fill();
    });
    ctx.save();
    roundRect(ctx, cx - dw / 2, cy - dh / 2, dw, dh, r);
    ctx.clip();
    ctx.drawImage(shot, lx, ly, lw, lh, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
  }

  if (top > H * 0.5) throw new Error(`${f.headline}: the caption has pushed the screen below half way`);
  return canvas;
}

async function contact(frames, path) {
  const big = 900;
  const pad = 32;
  const cells = frames.map(({ canvas }) => Math.round((canvas.width * big) / canvas.height));
  const sheet = createCanvas(pad + cells.reduce((a, w) => a + w + pad, 0), big + pad * 2 + 40);
  const ctx = sheet.getContext('2d');
  ctx.fillStyle = '#141615';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.font = '22px "Inter Semi"';
  ctx.fillStyle = '#E6EDE9';
  let x = pad;
  frames.forEach(({ canvas, name }, i) => {
    ctx.drawImage(canvas, x, pad, cells[i], big);
    ctx.fillText(name, x, pad + big + 30);
    x += cells[i] + pad;
  });
  writeFileSync(path, await sheet.encode('png'));
}

const words = JSON.parse(readFileSync(join(HERE, 'frames.en.json'), 'utf8'));
const OUT = join(HERE, 'out');

for (const [device, D] of Object.entries(DEVICES)) {
  const folder = join(OUT, device);
  /* The folder is rebuilt from nothing, so a frame dropped from the set
     cannot linger and end up on the listing. */
  if (existsSync(folder)) rmSync(folder, { recursive: true });
  mkdirSync(folder, { recursive: true });

  const made = [];
  let n = 0;
  for (const f of words.frames) {
    const raw = join(HERE, 'raw', device === 'iphone' ? `${f.raw}.png` : `${f.raw_ipad ?? f.raw + '-ipad'}.png`);
    if (!existsSync(raw)) continue;
    n++;
    const canvas = await frame(device, D, f, raw);
    const name = `${String(n).padStart(2, '0')}-${f.raw.replace(/^\d+-/, '')}`;
    writeFileSync(join(folder, `${name}.png`), await canvas.encode('png'));
    made.push({ canvas, name });
    console.log(`  ${device.padEnd(7)} ${name.padEnd(16)} ${f.headline.replace(/[[\]]/g, '')}`);
  }
  await contact(made, join(OUT, `contact-sheet-${device}.png`));
  console.log(`${device}: ${made.length} frames, ${D.size[0]} by ${D.size[1]}\n`);
}

/* Anything left in raw/ that no frame uses is worth knowing about. */
const used = new Set(words.frames.flatMap((f) => [`${f.raw}.png`, `${f.raw_ipad ?? f.raw + '-ipad'}.png`]));
const spare = readdirSync(join(HERE, 'raw')).filter((n) => n.endsWith('.png') && !used.has(n));
if (spare.length) console.log(`Not used: ${spare.join(', ')}`);
