import { View, Text, StyleSheet } from 'react-native';
import { color, radius, space, gradient, shadow, line } from '../tokens';
import { font, text } from '../type';
import { Press } from './Press';

export type OptionTone = 'accent' | 'gold';

export type GroupOption<T extends string> = {
  value: T;
  label: string;
  /** the line under the label that says what choosing this actually does */
  desc?: string;
};

const TONES = {
  accent: {
    fg: color.accent,
    edge: color.accent,
    fill: 'linear-gradient(160deg, rgba(31,197,126,0.20) 0%, rgba(31,197,126,0.07) 100%)',
    solid: 'rgba(31,197,126,0.10)',
  },
  gold: {
    fg: color.gold,
    edge: color.gold,
    fill: 'linear-gradient(160deg, rgba(214,178,94,0.20) 0%, rgba(214,178,94,0.07) 100%)',
    solid: 'rgba(214,178,94,0.10)',
  },
} as const;

/**
 * A choice made of cards rather than bare chips.
 *
 * A chip says "Easy". A card says "Easy, 3 rerolls available", which is the
 * thing you actually needed to know to choose. The web build does it this
 * way for mode and difficulty and it is plainly better, so the app does too.
 *
 * Options with a description sit two to a row and wrap; plain ones stay
 * inline and hug their text, which keeps twelve formations from becoming
 * twelve full width cards.
 */
export function OptionGroup<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
  tone = 'accent',
}: {
  label: string;
  hint?: string;
  options: readonly GroupOption<T>[];
  value: T;
  onChange: (next: T) => void;
  tone?: OptionTone;
}) {
  const t = TONES[tone];
  const carded = options.some((o) => o.desc);

  return (
    <View style={styles.wrap}>
      <Text style={text.label}>{label}</Text>

      <View style={[styles.list, carded && styles.grid]}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Press
              key={o.value}
              onPress={() => onChange(o.value)}
              feel="select"
              scaleTo={carded ? 0.97 : 0.94}
              style={[
                carded ? styles.card : styles.chip,
                on && {
                  borderColor: t.edge,
                  backgroundColor: t.solid,
                  experimental_backgroundImage: t.fill,
                },
              ]}
              accessibilityLabel={`${label}: ${o.label}${o.desc ? '. ' + o.desc : ''}`}
            >
              <Text
                style={[
                  carded ? styles.cardLabel : styles.chipLabel,
                  on && { color: t.fg },
                ]}
                numberOfLines={1}
              >
                {o.label}
              </Text>
              {o.desc ? (
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {o.desc}
                </Text>
              ) : null}
            </Press>
          );
        })}
      </View>

      {hint ? (
        <Text style={[text.small, styles.hint]} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const CARD_BASE = {
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: line.card,
  backgroundColor: '#101A14',
  experimental_backgroundImage: gradient.card,
  boxShadow: shadow.card,
} as const;

const styles = StyleSheet.create({
  wrap: { marginBottom: space.s5 },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s2,
    marginTop: space.s2,
  },
  grid: { gap: space.s3 },

  chip: {
    ...CARD_BASE,
    borderRadius: radius.pill,
    paddingHorizontal: space.s4,
    paddingVertical: space.s2 + 3,
    minHeight: 42,
    justifyContent: 'center',
  },
  chipLabel: {
    fontFamily: font.displayBold,
    fontSize: 16,
    lineHeight: 19,
    letterSpacing: 0.4,
    color: color.text2,
  },

  card: {
    ...CARD_BASE,
    // Two to a row with the gap taken out, so a pair sits square.
    flexBasis: '47.5%',
    flexGrow: 1,
    paddingHorizontal: space.s4,
    paddingVertical: space.s3 + 2,
    minHeight: 74,
    justifyContent: 'center',
  },
  cardLabel: {
    fontFamily: font.displayBold,
    fontSize: 19,
    lineHeight: 23,
    letterSpacing: 0.3,
    color: color.text1,
  },
  cardDesc: {
    fontFamily: font.body,
    fontSize: 12,
    lineHeight: 16,
    color: color.text3,
    marginTop: 3,
  },
  hint: { marginTop: space.s2 },
});
