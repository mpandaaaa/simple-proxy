import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { color, radius, space, line } from '../tokens';
import { font } from '../type';
import { haptic, useReduceMotion } from '../feel';
import { eraOf } from '../../engine';
import {
  WHEEL,
  buildReel,
  spinMs,
  tickIndices,
  travelDistance,
  type ReelItem,
} from '../../game/wheel';
import { ClubDisc } from './ClubDisc';

/** how long the landed card is held lit before the era card takes over */
const HOLD_MS = 520;

/**
 * The spin, as a reel that actually travels.
 *
 * The web build ships its reel with `display:none` and cycles the club
 * name as text instead, because that is all a browser could do well. This
 * is what the site was reaching for: cards crossing a lit window, scaling
 * and turning away on a drum.
 *
 * Every transform is a worklet reading one shared value, so the reel runs
 * entirely on the UI thread and a slow JavaScript frame cannot stutter it.
 *
 * The ticks are fired from real position, not from a stopwatch: a reaction
 * on the UI thread watches the scroll cross card boundaries. Which
 * boundaries earn a tick is decided up front in src/game/wheel.ts, because
 * a naive tick on every boundary fires them 32ms apart at full pace and
 * the Taptic Engine renders that as one buzz rather than as ticking.
 *
 * The motion blur is a horizontal stretch rather than a Gaussian. Real
 * blur exists here but wraps the view in a SwiftUI host, and changing it
 * mid spin means tearing that down at the exact moment there is no frame
 * to spare.
 */
