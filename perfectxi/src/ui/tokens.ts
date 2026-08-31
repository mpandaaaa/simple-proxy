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
