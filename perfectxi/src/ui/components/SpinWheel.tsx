import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Text, View, StyleSheet } from 'react-native';
import { color, radius, space, line, gradient, shadow } from '../tokens';
import { font, text } from '../type';
import { haptic, useReduceMotion } from '../feel';
import { clubCode, clubColour } from '../../engine';
import {
  WHEEL,
  buildReel,
  landingAt,
  spinDuration,
  tickSchedule,
  travelDistance,
  type ReelItem,
} from '../../game/wheel';

const WINDOW = WHEEL.VISIBLE * WHEEL.ITEM;
/** strips above the centre slot, so index 0 starts centred */
const LEAD = (WHEEL.VISIBLE - 1) / 2;

/**
 * The spin.
 *
 * A vertical reel of real club-seasons that runs, decelerates, carries
 * past the winner and springs back onto it. The transform is driven by
 * the native animation driver, so the reel itself never touches React
 * while it is moving and runs at whatever the display can do.
 *
 * The ticks are not read off the animation. The curve is known in advance,
 * so the exact moment every strip crosses the centre line is solved for up
 * front in src/game/wheel.ts and the haptics are fired from that schedule.
 * That is both more accurate than sampling a running animation and immune
 * to a dropped frame, and it is why the ticking slows in a straight line
 * rather than stuttering.
 */
export function SpinWheel({
  target,
  pool,
  onSettled,
}: {
  /** set this to a club-season and the reel runs to it */
  target: ReelItem | null;
  pool: readonly ReelItem[];
  onSettled: () => void;
}) {
  const reduce = useReduceMotion();
  const y = useRef(new Animated.Value(0)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [strip, setStrip] = useState<ReelItem[]>(() =>
    pool.length ? buildReel(pool[0], pool) : [],
  );
  const [running, setRunning] = useState(false);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (!target || !pool.length) return;

    const reel = buildReel(target, pool);
    setStrip(reel);
    y.setValue(0);

    if (reduce) {
      // No reel, no ticks. The result still lands, and it still confirms
      // itself with the same firm tap.
      y.setValue(-WHEEL.TRAVEL * WHEEL.ITEM);
      haptic('medium');
      onSettled();
      return;
    }

    setRunning(true);

    for (const tick of tickSchedule()) {
      timers.current.push(
        setTimeout(() => haptic(tick.strong ? 'medium' : 'light'), tick.at),
      );
    }
    // the reel locking home after the overshoot
    timers.current.push(setTimeout(() => haptic('light'), spinDuration));

    Animated.sequence([
      Animated.timing(y, {
        toValue: -travelDistance,
        duration: WHEEL.SPIN_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(y, {
        toValue: -WHEEL.TRAVEL * WHEEL.ITEM,
        useNativeDriver: true,
        speed: 14,
        bounciness: 6,
      }),
    ]).start(({ finished }) => {
      setRunning(false);
      if (finished) onSettled();
    });

    return clearTimers;
    // Deliberately keyed on the target alone: a new target is a new spin,
    // and nothing else here should be able to restart one mid flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const idle = !target && !running;

  return (
    <View style={styles.wrap}>
      <View style={styles.window}>
        {/* the slot the winner comes to rest in */}
        <View style={styles.centreBand} pointerEvents="none" />

        <Animated.View
          style={[styles.strip, { transform: [{ translateY: y }] }]}
        >
          {strip.map((item, i) => (
            <Strip key={i} item={item} dim={idle} />
          ))}
        </Animated.View>

        <View style={styles.fadeTop} pointerEvents="none" />
        <View style={styles.fadeBottom} pointerEvents="none" />
        <View style={styles.markerLeft} pointerEvents="none" />
        <View style={styles.markerRight} pointerEvents="none" />
      </View>
    </View>
  );
}

function Strip({ item, dim }: { item: ReelItem; dim: boolean }) {
  const c = clubColour(item.club);
  return (
    <View style={[styles.item, dim && styles.itemDim]}>
      <View
        style={[
          styles.disc,
          {
            backgroundColor: c,
            experimental_backgroundImage: `linear-gradient(145deg, ${c} 0%, rgba(0,0,0,0.55) 100%)`,
          },
        ]}
      >
        <Text style={styles.discText}>{clubCode(item.club)}</Text>
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.club} numberOfLines={1}>
          {item.club}
        </Text>
        <Text style={styles.season}>{item.season}</Text>
      </View>
    </View>
  );
}

/** Reported by the setup screen so the numbers are visible in the app too. */
export const spinFacts = {
  duration: spinDuration,
  landing: landingAt(),
  ticks: tickSchedule().length,
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'stretch' },
  window: {
    height: WINDOW,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#0C140F',
    experimental_backgroundImage: gradient.card,
    boxShadow: shadow.lift,
    overflow: 'hidden',
  },
  strip: { paddingTop: LEAD * WHEEL.ITEM },
  item: {
    height: WHEEL.ITEM,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingHorizontal: space.s4,
  },
  itemDim: { opacity: 0.35 },
  disc: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discText: {
    fontFamily: font.displayBold,
    fontSize: 12,
    letterSpacing: 0.3,
    color: '#FFFFFF',
  },
  itemBody: { flex: 1, minWidth: 0 },
  club: {
    fontFamily: font.displayBold,
    fontSize: 20,
    lineHeight: 23,
    letterSpacing: 0.3,
    color: color.text1,
  },
  season: {
    ...text.key,
    fontSize: 10.5,
    color: color.text3,
  },

  centreBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: LEAD * WHEEL.ITEM,
    height: WHEEL.ITEM,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(31,197,126,0.45)',
    backgroundColor: 'rgba(31,197,126,0.07)',
  },
  markerLeft: {
    position: 'absolute',
    left: 0,
    top: LEAD * WHEEL.ITEM + WHEEL.ITEM / 2 - 7,
    width: 4,
    height: 14,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: color.accent,
  },
  markerRight: {
    position: 'absolute',
    right: 0,
    top: LEAD * WHEEL.ITEM + WHEEL.ITEM / 2 - 7,
    width: 4,
    height: 14,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
    backgroundColor: color.accent,
  },

  fadeTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: WHEEL.ITEM * 1.6,
    experimental_backgroundImage:
      'linear-gradient(180deg, rgba(10,15,12,0.98) 0%, rgba(10,15,12,0.0) 100%)',
  },
  fadeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: WHEEL.ITEM * 1.6,
    experimental_backgroundImage:
      'linear-gradient(0deg, rgba(10,15,12,0.98) 0%, rgba(10,15,12,0.0) 100%)',
  },
});
