import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Modal, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Extrapolation,
} from 'react-native-reanimated';
import { space } from '../tokens';
import { haptic, useReduceMotion } from '../feel';

/** Snappy, minimal overshoot: this is furniture, not a reward. */
const SNAP = { stiffness: 320, damping: 30, mass: 1 } as const;
/** Past this much of its own height, a release dismisses rather than returns. */
const DISMISS_AT = 0.32;
/** Or a flick faster than this, wherever it happens to be. */
const FLICK = 900;

/**
 * A bottom sheet you can actually throw away.
 *
 * The sheet follows the finger, comes back if you let go early, and leaves
 * under its own momentum if you flick it. Tapping the dimmed area does the
 * same animation rather than cutting the sheet out of existence, which is
 * what it was doing before.
 *
 * The dim behind it is tied to the drag, so the room brightens as the sheet
 * gets out of the way instead of switching off at the end.
 *
 * The modal stays mounted until the exit animation has finished. Unmounting
 * on the press is exactly what makes a sheet vanish.
 */
export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const reduce = useReduceMotion();
  const [mounted, setMounted] = useState(visible);
  const height = useSharedValue(600);
  const y = useSharedValue(600);
  const start = useSharedValue(0);

  const unmount = useCallback(() => setMounted(false), []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    // Asked to close from outside: play the exit, then unmount.
    y.value = reduce
      ? withTiming(height.value, { duration: 120 }, (f) => {
          'worklet';
          if (f) runOnJS(unmount)();
        })
      : withSpring(height.value, { ...SNAP, damping: 34 }, (f) => {
          'worklet';
          if (f) runOnJS(unmount)();
        });
  }, [visible, y, height, reduce, unmount]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      height.value = h;
      // First measurement: start off screen, then come up.
      if (y.value > h || y.value === 600) {
        y.value = h;
        y.value = reduce ? withTiming(0, { duration: 140 }) : withSpring(0, SNAP);
      }
    },
    [height, y, reduce],
  );

  const close = useCallback(() => {
    haptic('light');
    onClose();
  }, [onClose]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      start.value = y.value;
    })
    .onUpdate((e) => {
      'worklet';
      // Downwards only. Dragging up should not peel the sheet off the top.
      y.value = Math.max(0, start.value + e.translationY);
    })
    .onEnd((e) => {
      'worklet';
      const far = y.value > height.value * DISMISS_AT;
      if (far || e.velocityY > FLICK) {
        y.value = withSpring(
          height.value,
          { ...SNAP, damping: 34, velocity: e.velocityY },
          (f) => {
            'worklet';
            if (f) runOnJS(close)();
          },
        );
      } else {
        y.value = withSpring(0, { ...SNAP, velocity: e.velocityY });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));
  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      y.value,
      [0, height.value],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <View style={styles.root}>
        <Animated.View style={[styles.dim, dimStyle]}>
          <Animated.View
            style={styles.dimHit}
            onTouchEnd={close}
            pointerEvents="auto"
          />
        </Animated.View>

        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheet, sheetStyle]} onLayout={onLayout}>
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  dim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(3,6,4,0.76)',
  },
  dimHit: { flex: 1 },
  sheet: { paddingBottom: space.s2 },
});
