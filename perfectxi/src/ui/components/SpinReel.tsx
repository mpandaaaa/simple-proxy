import { memo, useCallback, useEffect, useState } from 'react';
import { Image, Text, View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { color, radius, space, line } from '../tokens';
import { font } from '../type';
import { haptic, useReduceMotion } from '../feel';
import { GRAIN_URI } from '../grain';
import { eraOf } from '../../engine';
import {
  WHEEL,
  arrivalVelocity,
  buildReel,
  offsetFor,
  stepCount,
  stepDelays,
  type ReelItem,
} from '../../game/wheel';
import { ClubDisc } from './ClubDisc';

/**
 * The spin.
 *
 * The site's reel exists in its DOM but ships disabled, so what a player
 * actually sees there is the club name swapping as text on a timer. This is
 * that same spin with the reel switched on: identical step schedule,
 * identical three phase deceleration, identical haptic per step, but the
 * strip physically travels and the ticks come off real position rather than
 * off the timer that is also driving the text.
 *
 * The only motion the web could not do is the ending. The reel arrives at
 * the winner still carrying the speed of its last step, and the settle
 * spring takes that velocity, carries it past, and brings it back. The
 * overshoot is the reel's own momentum rather than a number someone chose.
 *
 * Every transform is a worklet reading one shared value, so the reel runs
 * on the UI thread and a slow JavaScript frame cannot stutter it.
 */
export function SpinReel({
  target,
  pool,
  allTime,
  onDetent,
  onSettled,
}: {
  /** set this to a club-season and the reel runs to it */
  target: ReelItem | null;
  pool: readonly ReelItem[];
  allTime?: boolean;
  /** every card that clicks past the pointer, so the era card can cycle */
  onDetent?: (item: ReelItem) => void;
  onSettled: () => void;
}) {
  const reduce = useReduceMotion();

  const x = useSharedValue(offsetFor(0));
  /** 1 at full pace, 0 once still: drives the smear and the dimming */
  const speed = useSharedValue(0);
  /** the accent bloom behind the window */
  const bloom = useSharedValue(0.22);
  /** the sweep of light across the window on landing */
  const flash = useSharedValue(0);
  /** the window flexing as the reel locks home */
  const pop = useSharedValue(0);

  /** highest detent the reel has clicked past this spin */
  const detent = useSharedValue(0);
  const ticking = useSharedValue(false);

  const [width, setWidth] = useState(0);
  const [strip, setStrip] = useState<ReelItem[]>(() =>
    pool.length ? buildReel(pool[0], pool, allTime) : [],
  );
  const [landed, setLanded] = useState<ReelItem | null>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  /**
   * A card clicking past the pointer. The site fires a 6ms buzz here;
   * selection is the iOS equivalent, and is Apple's own picker detent.
   */
  const tick = useCallback(
    (index: number) => {
      haptic('select');
      const item = strip[WHEEL.PAD + index];
      if (item && onDetent) onDetent(item);
    },
    [strip, onDetent],
  );

  const land = useCallback(
    (item: ReelItem) => {
      // the site's 40ms landing buzz
      haptic('heavy');
      setLanded(item);
      flash.value = withSequence(
        withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 }),
      );
      pop.value = withSequence(
        withSpring(1, { stiffness: 320, damping: 9, mass: 1 }),
        withSpring(0, { stiffness: 180, damping: 15, mass: 1 }),
      );
      onSettled();
    },
    [flash, pop, onSettled],
  );

  // Ticks come from real position: a reaction on the UI thread watching the
  // strip cross a card boundary. They slow with the reel because the reel
  // slows, not because a timer says so.
  useAnimatedReaction(
    () => x.value,
    (cur) => {
      'worklet';
      if (!ticking.value) return;
      const progress = -cur / WHEEL.CARD - WHEEL.PAD;
      const d = Math.floor(progress + 0.0001);
      if (d <= detent.value) return;
      detent.value = d;
      if (d >= 1) runOnJS(tick)(d);
    },
  );

  useEffect(() => {
    // No spin in flight: sit on a fresh strip with cards either side.
    if (!target) {
      if (pool.length) setStrip(buildReel(pool[0], pool, allTime));
      setLanded(null);
      x.value = offsetFor(0);
      speed.value = 0;
      bloom.value = 0.22;
      detent.value = 0;
      ticking.value = false;
      return;
    }
    if (!pool.length) return;

    const delays = stepDelays(allTime);
    const last = stepCount(allTime);

    setLanded(null);
    setStrip(buildReel(target, pool, allTime));
    x.value = offsetFor(0);
    flash.value = 0;
    pop.value = 0;
    detent.value = 0;

    if (reduce) {
      x.value = offsetFor(last);
      speed.value = 0;
      bloom.value = 1;
      haptic('heavy');
      setLanded(target);
      onSettled();
      return;
    }

    ticking.value = true;

    // One timed step per card, on the site's own three phase schedule,
    // then the settle spring carrying the reel's arrival speed.
    const steps = delays.map((ms, i) =>
      withTiming(offsetFor(i + 1), { duration: ms, easing: Easing.linear }),
    );

    x.value = withSequence(
      ...steps,
      withSpring(
        offsetFor(last),
        { ...WHEEL.SETTLE, velocity: arrivalVelocity(allTime) },
        (finished) => {
          'worklet';
          ticking.value = false;
          if (finished) runOnJS(land)(target);
        },
      ),
    );

    const runMs = delays.reduce((n, ms) => n + ms, 0);

    speed.value = withSequence(
      withTiming(1, { duration: 0 }),
      withTiming(0, { duration: runMs, easing: Easing.linear }),
    );

    // The window brightens as the reel gives up its speed.
    bloom.value = withTiming(1, { duration: runMs, easing: Easing.in(Easing.quad) });
    // A new target is a new spin. Nothing else may restart one in flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const idle = !target && !landed;
  const glow = landed ? eraOf(landed.season).tint : color.accent;
  const lead = width > 0 ? width / 2 - WHEEL.CARD / 2 : 0;

  const windowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pop.value, [0, 1], [1, 1.035]) }],
  }));
  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));
  const bloomStyle = useAnimatedStyle(() => ({ opacity: bloom.value }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flash.value, [0, 0.25, 1], [0, 0.8, 0]),
    transform: [{ translateX: interpolate(flash.value, [0, 1], [-140, width + 140]) }],
  }));

  return (
    <View style={styles.housing} onLayout={onLayout}>
      <View style={styles.orbs} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="orbA" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={color.accent} stopOpacity={0.15} />
              <Stop offset="1" stopColor={color.accent} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="orbB" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={color.gold} stopOpacity={0.07} />
              <Stop offset="1" stopColor={color.gold} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx="18" cy="14" rx="46" ry="40" fill="url(#orbA)" />
          <Ellipse cx="88" cy="92" rx="42" ry="38" fill="url(#orbB)" />
        </Svg>
      </View>

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
            <Ellipse cx="50" cy="50" rx="34" ry="62" fill="url(#reelBloom)" />
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

        <View style={styles.grain} pointerEvents="none">
          <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.grainImage} />
        </View>
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
    // where this card sits relative to the pointer, in cards
    const d = (index * WHEEL.CARD + x.value) / WHEEL.CARD;
    const ad = Math.abs(d);
    const c = Extrapolation.CLAMP;

    const scale = interpolate(ad, [0, 1, 2], [1, 0.9, 0.8], c);
    const smear = interpolate(speed.value, [0, 1], [1, 1.5]);

    return {
      opacity:
        interpolate(ad, [0, 1, 2], [1, 0.62, 0.24], c) *
        interpolate(speed.value, [0, 1], [1, 0.72]),
      transform: [
        { perspective: 760 },
        // cards bunch toward the pointer, the way a drum foreshortens
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
      <View style={[styles.card, dim && styles.cardDim, { borderColor: hexA(tint, 0.32) }]}>
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
    backgroundColor: '#0D1611',
    experimental_backgroundImage:
      'linear-gradient(180deg, #16231B 0%, #0C120E 55%, #080C09 100%)',
    boxShadow:
      '0px 18px 36px rgba(0,0,0,0.5), inset 0px 1px 0px rgba(255,255,255,0.08)',
    padding: space.s3,
    overflow: 'hidden',
  },
  orbs: { position: 'absolute', top: -40, left: -40, right: -40, bottom: -40 },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: '16%',
    right: '16%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  window: {
    height: WHEEL.CARD_H + space.s3 * 2,
    borderRadius: radius.lg,
    backgroundColor: '#070C09',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  grain: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.04 },
  grainImage: { width: '100%', height: '100%' },
  inset: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
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
    backgroundColor: '#111C15',
    experimental_backgroundImage: 'linear-gradient(180deg, #19271E 0%, #0E1710 100%)',
    boxShadow: 'inset 0px 1px 0px rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: space.s2,
  },
  cardDim: { opacity: 0.55 },
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
    width: 58,
    experimental_backgroundImage:
      'linear-gradient(90deg, rgba(7,12,9,1) 4%, rgba(7,12,9,0) 100%)',
  },
  fadeRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 58,
    experimental_backgroundImage:
      'linear-gradient(270deg, rgba(7,12,9,1) 4%, rgba(7,12,9,0) 100%)',
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
