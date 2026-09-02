import { useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { color, radius, space, line, gradient, positionColor } from '../tokens';
import { font, text } from '../type';
import { useReduceMotion } from '../feel';
import type { Position } from '../../engine';

const LINES: { key: Position; label: string }[] = [
  { key: 'ATT', label: 'Att' },
  { key: 'MID', label: 'Mid' },
  { key: 'DEF', label: 'Def' },
  { key: 'GK', label: 'GK' },
];

/**
 * The squad, as five numbers.
 *
 * The overall on the left in the hero face, then each line of the team with
 * a bar behind it. The bars are the point: four numbers side by side are a
 * table, four bars that grow as you draft are a thing you watch.
 *
 * A dash rather than a zero for an empty line. Zero is a rating, and a
 * goalkeeper you have not drafted does not have one.
 */
export function OverallStrip({
  overall,
  lines,
}: {
  overall: number;
  lines: Record<Position, number>;
}) {
  return (
    <View style={styles.strip}>
      <View style={styles.overallCell}>
        <Text style={styles.overall} allowFontScaling={false}>
          {overall ? Math.round(overall) : '—'}
        </Text>
        <Text style={styles.overallLabel}>Overall</Text>
      </View>

      <View style={styles.divider} />

      {LINES.map((l) => (
        <LineCell
          key={l.key}
          label={l.label}
          value={lines[l.key]}
          tint={positionColor[l.key]}
        />
      ))}
    </View>
  );
}

function LineCell({
  label,
  value,
  tint,
}: {
  label: string;
  value: number;
  tint: string;
}) {
  const reduce = useReduceMotion();
  const fill = useSharedValue(0);

  // Ratings live between about 60 and 97; anchoring the bar at zero would
  // leave every line looking identically full.
  const fraction = value ? Math.max(0.08, Math.min(1, (value - 58) / 38)) : 0;

  useEffect(() => {
    fill.value = withTiming(fraction, {
      duration: reduce ? 0 : 520,
      easing: Easing.out(Easing.cubic),
    });
  }, [fraction, fill, reduce]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: fill.value }],
  }));

  return (
    <View style={styles.cell}>
      <Text style={[styles.value, value ? { color: tint } : null]} allowFontScaling={false}>
        {value ? Math.round(value) : '—'}
      </Text>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            barStyle,
            { backgroundColor: tint, boxShadow: value ? `0px 0px 8px ${tint}` : undefined },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: space.s3,
    paddingHorizontal: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow: 'inset 0px 1px 0px rgba(255,255,255,0.06)',
  },
  overallCell: { alignItems: 'center', minWidth: 54 },
  overall: {
    fontFamily: font.hero,
    fontSize: 34,
    lineHeight: 36,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  overallLabel: {
    ...text.key,
    fontSize: 8.5,
    color: color.text3,
    marginTop: 2,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: space.s1,
    backgroundColor: line.card,
  },

  cell: { flex: 1, alignItems: 'center', gap: 2 },
  value: {
    fontFamily: font.displayBold,
    fontSize: 19,
    lineHeight: 21,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  label: { ...text.key, fontSize: 8.5, color: color.text3 },
  track: {
    height: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    marginTop: 3,
  },
  fill: {
    height: 3,
    width: '100%',
    borderRadius: 2,
    alignSelf: 'flex-start',
    transformOrigin: 'left',
  },
});
