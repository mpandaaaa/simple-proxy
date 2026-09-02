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
import { GRAIN_URI } from '../grain';
import { eraOf } from '../../engine';
import {
  NEAR_MISS_AT,
  OVERSHOOT_AT,
  SETTLE_SPRING,
  WHEEL,
  WINNER_AT,
  buildReel,
  offsetFor,
  type ReelItem,
} from '../../game/wheel';
import { ClubDisc } from './ClubDisc';

/** how long the landed card is held lit before the era card takes over */
const HOLD_MS = 520;

/**
 * The spin.
 *
 * A reel is stepped, not swept. It clicks through thirteen detents on a
 * three phase schedule, drags the last two out, then stops one short and
 * holds there before lurching the final card, carrying one past the winner
 * and springing back onto it.
 *
 * The card hanging in the window during that held beat is deliberately a
 * big club. It changes nothing: the result was drawn before the reel moved
 * a pixel. It is there because a spin that visibly nearly lands somewhere
 * else has a shape, and one that simply stops does not.
 *
 * Every transform is a worklet reading one shared value, so the reel runs
 * on the UI thread and a slow JavaScript frame cannot stutter it. The ticks
 * come off real position: a reaction watches the scroll cross detents. No
 * thinning is needed any more, because the step schedule already spaces
 * them further apart than the Taptic Engine can resolve.
 */
export function SpinReel({
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
    pool.length ? buildReel(pool[0], pool) : [],
  );
  const [landed, setLanded] = useState<ReelItem | null>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  /** A detent clicking into the window. Selection is Apple's own reel tick. */
  const tick = useCallback(() => haptic('select'), []);

  const land = useCallback(
    (item: ReelItem) => {
      // The report's landing stack: a soft body, then a sharp beat on top.
      haptic('medium');
      setTimeout(() => haptic('success'), 80);
      setLanded(item);
      flash.value = withSequence(
        withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 }),
      );
      pop.value = withSequence(
        withSpring(1, { stiffness: 320, damping: 9, mass: 1 }),
        withSpring(0, { stiffness: 180, damping: 15, mass: 1 }),
      );
      setTimeout(onSettled, HOLD_MS);
    },
    [flash, pop, onSettled],
  );

  // Position driven ticks. Each step ends exactly on a detent, so crossing
  // one is the same event as a card clicking into the window.
  useAnimatedReaction(
    () => x.value,
    (cur) => {
      'worklet';
      if (!ticking.value) return;
      const progress = -cur / WHEEL.CARD - WHEEL.PAD;
      const d = Math.floor(progress + 0.0001);
      if (d <= detent.value) return;
      detent.value = d;
      // Only the detents before the held beat tick. The landing gets its
      // own, heavier stack when the settle spring finishes.
      if (d >= 1 && d <= NEAR_MISS_AT) runOnJS(tick)();
    },
  );

  useEffect(() => {
    // No spin in flight: sit on a fresh strip with cards either side.
    if (!target) {
      if (pool.length) setStrip(buildReel(pool[0], pool));
      setLanded(null);
      x.value = offsetFor(0);
      speed.value = 0;
      bloom.value = 0.22;
      detent.value = 0;
      ticking.value = false;
      return;
    }
    if (!pool.length) return;

    setLanded(null);
    setStrip(buildReel(target, pool));
    x.value = offsetFor(0);
    flash.value = 0;
    pop.value = 0;
    detent.value = 0;

    if (reduce) {
      x.value = offsetFor(WINNER_AT);
      speed.value = 0;
      bloom.value = 1;
      haptic('medium');
      setLanded(target);
      const t = setTimeout(onSettled, 200);
      return () => clearTimeout(t);
    }

    ticking.value = true;

    // creep back, then one timed step per detent, then the held beat, the
    // lurch past the winner, and the spring back onto it
    const steps = WHEEL.STEPS.map((ms, i) =>
      withTiming(offsetFor(i + 1), { duration: ms, easing: Easing.linear }),
    );

    x.value = withSequence(
      withTiming(offsetFor(0) + WHEEL.CREEP, {
        duration: WHEEL.CREEP_MS,
        easing: Easing.inOut(Easing.quad),
      }),
      ...steps,
      withDelay(
        WHEEL.HELD_MS,
        withTiming(offsetFor(OVERSHOOT_AT), {
          duration: WHEEL.LURCH_MS,
          easing: Easing.out(Easing.quad),
        }),
      ),
      withSpring(offsetFor(WINNER_AT), SETTLE_SPRING, (finished) => {
        'worklet';
        ticking.value = false;
        if (finished) runOnJS(land)(target);
      }),
    );

    const runMs = WHEEL.STEPS.reduce((n, ms) => n + ms, 0);

    // Smear tracks the schedule rather than the position: it is at its
    // strongest through the fast phase and gone by the held beat.
    speed.value = withDelay(
      WHEEL.CREEP_MS,
      withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(0, { duration: runMs, easing: Easing.in(Easing.quad) }),
      ),
    );

    // The window dims for the held beat, then comes up hard on the landing.
    bloom.value = withDelay(
      WHEEL.CREEP_MS,
      withSequence(
        withTiming(0.5, { duration: runMs, easing: Easing.linear }),
        withTiming(0.18, { duration: WHEEL.HELD_MS, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: WHEEL.LURCH_MS + 120, easing: Easing.out(Easing.quad) }),
      ),
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
      {/* ambient orbs: low frequency light under everything, so the panel
          is lit rather than filled */}
      <View style={styles.orbs} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="orbA" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={color.accent} stopOpacity={0.16} />
              <Stop offset="1" stopColor={color.accent} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="orbB" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={color.gold} stopOpacity={0.08} />
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
                <Stop offset="0" stopColor={glow} stopOpacity={0.62} />
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

        {/* Image has no pointerEvents prop, so it is wrapped rather than
            left able to swallow a touch. */}
        <View style={styles.grain} pointerEvents="none">
          <Image
            source={{ uri: GRAIN_URI }}
            resizeMode="repeat"
            style={styles.grainImage}
          />
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
    // where this card sits relative to the centre line, in cards
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
    // Elevation on dark comes from the surface getting lighter, not from a
    // shadow nobody can see.
    backgroundColor: '#0D1611',
    experimental_backgroundImage:
      'linear-gradient(180deg, #16231B 0%, #0C120E 55%, #080C09 100%)',
    boxShadow:
      '0px 20px 40px rgba(0,0,0,0.55), inset 0px 1px 0px rgba(255,255,255,0.08)',
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
  grain: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.04,
  },
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
