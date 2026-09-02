/**
 * Perfect XI design tokens.
 *
 * Transcribed from the :root block of the web build (index.html, line 63).
 * These values are the shipped product's identity. Do not "improve" them
 * here; change them in one place and the whole app follows.
 */

export const color = {
  /* surfaces: elevation reads as lighter, never as shadow */
  bg: '#0A0F0C',
  surface1: '#101713',
  surface2: '#17211B',
  surface3: '#1F2C24',
  surfaceModal: '#243329',

  /* borders and the top highlight that fakes a lit edge */
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  topHighlight: 'rgba(255,255,255,0.06)',

  /* text */
  text1: '#E6EDE9',
  text2: '#A9B7AF',
  text3: '#6E7E74',

  /* accents */
  accent: '#1FC57E',
  accentHi: '#38D993',
  accentPress: '#17A968',
  accentWeak: 'rgba(31,197,126,0.14)',
  gold: '#D6B25E',
  goldWeak: 'rgba(214,178,94,0.14)',
  danger: '#E5484D',
  blue: '#4CA0FF',
  blueWeak: 'rgba(76,160,255,0.13)',
  purple: '#B98CF2',

  /* semantic */
  win: '#35D07F',
  draw: '#C9A227',
  loss: '#E5484D',
  warning: '#F5A524',

  /* positions */
  gk: '#F4B740',
  def: '#4CA0FF',
  mid: '#35D07F',
  att: '#E5484D',
} as const;

export type Position = 'GK' | 'DEF' | 'MID' | 'ATT';

export const positionColor: Record<Position, string> = {
  GK: color.gk,
  DEF: color.def,
  MID: color.mid,
  ATT: color.att,
};

/**
 * 8pt grid. Related things sit close (s4), separate groups get real air (s7).
 */
export const space = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 24,
  s6: 32,
  s7: 40,
  s8: 48,
} as const;

/**
 * Gradients and shadows, transcribed from the web build.
 *
 * This is most of what separates the site from a flat mockup of the site.
 * Every card there is a gradient with a real drop shadow and a green tinted
 * border; a flat fill with a grey hairline reads as dead by comparison.
 *
 * React Native renders both natively here, so these are the CSS values with
 * the units React Native needs. Always paint a solid backgroundColor behind
 * a gradient so a card is still a card if the gradient does not draw.
 */
export const gradient = {
  /* the one solid accent block on the home screen */
  hero: 'linear-gradient(140deg, #22D287 0%, #12A866 58%, #0D8F57 100%)',
  /* every dark card */
  card: 'linear-gradient(180deg, #13241C 0%, #0E1A13 100%)',
  cardLift: 'linear-gradient(180deg, #16281F 0%, #101D15 100%)',
  gold: 'linear-gradient(140deg, #1E2A1E 0%, #141d15 60%, #10170F 100%)',
  purple: 'linear-gradient(140deg, #1B1A2B 0%, #14141F 60%, #101017 100%)',
} as const;

export const shadow = {
  hero: '0px 12px 30px rgba(0, 0, 0, 0.45)',
  lift: '0px 8px 22px rgba(0, 0, 0, 0.35)',
  card: '0px 6px 16px rgba(0, 0, 0, 0.30)',
} as const;

/**
 * Card borders are green tinted, not grey. On a near black background a
 * neutral hairline looks like a seam; a tinted one looks like an edge.
 */
export const line = {
  card: '#243A2C',
  cardHot: '#2F4C3A',
  gold: 'rgba(214, 178, 94, 0.40)',
  purple: 'rgba(185, 140, 242, 0.40)',
  blue: 'rgba(76, 160, 255, 0.40)',
  danger: 'rgba(229, 72, 77, 0.40)',
  accent: 'rgba(31, 197, 126, 0.40)',
} as const;

/**
 * Semantic gaps, so a screen asks for the meaning rather than the number.
 * Related things sit close; separate groups get real air.
 */
export const gap = {
  related: space.s4,
  group: 34,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Minimum tap targets. Primary actions are taller. */
export const hit = {
  button: 48,
  primary: 58,
} as const;

export const motion = {
  d1: 100,
  d2: 150,
  d3: 200,
  d4: 300,
  d5: 400,
} as const;

/**
 * Colour, beyond the green.
 *
 * Emerald is the app's identity, not its whole palette. A screen where
 * every card, every border and every button is the same green reads as
 * one flat surface, and nothing on it can be more important than anything
 * else. So anything that carries its own meaning carries its own hue: the
 * market is blue money, the academy is young growth, the board is gold,
 * trouble is red, and a match wears the colour of the club you are facing.
 *
 * `wear` takes any hex, a club's colour included, and gives back the five
 * values a card needs. One call instead of five hand mixed rgba strings,
 * which is what stops the palette drifting screen by screen.
 */
export const hue = {
  emerald: '#1FC57E',
  mint: '#2FD4B6',
  sky: '#4CA0FF',
  indigo: '#7C86FF',
  violet: '#B98CF2',
  rose: '#F06A9A',
  crimson: '#E5484D',
  amber: '#F5A524',
  gold: '#D6B25E',
  lime: '#A6D74F',
} as const;

export type Hue = keyof typeof hue;

function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** A hex plus an alpha, as the rgba string React Native wants. */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * Black or white, whichever can actually be read on this colour.
 * Club colours run from near black navy to bright yellow, so a pill that
 * always used one or the other would be unreadable half the time.
 */
export function readable(hex: string): string {
  const [r, g, b] = rgbOf(hex);
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return l > 0.58 ? '#0A0F0C' : '#FFFFFF';
}

/** Everything a tinted card needs, mixed from one colour. */
export function wear(base: string) {
  const [r, g, b] = rgbOf(base);
  // the card body: the hue at a few percent over the dark ground, top lit
  const top = `rgba(${Math.round(r * 0.34)},${Math.round(g * 0.34)},${Math.round(b * 0.34)},1)`;
  return {
    key: base,
    line: alpha(base, 0.42),
    lineSoft: alpha(base, 0.24),
    wash: alpha(base, 0.13),
    glow: `0px 0px 20px ${alpha(base, 0.20)}`,
    grad: `linear-gradient(160deg, ${top} 0%, #0D1712 68%, #080D0A 100%)`,
    on: readable(base),
  };
}

/**
 * A club colour bright enough to carry a button.
 *
 * Real kit colours run from bright yellow to a navy that is almost the
 * background. Left alone, half of them make an unreadable button, so
 * anything too dark is lifted until it can hold text and anything too
 * pale is pulled back.
 */
export function vivid(hex: string): string {
  let [r, g, b] = rgbOf(hex);
  let l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  let guard = 0;
  while (l < 0.34 && guard++ < 12) {
    r += (255 - r) * 0.16;
    g += (255 - g) * 0.16;
    b += (255 - b) * 0.16;
    l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  const h = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** The same colour, darker, for the bottom of a gradient. */
export function deepen(hex: string, amount = 0.32): string {
  const [r, g, b] = rgbOf(hex);
  const h = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c * (1 - amount)))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
