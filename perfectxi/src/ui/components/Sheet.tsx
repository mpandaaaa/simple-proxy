import { ReactNode, useCallback, useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
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
  onClosed,
  bare,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  /**
   * Skip the panel and render the children straight onto the dim.
   *
   * Only for a caller that draws its own surface, as the draft board does.
   * Everything else wants the panel, and without it the sheet has no
   * background at all: the screen behind shows straight through the text,
   * which looks like the app has glitched rather than opened something.
   */
  bare?: boolean;
  /**
   * Fired once the exit has played and the modal is gone.
   *
   * Anything that opens another modal has to wait for this. iOS will not
   * present a modal while one is dismissing, so starting the next one from
   * the button press means it silently never appears.
   */
  onClosed?: () => void;
  children: ReactNode;
}) {
  const reduce = useReduceMotion();
  const { height: screen } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const height = useSharedValue(600);
  const y = useSharedValue(600);
  const start = useSharedValue(0);
  /* Whether the content inside is scrolled to the top. The sheet can only
     be thrown away from there, or every flick down inside a long page
     would close it instead of scrolling. */
  const atTop = useSharedValue(1);

  const unmount = useCallback(() => {
    setMounted(false);
    onClosed?.();
  }, [onClosed]);

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
    .activeOffsetY(10)
    .failOffsetY(-10)
    .onBegin(() => {
      'worklet';
      start.value = y.value;
    })
    .onUpdate((e) => {
      'worklet';
      if (!atTop.value) return;
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
    <Modal
      /*
       * Without this a modal is portrait only, whatever the device is
       * doing. React Native defaults supportedOrientations to portrait
       * alone, so on an iPad held sideways the card came up rotated in a
       * squeezed window in the middle of the screen while everything
       * behind it stayed landscape.
       *
       * Both landscapes, because a tablet is turned either way.
       */
      supportedOrientations={['portrait', 'landscape']}
      visible transparent animationType="none" onRequestClose={close}
    >
      <View style={styles.root}>
        <Animated.View style={[styles.dim, dimStyle]}>
          <Animated.View
            style={styles.dimHit}
            onTouchEnd={close}
            pointerEvents="auto"
          />
        </Animated.View>

        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheet, styles.sheetWrap, sheetStyle]} onLayout={onLayout}>
            {bare ? (
              children
            ) : (
              /* Capped at seven eighths of the screen and scrolling inside.
                 A player's page grew past the height of a phone and the top
                 of it went under the status bar with no way to reach the
                 bottom. The handle stays put and the content moves. */
              <View style={[styles.panel, { maxHeight: screen * 0.87 }]}>
                <View style={styles.edge} pointerEvents="none" />
                <View style={styles.grab} />
                <ScrollView
                  style={styles.scroll}
                  contentContainerStyle={styles.scrollBody}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  scrollEventThrottle={16}
                  onScroll={(e) => {
                    atTop.value = e.nativeEvent.contentOffset.y <= 1 ? 1 : 0;
                  }}
                >
                  {children}
                </ScrollView>
              </View>
            )}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  /*
   * A sheet the width of a thirteen inch iPad is not a sheet, it is a
   * wall coming up off the bottom of the screen. Capped and centred, so
   * it stays the same object it is on a phone. A phone is narrower than
   * this, so a phone is unchanged.
   */
  sheetWrap: { width: '100%', maxWidth: 620, alignSelf: 'center' },
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
  panel: {
    backgroundColor: '#0B120E',
    experimental_backgroundImage:
      'linear-gradient(180deg, #16231B 0%, #0B120E 52%, #070B08 100%)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    boxShadow: '0px -20px 50px rgba(0,0,0,0.6)',
    paddingTop: space.s3,
    overflow: 'hidden',
  },
  scroll: { flexGrow: 0 },
  scrollBody: {
    paddingHorizontal: space.s5,
    paddingBottom: space.s7,
    gap: space.s2,
  },
  edge: {
    position: 'absolute',
    top: 0,
    left: '18%',
    right: '18%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  grab: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: space.s2,
  },
});
