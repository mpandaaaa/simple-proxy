import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Text,
  View,
  StyleSheet,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { color, radius, space, line } from '../tokens';
import { font } from '../type';
import { haptic, useReduceMotion } from '../feel';
import { eraOf } from '../../engine';
import {
  WHEEL,
  buildReel,
  spinMs,
  tickSchedule,
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
 * is the thing the site was reaching for: cards crossing a lit window,
 * scaling and turning away on a drum, with the ticks landing on real card
 * boundaries.
 *
 * Every transform is an interpolation of the one value driving the scroll,
 * so the whole reel lives in the native animation graph and React does not
 * run a frame while it moves.
 *
 * The motion blur is a horizontal stretch rather than a Gaussian. Real
 * blur exists here, but it wraps the view in a SwiftUI host, and changing
 * it mid spin means tearing that down at the exact moment there is no
 * frame to spare.
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

  const x = useRef(new Animated.Value(0)).current;
  /** 1 at full pace, 0 once still: drives the smear and the dimming */
  const speed = useRef(new Animated.Value(0)).current;
  /** the accent bloom under the window, low while the reel is quick */
  const bloom = useRef(new Animated.Value(0.25)).current;
  /** the sweep of light across the window on landing */
  const flash = useRef(new Animated.Value(0)).current;
  /** the window flexing as the reel locks home */
  const pop = useRef(new Animated.Value(0)).current;

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [width, setWidth] = useState(0);
  const [strip, setStrip] = useState<ReelItem[]>(() =>
    pool.length ? buildReel(pool[0], pool) : [],
  );
  const [landed, setLanded] = useState<ReelItem | null>(null);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  useEffect(() => {
    if (!target || !pool.length) return;

    setLanded(null);
    setStrip(buildReel(target, pool));
    x.setValue(0);
    flash.setValue(0);
    pop.setValue(0);

    if (reduce) {
      x.setValue(-WHEEL.TRAVEL * WHEEL.CARD);
      speed.setValue(0);
      bloom.setValue(1);
      haptic('medium');
      setLanded(target);
      timers.current.push(setTimeout(onSettled, 200));
      return;
    }

    speed.setValue(0);
    bloom.setValue(0.25);

    for (const tick of tickSchedule(allTime)) {
      timers.current.push(
        setTimeout(() => haptic(tick.strong ? 'medium' : 'light'), tick.at),
      );
    }

    const D = spinMs(!!allTime);

    Animated.parallel([
      Animated.sequence([
        // Anticipation: the reel eases back before it goes, the way a
        // wheel is wound. Without it the spin starts from nothing and the
        // first frame is already at full speed.
        Animated.timing(x, {
          toValue: WHEEL.CREEP,
          duration: WHEEL.CREEP_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(x, {
          toValue: -travelDistance,
          duration: D,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(x, {
          toValue: -WHEEL.TRAVEL * WHEEL.CARD,
          useNativeDriver: true,
          speed: 15,
          bounciness: 7,
        }),
      ]),
      Animated.sequence([
        Animated.delay(WHEEL.CREEP_MS),
        // Velocity of an out-quad falls off linearly, so the smear does too.
        Animated.timing(speed, {
          toValue: 1,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(speed, {
          toValue: 0,
          duration: D,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(WHEEL.CREEP_MS),
        Animated.timing(bloom, {
          toValue: 1,
          duration: D,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (!finished) return;

      setLanded(target);

      Animated.parallel([
        Animated.sequence([
          Animated.timing(flash, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(flash, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.spring(pop, {
            toValue: 1,
            useNativeDriver: true,
            speed: 20,
            bounciness: 16,
          }),
          Animated.spring(pop, {
            toValue: 0,
            useNativeDriver: true,
            speed: 14,
            bounciness: 4,
          }),
        ]),
      ]).start();

      timers.current.push(setTimeout(onSettled, HOLD_MS));
    });

    return clearTimers;
    // A new target is a new spin. Nothing else may restart one in flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const idle = !target && !landed;
  const glow = landed ? eraOf(landed.season).tint : color.accent;
  const lead = width > 0 ? width / 2 - WHEEL.CARD / 2 : 0;

  return (
    <View style={styles.housing} onLayout={onLayout}>
      <View style={styles.topEdge} pointerEvents="none" />

      <Animated.View
        style={[
          styles.window,
          {
            transform: [
              { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) },
            ],
          },
        ]}
      >
        {/* the light behind the selection, under everything else */}
        <Animated.View style={[styles.bloomWrap, { opacity: bloom }]} pointerEvents="none">
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
          <Animated.View
            style={[
              styles.strip,
              { paddingLeft: lead, transform: [{ translateX: x }] },
            ]}
          >
            {strip.map((item, i) => (
              <ReelCard key={i} item={item} index={i} x={x} speed={speed} dim={idle} />
            ))}
          </Animated.View>
        ) : null}

        {/* the selection window: a lit frame, not a highlighted card */}
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

        <Animated.View
          pointerEvents="none"
          style={[
            styles.flash,
            {
              opacity: flash.interpolate({
                inputRange: [0, 0.25, 1],
                outputRange: [0, 0.85, 0],
              }),
              transform: [
                {
                  translateX: flash.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-140, width + 140],
                  }),
                },
              ],
            },
          ]}
        />

        <View style={styles.inset} pointerEvents="none" />
      </Animated.View>
    </View>
  );
}

/**
 * One card on the drum.
 *
 * Everything it does is an interpolation of the shared scroll value, so a
 * card never re-renders while the reel turns.
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
  x: Animated.Value;
  speed: Animated.Value;
  dim: boolean;
}) {
  const style = useMemo(() => {
    const i = index;
    const at = (k: number) => -(i + k) * WHEEL.CARD;
    // ascending: two cards left of centre, one left, centred, one right, two right
    const inputRange = [at(2), at(1), at(0), at(-1), at(-2)];
    const opts = { inputRange, extrapolate: 'clamp' as const };

    const cardScale = x.interpolate({ ...opts, outputRange: [0.8, 0.9, 1, 0.9, 0.8] });
    const smear = speed.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });

    return {
      opacity: Animated.multiply(
        x.interpolate({ ...opts, outputRange: [0.22, 0.6, 1, 0.6, 0.22] }),
        speed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }),
      ),
      transform: [
        { perspective: 760 },
        // cards bunch toward the centre, the way a drum foreshortens
        { translateX: x.interpolate({ ...opts, outputRange: [18, 6, 0, -6, -18] }) },
        { rotateY: x.interpolate({ ...opts, outputRange: ['-40deg', '-21deg', '0deg', '21deg', '40deg'] }) },
        { scaleX: Animated.multiply(cardScale, smear) },
        { scaleY: cardScale },
      ],
    };
  }, [index, x, speed]);

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