export function SpinReel({
  target,
  pool,
  allTime,
  onSettled,
}: {
  /** set this to a club-season and the reel runs to it */
  target: ReelItem | null;
  pool: readonly ReelItem[];
  allTime?: boolean;
  onSettled: () => void;
}) {
  const reduce = useReduceMotion();

  const x = useSharedValue(0);
  /** 1 at full pace, 0 once still: drives the smear and the dimming */
  const speed = useSharedValue(0);
  /** the accent bloom behind the window, low while the reel is quick */
  const bloom = useSharedValue(0.25);
  /** the sweep of light across the window on landing */
  const flash = useSharedValue(0);
  /** the window flexing as the reel locks home */
  const pop = useSharedValue(0);

  /** highest card boundary the reel has crossed this spin */
  const crossed = useSharedValue(0);
  const ticking = useSharedValue(false);

  const [width, setWidth] = useState(0);
  const [strip, setStrip] = useState<ReelItem[]>(() =>
    pool.length ? buildReel(pool[0], pool) : [],
  );
  const [landed, setLanded] = useState<ReelItem | null>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const fireTick = useCallback((strong: boolean) => {
    haptic(strong ? 'medium' : 'light');
  }, []);

  const land = useCallback(
    (item: ReelItem) => {
      setLanded(item);
      flash.value = withSequence(
        withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 }),
      );
      pop.value = withSequence(
        withSpring(1, { damping: 8, stiffness: 320 }),
        withSpring(0, { damping: 14, stiffness: 180 }),
      );
      setTimeout(onSettled, HOLD_MS);
    },
    [flash, pop, onSettled],
  );

  // Position driven ticks. A reaction runs on the UI thread every frame the
  // scroll changes, so a tick lands when the boundary actually crosses
  // rather than when a timer thinks it should have.
  // Memoised: the reaction worklet captures this, and rebuilding the array
  // on every render would rebuild the worklet with it.
  const keep = useMemo(() => tickIndices(allTime), [allTime]);
  useAnimatedReaction(
    () => x.value,
    (cur) => {
      'worklet';
      if (!ticking.value) return;
      const travelled = -cur;
      if (travelled <= 0) return;

      const idx = Math.min(WHEEL.TRAVEL, Math.floor(travelled / WHEEL.CARD) + 1);
      if (idx <= crossed.value) return;

      const from = crossed.value;
      crossed.value = idx;

      // A dropped frame can carry the reel past more than one boundary.
      // Fire once for the newest kept one rather than a burst for each.
      for (let k = idx; k > from; k--) {
        if (keep[k]) {
          runOnJS(fireTick)(k === WHEEL.TRAVEL);
          return;
        }
      }
    },
  );

  useEffect(() => {
    if (!target || !pool.length) return;

    setLanded(null);
    setStrip(buildReel(target, pool));
    x.value = 0;
    flash.value = 0;
    pop.value = 0;
    crossed.value = 0;

    if (reduce) {
      x.value = -WHEEL.TRAVEL * WHEEL.CARD;
      speed.value = 0;
      bloom.value = 1;
      haptic('medium');
      setLanded(target);
      const t = setTimeout(onSettled, 200);
      return () => clearTimeout(t);
    }

    speed.value = 0;
    bloom.value = 0.25;
    ticking.value = true;

    const D = spinMs(!!allTime);

    x.value = withSequence(
      // Anticipation: the reel eases back before it goes, the way a wheel
      // is wound. Without it the first frame is already at full speed.
      withTiming(WHEEL.CREEP, {
        duration: WHEEL.CREEP_MS,
        easing: Easing.inOut(Easing.quad),
      }),
      withTiming(-travelDistance, { duration: D, easing: Easing.out(Easing.quad) }),
      withSpring(
        -WHEEL.TRAVEL * WHEEL.CARD,
        { damping: 13, stiffness: 210, mass: 1 },
        (finished) => {
          'worklet';
          ticking.value = false;
          if (finished) runOnJS(land)(target);
        },
      ),
    );

    // Velocity of an out-quad falls off linearly, so the smear does too.
    speed.value = withDelay(
      WHEEL.CREEP_MS,
      withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(0, { duration: D, easing: Easing.linear }),
      ),
    );

    bloom.value = withDelay(
      WHEEL.CREEP_MS,
      withTiming(1, { duration: D, easing: Easing.in(Easing.quad) }),
    );
    // A new target is a new spin. Nothing else may restart one in flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const idle = !target && !landed;
  const glow = landed ? eraOf(landed.season).tint : color.accent;
  const lead = width > 0 ? width / 2 - WHEEL.CARD / 2 : 0;

  const windowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pop.value, [0, 1], [1, 1.04]) }],
  }));
  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));
  const bloomStyle = useAnimatedStyle(() => ({ opacity: bloom.value }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flash.value, [0, 0.25, 1], [0, 0.85, 0]),
    transform: [
      { translateX: interpolate(flash.value, [0, 1], [-140, width + 140]) },
    ],
  }));

  return (
    <View style={styles.housing} onLayout={onLayout}>
      <View style={styles.topEdge} pointerEvents="none" />

      <Animated.View style={[styles.window, windowStyle]}>
        <Animated.View style={[styles.bloomWrap, bloomStyle]} pointerEvents="none">
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <Defs>
              <RadialGradient id="reelBloom" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={glow} stopOpacity={0.6} />
                <Stop offset="0.5" stopColor={glow} stopOpacity={0.18} />
                <Stop offset="1" stopColor={glow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx="50" cy="50" rx="34" ry="60" fill="url(#reelBloom)" />
          </Svg>
        </Animated.View>

        {width > 0 ? (
          <Animated.View style={[styles.strip, { paddingLeft: lead }, stripStyle]}>
            {strip.map((item, i) => (
              <ReelCard key={i} item={item} index={i} x={x} speed={speed} dim={idle} />
            ))}
          </Animated.View>
        ) : null}

        {width > 0 ? (
          <View
            style={[
              styles.selection,
              { left: width / 2 - WHEEL.CARD_W / 2 - 4, borderColor: glow },
            ]}
            pointerEvents="none"
          >
            <View
              style={[
                styles.selectionFill,
                { boxShadow: `inset 0px 0px 22px ${hexA(glow, 0.45)}` },
              ]}
            />
            <View style={[styles.notch, styles.notchTop, { backgroundColor: glow }]} />
            <View style={[styles.notch, styles.notchBottom, { backgroundColor: glow }]} />
          </View>
        ) : null}

        <View style={styles.fadeLeft} pointerEvents="none" />
        <View style={styles.fadeRight} pointerEvents="none" />

        <Animated.View pointerEvents="none" style={[styles.flash, flashStyle]} />

        <View style={styles.inset} pointerEvents="none" />
      </Animated.View>
    </View>
  );
}

/**
 * One card on the drum. Its whole appearance is a worklet reading the
 * shared scroll value, so it never re-renders while the reel turns.
 */
