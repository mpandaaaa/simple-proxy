import { useCallback, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { color, radius, line } from '../tokens';
import { haptic } from '../feel';

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

  /** which thumb the current drag owns: 0 undecided, 1 low, 2 high */
  const active = useSharedValue(0);

  /**
   * One gesture for both thumbs.
   *
   * A gesture per thumb looks obvious and breaks the moment they meet: the
   * two views sit on top of each other, the last one rendered swallows the
   * touch, and if that one is already against its end the slider goes dead.
   * Which is exactly what happened with both ends on 2026/27.
   *
   * So the track owns the gesture and picks the thumb. Nearest to the touch
   * normally; when they are on the same year there is no nearest, so it
   * waits for the first movement and gives it to whichever one can go that
   * way.
   *
   * activeOffsetX keeps the page scrolling: the slider only takes over once
   * the finger has committed to sideways.
   */
  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onBegin((e) => {
      'worklet';
      startLo.value = lo.value;
      startHi.value = hi.value;
      const x = e.x - THUMB / 2;
      const dl = Math.abs(x - lo.value);
      const dh = Math.abs(x - hi.value);
      active.value = Math.abs(dl - dh) < 2 ? 0 : dl < dh ? 1 : 2;
    })
    .onUpdate((e) => {
      'worklet';
      if (active.value === 0) {
        if (e.translationX < -2) active.value = 1;
        else if (e.translationX > 2) active.value = 2;
        else return;
      }
      if (active.value === 1) {
        lo.value = Math.min(hi.value, Math.max(0, startLo.value + e.translationX));
      } else {
        hi.value = Math.max(lo.value, Math.min(usable, startHi.value + e.translationX));
      }
    })
    .onFinalize(() => {
      'worklet';
      active.value = 0;
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
    <GestureDetector gesture={pan}>
      <View style={styles.wrap} onLayout={onLayout}>
        <View style={styles.track} />
        <Animated.View style={[styles.range, rangeStyle]} />

        <Animated.View style={[styles.thumbHit, loStyle]} pointerEvents="none">
          <View style={styles.thumb} />
        </Animated.View>
        <Animated.View style={[styles.thumbHit, hiStyle]} pointerEvents="none">
          <View style={styles.thumb} />
        </Animated.View>
      </View>
    </GestureDetector>
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
