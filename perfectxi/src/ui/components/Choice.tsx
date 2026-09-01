import { View, Text, StyleSheet } from 'react-native';
import { color, radius, space, gradient, shadow, line } from '../tokens';
import { font, text } from '../type';
import { Press } from './Press';

export type Option<T extends string> = { value: T; label: string };

/**
 * A labelled row of chips, one of which is on.
 *
 * Chips wrap rather than scroll sideways. A horizontal strip hides options
 * off the right edge and there is no reason to make someone hunt for a
 * formation they cannot see.
 */
export function Choice<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={text.label}>{label}</Text>
      <View style={styles.chips}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Press
              key={o.value}
              onPress={() => onChange(o.value)}
              feel="select"
              scaleTo={0.94}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityLabel={`${label}: ${o.label}`}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {o.label}
              </Text>
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

const styles = StyleSheet.create({
  wrap: { marginBottom: space.s5 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s2,
    marginTop: space.s2,
  },
  chip: {
    paddingHorizontal: space.s4,
    paddingVertical: space.s2 + 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow: shadow.card,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipOn: {
    // Overridden with a real gradient rather than cleared. Setting a style
    // to undefined in a merged array means "do not override", so the dark
    // card gradient would otherwise stay on top of the accent fill.
    backgroundColor: color.accentWeak,
    experimental_backgroundImage:
      'linear-gradient(180deg, rgba(31,197,126,0.26) 0%, rgba(31,197,126,0.10) 100%)',
    borderColor: color.accent,
  },
  chipText: {
    fontFamily: font.displaySemi,
    fontSize: 15,
    letterSpacing: 0.3,
    color: color.text2,
  },
  chipTextOn: { color: color.accent },
  hint: { marginTop: space.s2 },
});