const ReelCard = memo(function ReelCard({
  item,
  index,
  x,
  speed,
  dim,
}: {
  item: ReelItem;
  index: number;
  x: SharedValue<number>;
  speed: SharedValue<number>;
  dim: boolean;
}) {
  const style = useAnimatedStyle(() => {
    // where this card sits relative to the centre line, in cards
    const d = (index * WHEEL.CARD + x.value) / WHEEL.CARD;
    const ad = Math.abs(d);
    const c = Extrapolation.CLAMP;

    const scale = interpolate(ad, [0, 1, 2], [1, 0.9, 0.8], c);
    const smear = interpolate(speed.value, [0, 1], [1, 1.55]);

    return {
      opacity:
        interpolate(ad, [0, 1, 2], [1, 0.6, 0.22], c) *
        interpolate(speed.value, [0, 1], [1, 0.7]),
      transform: [
        { perspective: 760 },
        // cards bunch toward the centre, the way a drum foreshortens
        { translateX: interpolate(d, [-2, -1, 0, 1, 2], [18, 6, 0, -6, -18], c) },
        { rotateY: `${interpolate(d, [-2, -1, 0, 1, 2], [-40, -21, 0, 21, 40], c)}deg` },
        { scaleX: scale * smear },
        { scaleY: scale },
      ],
    };
  });

  const tint = eraOf(item.season).tint;

  return (
    <Animated.View style={[styles.cardSlot, style]}>
      <View style={[styles.card, dim && styles.cardDim, { borderColor: hexA(tint, 0.3) }]}>
        <ClubDisc club={item.club} size={44} />
        <Text style={styles.club} numberOfLines={2}>
          {item.club}
        </Text>
        <Text style={styles.season}>{item.season}</Text>
      </View>
    </Animated.View>
  );
});

/** #RRGGBB plus an alpha, for tints that follow the era colour. */
function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

const styles = StyleSheet.create({
  housing: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#0B120E',
    experimental_backgroundImage:
      'linear-gradient(180deg, #131E17 0%, #0A100C 55%, #070B08 100%)',
    boxShadow:
      '0px 20px 40px rgba(0,0,0,0.55), inset 0px 1px 0px rgba(255,255,255,0.07)',
    padding: space.s3,
    overflow: 'hidden',
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: '16%',
    right: '16%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },

  window: {
    height: WHEEL.CARD_H + space.s3 * 2,
    borderRadius: radius.lg,
    backgroundColor: '#060A07',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inset: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    // doubles as the vignette: the reel darkens into its own housing
    boxShadow: 'inset 0px 0px 30px rgba(0,0,0,0.9)',
  },

  bloomWrap: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },

  strip: { flexDirection: 'row', alignItems: 'center' },
  cardSlot: { width: WHEEL.CARD, alignItems: 'center' },
  card: {
    width: WHEEL.CARD_W,
    height: WHEEL.CARD_H,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: '#101A14',
    experimental_backgroundImage: 'linear-gradient(180deg, #17241C 0%, #0D150F 100%)',
    boxShadow: '0px 6px 16px rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: space.s2,
  },
  cardDim: { opacity: 0.5 },
  club: {
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 17,
    letterSpacing: 0.2,
    color: color.text1,
    textAlign: 'center',
  },
  season: {
    fontFamily: font.displaySemi,
    fontSize: 10,
    letterSpacing: 1.4,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },

  selection: {
    position: 'absolute',
    top: space.s2,
    bottom: space.s2,
    width: WHEEL.CARD_W + 8,
    borderRadius: radius.md + 2,
    borderWidth: 1.5,
  },
  selectionFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.md + 2,
  },
  notch: { position: 'absolute', left: '50%', marginLeft: -10, width: 20, height: 3 },
  notchTop: { top: -6, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  notchBottom: { bottom: -6, borderTopLeftRadius: 2, borderTopRightRadius: 2 },

  fadeLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 64,
    experimental_backgroundImage:
      'linear-gradient(90deg, rgba(6,10,7,1) 6%, rgba(6,10,7,0) 100%)',
  },
  fadeRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 64,
    experimental_backgroundImage:
      'linear-gradient(270deg, rgba(6,10,7,1) 6%, rgba(6,10,7,0) 100%)',
  },

  flash: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 120,
    experimental_backgroundImage:
      'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0) 100%)',
  },
});
