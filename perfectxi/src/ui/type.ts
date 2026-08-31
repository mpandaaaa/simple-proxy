import { TextStyle } from 'react-native';
import { color } from './tokens';

/**
 * Three faces, three jobs.
 *   Anton            hero numbers only
 *   Barlow Condensed headings, labels, stat values
 *   Inter            everything you actually read
 *
 * The family string is the export name from @expo-google-fonts, which is
 * what useFonts() registers in app/_layout.tsx.
 */
export const font = {
  hero: 'Anton_400Regular',
  displaySemi: 'BarlowCondensed_600SemiBold',
  displayBold: 'BarlowCondensed_700Bold',
  displayBlack: 'BarlowCondensed_800ExtraBold',
  body: 'Inter_400Regular',
  bodyMed: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

/** Every digit that sits in a column lines up. */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

export const text = {
  /** Big number. Scores, levels, points. */
  hero: {
    fontFamily: font.hero,
    fontSize: 44,
    lineHeight: 46,
    color: color.text1,
    ...tabular,
  } as TextStyle,

  /** Screen title. */
  title: {
    fontFamily: font.displayBold,
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: 0.2,
    color: color.text1,
  } as TextStyle,

  /** Card heading. */
  heading: {
    fontFamily: font.displayBold,
    fontSize: 21,
    lineHeight: 24,
    letterSpacing: 0.2,
    color: color.text1,
  } as TextStyle,

  /** Uppercase section label above a group. */
  label: {
    fontFamily: font.displaySemi,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: color.text3,
  } as TextStyle,

  /** Small uppercase key on a tile. */
  key: {
    fontFamily: font.displaySemi,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  } as TextStyle,

  /** Stat value in a slot. */
  stat: {
    fontFamily: font.displayBold,
    fontSize: 24,
    lineHeight: 27,
    color: color.text1,
    ...tabular,
  } as TextStyle,

  body: {
    fontFamily: font.body,
    fontSize: 15,
    lineHeight: 22,
    color: color.text2,
  } as TextStyle,

  bodyStrong: {
    fontFamily: font.bodySemi,
    fontSize: 15,
    lineHeight: 22,
    color: color.text1,
  } as TextStyle,

  small: {
    fontFamily: font.body,
    fontSize: 13,
    lineHeight: 18,
    color: color.text3,
  } as TextStyle,

  button: {
    fontFamily: font.displayBold,
    fontSize: 17,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  } as TextStyle,
} as const;
