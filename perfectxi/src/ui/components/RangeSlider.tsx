import { useCallback, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { color, radius, line } from '../tokens';
import { haptic, useReduceMotion } from '../feel';

const THUMB = 26;
const TRACK = 6;

/**
 * A two ended range, over whole steps.
 *
 * The web build uses one of these for the era, and it is the right control:
 * two presets cannot express "the nineties and the first half of the 2000s",
 * and the live count underneath is the only thing that tells you whether
 * you have narrowed the draft to something interesting or to four clubs.
 *
 * Both thumbs run on the UI thread. The value only reaches React when the
 * step actually changes, so dragging across thirty five years is thirty
 * five updates rather than one per frame, and every one of them ticks.
 */
export function RangeSlider({
  min,
  max,
  from,
  to,
  onChange,
}: {
  min: number;
  max: number;
  from: number;
  to: number;
  /** fired when either end lands on a new step */
  onChange: (from: number, to: number) => void;
}) {
  const reduce = useReduceMotion();
  const [width, setWidth] = useState(0);

  const span = Math.max(1, max - min);
  const usable = Math.max(1, width - THUMB);

  const lo = useSharedValue(((from - min) / span) * usable);
  const hi = useSharedValue(((to - min) / span) * usable);
  const startLo = useSharedValue(0);
  const startHi = useSharedValue(0);
  /** the last steps handed to React, so a drag only reports real changes */
  const lastLo = useSharedValue(from);
  const lastHi = useSharedValue(to);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      setWidth(w);
      const u = Math.max(1, w - THUMB);
      lo.value = ((from - min) / span) * u;
      hi.value = ((to - min) / span) * u;
    },
    [from, to, min, span, lo, hi],
  );

  const report = useCallback(
    (a: number, b: number) => {
      haptic('select');
      onChange(a, b);
    },
    [onChange],
  );

  // One tick per year crossed, fired from position rather than from a timer.
  useAnimatedReaction(
    () => [lo.value, hi.value] as const,
    ([l, h]) => {
      'worklet';
      const a = Math.round((l / usable) * span) + min;
      const b = Math.round((h / usable) * span) + min;
      if (a === lastLo.value && b === lastHi.value) return;
      lastLo.value = a;
      lastHi.value = b;
      runOnJS(report)(a, b);
    },
  );

  const panLo = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      startLo.value = lo.value;
    })
    .onUpdate((e) => {
      'worklet';
      lo.value = Math.min(hi.value, Math.max(0, startLo.value + e.translationX));
    });

  const panHi = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      startHi.value = hi.value;
    })
    .onUpdate((e) => {
      'worklet';
      hi.value = Math.max(lo.value, Math.min(usable, startHi.value + e.translationX));
    });

  // Snapped positions, so a thumb rests on its year rather than between two.
  const snapLo = useDerivedValue(() =>
    (Math.round((lo.value / usable) * span) / span) * usable,
  );
  const snapHi = useDerivedValue(() =>
    (Math.round((hi.value / usable) * span) / span) * usable,
  );

  const loStyle = useAnimatedStyle(() => ({ transform: [{ translateX: snapLo.value }] }));
  const hiStyle = useAnimatedStyle(() => ({ transform: [{ translateX: snapHi.value }] }));
  const rangeStyle = useAnimatedStyle(() => ({
    left: snapLo.value + THUMB / 2,
    width: Math.max(0, snapHi.value - snapLo.value),
  }));

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <View style={styles.track} />
      <Animated.View style={[styles.range, rangeStyle]} />

      <GestureDetector gesture={panLo}>
        <Animated.View style={[styles.thumbHit, loStyle]}>
          <View style={styles.thumb} />
        </Animated.View>
      </GestureDetector>

      <GestureDetector gesture={panHi}>
        <Animated.View style={[styles.thumbHit, hiStyle]}>
          <View style={styles.thumb} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 44, justifyContent: 'center' },
  track: {
    position: 'absolute',
    left: THUMB / 2,
    right: THUMB / 2,
    height: TRACK,
    borderRadius: TRACK / 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: line.card,
  },
  range: {
    position: 'absolute',
    height: TRACK,
    borderRadius: TRACK / 2,
    backgroundColor: color.accent,
    boxShadow: `0px 0px 10px ${color.accent}88`,
  },
  thumbHit: {
    position: 'absolute',
    left: 0,
    width: THUMB,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
    borderColor: color.accent,
    backgroundColor: '#101A14',
    experimental_backgroundImage:
      'linear-gradient(180deg, #1B2A20 0%, #0D1610 100%)',
    boxShadow:
      '0px 3px 10px rgba(0,0,0,0.5), inset 0px 1px 0px rgba(255,255,255,0.12)',
  },
});
