import { View, Text, StyleSheet } from 'react-native';
import { color, radius, space } from '../tokens';
import { text } from '../type';

export type PillTone = 'accent' | 'gold' | 'blue' | 'neutral' | 'danger';

const TONES: Record<PillTone, { bg: string; fg: string }> = {
  accent: { bg: color.accentWeak, fg: color.accent },
  gold: { bg: color.goldWeak, fg: color.gold },
  blue: { bg: color.blueWeak, fg: color.blue },
  danger: { bg: 'rgba(229,72,77,0.13)', fg: color.danger },
  neutral: { bg: color.surface3, fg: color.text2 },
};

/**
 * Word values live here. A word must never be dropped into a numeric slot,
 * because the slot is sized for digits and a word will blow it apart.
 */
export function Pill({
  children,
  tone = 'neutral',
}: {
  children: string;
  tone?: PillTone;
}) {
  const t = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <Text style={[text.key, { color: t.fg }]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.s2 + 2,
    paddingVertical: space.s1 + 1,
    borderRadius: radius.pill,
  },
});
