import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { go } from '../../game/nav';
import { color, line, radius, space } from '../tokens';
import { font, text } from '../type';
import { GRAIN_URI } from '../grain';
import { haptic, useReduceMotion } from '../feel';
import { sfx } from '../sound';
import { achievementFor } from '../../game/achievements';
import { peekUnlock, shiftUnlock, subscribeUnlocks } from '../../game/unlocks';
import { Press } from './Press';
import { Shine } from './Shine';

/** How long a banner sits there before it leaves of its own accord. */
const HOLD_MS = 3600;

/**
 * An achievement arriving.
 *
 * Mounted once, above the whole navigator, so an unlock reaches you
 * wherever you are rather than waiting on a page you might never scroll
 * to. One at a time, in the order they were earned, and tapping it opens
 * the cabinet.
 *
 * The queue lives outside React so the screen that banks a season can push
 * into it and then navigate away without taking the banner with it.
 */
export function AchievementToast() {
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();
  const key = useSyncExternalStore(subscribeUnlocks, peekUnlock, peekUnlock);
  const [shown, setShown] = useState<string | null>(null);
  const p = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The banner holds on to what it is showing until its exit has played,
  // so the last one leaves properly rather than vanishing as the next
  // arrives.
  useEffect(() => {
    if (key && key !== shown) setShown(key);
  }, [key, shown]);

  useEffect(() => {
    if (!shown) return;
    const ach = achievementFor(shown);
    if (!ach) {
      shiftUnlock();
      setShown(null);
      return;
    }

    haptic('success');
    sfx('pick');

    p.value = 0;
    p.value = reduce
      ? withTiming(1, { duration: 140 })
      : withSpring(1, { stiffness: 210, damping: 20, mass: 1 });

    timer.current = setTimeout(() => {
      p.value = withTiming(0, { duration: reduce ? 120 : 240 }, (done) => {
        'worklet';
        if (done) {
          runOnJS(shiftUnlock)();
          runOnJS(setShown)(null);
        }
      });
    }, HOLD_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [shown, reduce, p]);

  const style = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * -70 }, { scale: 0.96 + p.value * 0.04 }],
  }));

  if (!shown) return null;
  const ach = achievementFor(shown);
  if (!ach) return null;

  return (
    <View
      style={[styles.root, { paddingTop: insets.top + space.s2 }]}
      pointerEvents="box-none"
    >
      <Animated.View style={style}>
        <Press
          onPress={() => {
            if (timer.current) clearTimeout(timer.current);
            shiftUnlock();
            setShown(null);
            go('/cabinet');
          }}
          feel="light"
          scaleTo={0.98}
          style={styles.card}
        >
          <Shine radius={radius.lg} group="feature" bevel={false} clip={false} />
          <View style={styles.grain} pointerEvents="none">
            <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.fill} />
          </View>

          <Text style={styles.mark} allowFontScaling={false}>
            {ach.mark}
          </Text>
          <View style={styles.body}>
            <Text style={styles.key}>Achievement unlocked</Text>
            <Text style={styles.name} numberOfLines={1}>
              {ach.name}
            </Text>
            <Text style={styles.desc} numberOfLines={2}>
              {ach.desc}
            </Text>
          </View>
        </Press>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: space.s4,
    zIndex: 90,
  },
  fill: { width: '100%', height: '100%' },
  grain: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: '#151308',
    experimental_backgroundImage:
      'linear-gradient(180deg, #2A2411 0%, #17140A 62%, #100E07 100%)',
    boxShadow: '0px 14px 34px rgba(0,0,0,0.6), 0px 0px 26px rgba(214,178,94,0.22)',
    overflow: 'hidden',
  },
  mark: { fontSize: 28, lineHeight: 36, width: 40, textAlign: 'center' },
  body: { flex: 1, minWidth: 0 },
  key: { ...text.key, fontSize: 8.5, color: color.gold },
  name: {
    fontFamily: font.displayBlack,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: 0.2,
    color: color.text1,
  },
  desc: { ...text.small, fontSize: 12, lineHeight: 16 },
});
