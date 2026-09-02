/**
 * Club identity and name handling. Carried over from the web build so a
 * club is the same colour and the same three letters in both.
 */

export const CLUB_COLOURS: Record<string, string> = {
  Arsenal: '#EF0107', Chelsea: '#034694', Liverpool: '#C8102E',
  'Man City': '#6CABDD', 'Man United': '#DA291C', Tottenham: '#132257',
  'Aston Villa': '#670E36', Newcastle: '#FFD700', 'West Ham': '#7A263A',
  Spurs: '#132257',
  Everton: '#003399', Fulham: '#CC0000', Brighton: '#0057B8',
  Bournemouth: '#DA291C', Brentford: '#D20000', 'Crystal Palace': '#1B458F',
  'Nottm Forest': '#DD0000', Wolves: '#FDB913', Sunderland: '#EB172B',
  Leeds: '#FFCD00', Leicester: '#003090', Blackburn: '#009EE0',
  Southampton: '#D71920', Burnley: '#6C1D45', Bolton: '#263C7B',
  Middlesbrough: '#E62020', Watford: '#FBEE23', Stoke: '#E03A3E',
  Wigan: '#1D59AF', QPR: '#005CAB', Birmingham: '#1B3D6F',
  Derby: '#1E3560', 'Sheffield United': '#EE2737', Norwich: '#00A650',
  Charlton: '#D4011D', Hull: '#F18A01', Cardiff: '#0070B5',
  Ipswich: '#0043A8', Reading: '#004494', Portsmouth: '#001489',
  'West Brom': '#122F67', Coventry: '#59CCED', Oldham: '#005DAA',
  Swansea: '#121212', Barnsley: '#D62B2B', Wimbledon: '#005CBF',
};

/** The fallback is the card border green, so an unknown club still reads. */
export function clubColour(club: string | null | undefined): string {
  if (!club) return '#2F4C3A';
  return CLUB_COLOURS[club] ?? '#2F4C3A';
}

/** "Crystal Palace" becomes CP, "Arsenal" becomes ARS. */
export function clubCode(name: string | null | undefined): string {
  if (!name) return '--';
  const w = String(name).replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean);
  if (!w.length) return '--';
  if (w.length === 1) return w[0].slice(0, 3).toUpperCase();
  return (w[0][0] + w[1][0] + (w[2] ? w[2][0] : '')).toUpperCase();
}

/**
 * Particles that belong to the surname rather than to the first name, so
 * Virgil van Dijk is "van Dijk" and not "Dijk".
 */
const PARTICLES = [
  'van', 'von', 'de', 'del', 'della', 'der', 'den', 'da', 'di', 'dos', 'das',
  'du', 'le', 'la', 'ter', 'ten', 'al', 'bin', 'ibn', 'mc', 'mac', 'st',
];

export function lastName(full: string): string {
  const parts = full.trim().split(/\s+/);
  let i = parts.length - 1;
  while (i > 0 && PARTICLES.indexOf(parts[i - 1].toLowerCase().replace(/[^a-z]/g, '')) > -1) {
    i--;
  }
  const sur = parts.slice(i).join(' ');
  return sur.charAt(0).toUpperCase() + sur.slice(1);
}

/** Up to two initials, for the watermark behind a player card. */
export function initials(full: string): string {
  const s = full
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return s || 'PX';
}

export type CardTier = 'bronze' | 'silver' | 'gold' | 'icon';

export function tierFor(rating: number): CardTier {
  if (rating >= 88) return 'icon';
  if (rating >= 78) return 'gold';
  if (rating >= 70) return 'silver';
  return 'bronze';
}

export function tierLabel(rating: number): string {
  if (rating >= 88) return 'ICON';
  if (rating >= 78) return 'ELITE';
  if (rating >= 70) return 'QUALITY';
  return 'SQUAD';
}

/**
 * The six face stats on a player card, spread around the rating the way the
 * web build spreads them. They are presentation, not engine input: nothing
 * in the simulation reads them, and the season is decided by `rtg` alone.
 */
export function faceStats(rating: number, isGK: boolean): [string, number][] {
  const cl = (v: number) => Math.max(35, Math.min(99, Math.round(v)));
  return isGK
    ? [['DIV', cl(rating + 1)], ['HAN', cl(rating - 1)], ['KIC', cl(rating - 6)],
       ['REF', cl(rating + 2)], ['SPD', cl(rating - 14)], ['POS', cl(rating)]]
    : [['PAC', cl(rating + 2)], ['SHO', cl(rating - 1)], ['PAS', cl(rating + 1)],
       ['DRI', cl(rating)], ['DEF', cl(rating - 3)], ['PHY', cl(rating + 2)]];
}

export type Era = {
  key: 'nineties' | 'y2k' | 'tens' | 'modern';
  label: string;
  tint: string;
};

/**
 * Which era a club-season belongs to, and the colour that era wears.
 *
 * Landing on Blackburn 1994/95 should not look identical to landing on
 * Man City 2022/23. The era gives the moment a period, which is most of
 * what makes a spin feel like it went somewhere.
 */
export function eraOf(season: string): Era {
  const year = parseInt(season.slice(0, 4), 10);
  if (!Number.isFinite(year)) return { key: 'modern', label: 'All eras', tint: '#1FC57E' };
  if (year <= 1999) return { key: 'nineties', label: 'The nineties', tint: '#E0A868' };
  if (year <= 2009) return { key: 'y2k', label: 'The 2000s', tint: '#8FB3D9' };
  if (year <= 2019) return { key: 'tens', label: 'The 2010s', tint: '#B98CF2' };
  return { key: 'modern', label: 'Modern era', tint: '#1FC57E' };
}
