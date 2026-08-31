import { View, Text, StyleSheet, TextStyle } from 'react-native';
import { color, space } from '../tokens';
import { text } from '../type';

/**
 * A fixed width numeric slot with an overflow guard.
 *
 * Numbers in this game can run from 0 to 125000000, and a slot sized for
 * "12" will destroy a layout when it is handed "1,240". So the value is
 * locked to one line and allowed to shrink rather than wrap or clip.
 *
 * Digits only. Word values go in a Pill.
 */
export function NumberSlot({
  label,
  value,
  tone,
  align = 'left',
}: {
  label: string;
  value: string | number;
  tone?: string;
  align?: 'left' | 'center';
}) {
  return (
    <View style={[styles.wrap, align === 'center' && styles.center]}>
      <Text
        style={[text.stat, tone ? { color: tone } : null, styles.value]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
        allowFontScaling={false}
      >
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minWidth: 0 },
  center: { alignItems: 'center' },
  value: { marginBottom: space.s1 },
  label: {
    ...text.key,
    color: color.text3,
  } as TextStyle,
});
