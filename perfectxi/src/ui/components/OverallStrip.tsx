import { useEffect, useRef } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { color, radius, space, line, gradient, positionColor } from '../tokens';
import { font, text } from '../type';
import { useReduceMotion } from '../feel';
import { Ticker } from './Ticker';
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
 * a bar behind it. Four numbers side by side are a table; four bars that
 * grow as you draft are a thing you watch.
 *
 * Every value counts up to itself, and the line that just changed takes a
 * hit: it flexes, its bar flares, and the rest stay still. Signing a 92
 * defender used to silently turn a dash into a 92, which is the moment the
 * screen had to acknowledge and did not.
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
        <Ticker value={Math.round(overall)} style={styles.overall} />
        <Text style={styles.overallLabel}>Overall</Text>
      </View>

      <View style={styles.divider} />

      {LINES.map((l) => (
        <LineCell
          key={l.key}
          label={l.label}
          value={Math.round(lines[l.key])}
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
  const hit = useSharedValue(0);
  const previous = useRef(value);

  // Ratings live between about 60 and 97; anchoring the bar at zero would
  // leave every line looking identically full.
  const fraction = value ? Math.max(0.08, Math.min(1, (value - 58) / 38)) : 0;

  useEffect(() => {
    fill.value = withTiming(fraction, {
      duration: reduce ? 0 : 620,
      easing: Easing.out(Easing.cubic),
    });
  }, [fraction, fill, reduce]);

  // Only the line that moved reacts. Everything else holds still, which is
  // what makes the one that moved read.
  useEffect(() => {
    const changed = previous.current !== value;
    previous.current = value;
    if (!changed || reduce) return;
    hit.value = withSequence(
      withSpring(1, { stiffness: 340, damping: 11, mass: 1 }),
      withSpring(0, { stiffness: 180, damping: 16, mass: 1 }),
    );
  }, [value, hit, reduce]);

  const cellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + hit.value * 0.1 }],
  }));
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: fill.value }],
  }));
  const flareStyle = useAnimatedStyle(() => ({ opacity: hit.value }));

  return (
    <Animated.View style={[styles.cell, cellStyle]}>
      <Ticker value={value} style={[styles.value, value ? { color: tint } : null]} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            barStyle,
            {
              backgroundColor: tint,
              boxShadow: value ? `0px 0px 8px ${tint}` : undefined,
            },
          ]}
        />
        {/* the bar flaring as it grows */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flare,
            flareStyle,
            { backgroundColor: tint, boxShadow: `0px 0px 12px ${tint}` },
          ]}
        />
      </View>
    </Animated.View>
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
    lineHeight: 44,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  overallLabel: { ...text.key, fontSize: 8.5, color: color.text3, marginTop: 2 },
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
    lineHeight: 23,
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
  flare: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 2,
  },
});
