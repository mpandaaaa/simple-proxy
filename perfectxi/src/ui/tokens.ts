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
