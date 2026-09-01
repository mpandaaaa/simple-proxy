import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Text, View, StyleSheet } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { color, radius, space, line } from '../tokens';
import { font } from '../type';
import { haptic, useReduceMotion } from '../feel';
import { eraOf } from '../../engine';
import {
  WHEEL,
  buildReel,
  spinDuration,
  tickSchedule,
  travelDistance,
  type ReelItem,
} from '../../game/wheel';
import { ClubDisc } from './ClubDisc';

const WINDOW = WHEEL.VISIBLE * WHEEL.ITEM;
/** strips above the centre slot, so index 0 starts centred */
const LEAD = (WHEEL.VISIBLE - 1) / 2;
/** how long the landed club is held in the window before handing on */
const HOLD_MS = 700;

/**
 * The spin.
 *
 * A drum, not a list. Strips scale, fade and rotate away on the X axis with
 * distance from the centre line, so the reel reads as a curved surface
 * turning rather than rows sliding. Every one of those is an interpolation
 * of the single value driving the scroll, which means the whole thing lives
 * in the native animation graph and React does not run a frame while it
 * moves.
 *
 * The blur is a stretch. Real Gaussian blur exists in this React Native,
 * but it wraps the view in a SwiftUI host, and changing it mid spin means
 * tearing that down and rebuilding it at exactly the moment there is no
 * time to spare. Scaling a strip vertically as it speeds up is what games
 * do instead, it costs nothing, and it runs on the same native driver as
 * the rest.
 *
 * The ticks come from a schedule solved up front in src/game/wheel.ts, not
 * from watching the animation.
 */
export function SpinWheel({
  target,
  pool,
  onSettled,
  hint,
}: {
  /** set this to a club-season and the reel runs to it */
  target: ReelItem | null;
  pool: readonly ReelItem[];
  onSettled: () => void;
  /** shown under the window until there is an era to show instead */
  hint?: string;
}) {
  const reduce = useReduceMotion();

  const y = useRef(new Animated.Value(0)).current;
  /** 1 while the reel is at full pace, 0 once it is still */
  const speed = useRef(new Animated.Value(0)).current;
  /** the accent bloom under the window, low while spinning */
  const bloom = useRef(new Animated.Value(0.22)).current;
  /** the sweep of light across the window on landing */
  const flash = useRef(new Animated.Value(0)).current;
  /** the window itself flexing as the reel locks home */
  const pop = useRef(new Animated.Value(0)).current;

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [strip, setStrip] = useState<ReelItem[]>(() =>
    pool.length ? buildReel(pool[0], pool) : [],
  );
  const [landed, setLanded] = useState<ReelItem | null>(null);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (!target || !pool.length) return;

    setLanded(null);
    setStrip(buildReel(target, pool));
    y.setValue(0);
    flash.setValue(0);
    pop.setValue(0);

    if (reduce) {
      y.setValue(-WHEEL.TRAVEL * WHEEL.ITEM);
      speed.setValue(0);
      bloom.setValue(1);
      haptic('medium');
      setLanded(target);
      timers.current.push(setTimeout(onSettled, HOLD_MS));
      return;
    }

    speed.setValue(1);
    bloom.setValue(0.22);

    for (const tick of tickSchedule()) {
      timers.current.push(
        setTimeout(() => haptic(tick.strong ? 'medium' : 'light'), tick.at),
      );
    }

    Animated.parallel([
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
      ]),
      // Velocity of an out-quad falls off linearly, so the smear does too.
      Animated.timing(speed, {
        toValue: 0,
        duration: WHEEL.SPIN_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      // The window brightens as the reel gives up its speed.
      Animated.timing(bloom, {
        toValue: 1,
        duration: WHEEL.SPIN_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;

      haptic('light');
      setLanded(target);

      Animated.parallel([
        Animated.sequence([
          Animated.timing(flash, {
            toValue: 1,
            duration: 340,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(flash, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.spring(pop, {
            toValue: 1,
            useNativeDriver: true,
            speed: 20,
            bounciness: 14,
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
  const era = landed ? eraOf(landed.season) : null;
  const glow = era?.tint ?? color.accent;

  const windowScale = pop.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.035],
  });

  return (
    <View style={styles.housing}>
      <View style={styles.topEdge} pointerEvents="none" />

      <Label landed={landed} />

      <Animated.View
        style={[styles.window, { transform: [{ scale: windowScale }] }]}
      >
        {/* the light behind the selection, under everything else */}
        <Animated.View style={[styles.bloomWrap, { opacity: bloom }]} pointerEvents="none">
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <Defs>
              <RadialGradient id="bloom" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={glow} stopOpacity={0.55} />
                <Stop offset="0.55" stopColor={glow} stopOpacity={0.16} />
                <Stop offset="1" stopColor={glow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx="50" cy="50" rx="62" ry="26" fill="url(#bloom)" />
          </Svg>
        </Animated.View>

        <Animated.View style={[styles.strip, { transform: [{ translateY: y }] }]}>
          {strip.map((item, i) => (
            <ReelRow key={i} item={item} index={i} y={y} speed={speed} dim={idle} />
          ))}
        </Animated.View>

        {/* the selection window: a lit frame, not a highlighted row */}
        <View style={[styles.selection, { borderColor: glow }]} pointerEvents="none">
          <View
            style={[
              styles.selectionFill,
              {
                experimental_backgroundImage: `linear-gradient(180deg, ${hexA(glow, 0.18)} 0%, ${hexA(glow, 0.03)} 50%, ${hexA(glow, 0.18)} 100%)`,
                boxShadow: `inset 0px 0px 20px ${hexA(glow, 0.4)}`,
              },
            ]}
          />
          <View style={[styles.notch, styles.notchLeft, { backgroundColor: glow }]} />
          <View style={[styles.notch, styles.notchRight, { backgroundColor: glow }]} />
        </View>

        <View style={styles.fadeTop} pointerEvents="none" />
        <View style={styles.fadeBottom} pointerEvents="none" />

        {/* the sweep of light when it lands */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flash,
            {
              opacity: flash.interpolate({
                inputRange: [0, 0.25, 1],
                outputRange: [0, 0.9, 0],
              }),
              transform: [
                {
                  translateX: flash.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-320, 320],
                  }),
                },
              ],
            },
          ]}
        />

        {/* recessed edge, so the window sits in the housing rather than on it */}
        <View style={styles.inset} pointerEvents="none" />
      </Animated.View>

      {landed ? (
        <View style={styles.eraRow}>
          <View style={[styles.eraPill, { borderColor: hexA(glow, 0.45), backgroundColor: hexA(glow, 0.12) }]}>
            <Text style={[styles.eraText, { color: glow }]}>{era?.label}</Text>
          </View>
        </View>
      ) : (
        // Reserved rather than left empty: the pill appearing must not
        // resize the housing, and the space may as well say something.
        <View style={styles.eraRow}>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
      )}
    </View>
  );
}

/**
 * One strip on the drum.
 *
 * Everything it does is an interpolation of the shared scroll value, so a
 * row never re-renders while the reel turns. Memoised because the strip is
 * rebuilt on every spin and there is no reason to rebuild thirty six rows'
 * worth of animation nodes when only the dimming has changed.
 */
const ReelRow = memo(function ReelRow({
  item,
  index,
  y,
  speed,
  dim,
}: {
  item: ReelItem;
  index: number;
  y: Animated.Value;
  speed: Animated.Value;
  dim: boolean;
}) {
  const style = useMemo(() => {
    const i = index;
    const at = (k: number) => -(i + k) * WHEEL.ITEM;
    // ascending: two below centre, one below, centred, one above, two above
    const inputRange = [at(2), at(1), at(0), at(-1), at(-2)];
    const opts = { inputRange, extrapolate: 'clamp' as const };

    const rowScale = y.interpolate({ ...opts, outputRange: [0.74, 0.88, 1, 0.88, 0.74] });
    const smear = speed.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });

    return {
      opacity: Animated.multiply(
        y.interpolate({ ...opts, outputRange: [0.12, 0.46, 1, 0.46, 0.12] }),
        speed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] }),
      ),
      transform: [
        { perspective: 700 },
        // rows bunch toward the centre line, the way a drum foreshortens
        { translateY: y.interpolate({ ...opts, outputRange: [13, 4, 0, -4, -13] }) },
        { rotateX: y.interpolate({ ...opts, outputRange: ['30deg', '15deg', '0deg', '-15deg', '-30deg'] }) },
        { scaleX: rowScale },
        { scaleY: Animated.multiply(rowScale, smear) },
      ],
    };
  }, [index, y, speed]);

  return (
    <Animated.View style={[styles.row, style, dim && styles.rowDim]}>
      <ClubDisc club={item.club} size={38} />
      <View style={styles.rowBody}>
        <Text style={styles.club} numberOfLines={1}>
          {item.club}
        </Text>
        <Text style={styles.season}>{item.season}</Text>
      </View>
    </Animated.View>
  );
});

/** Wide tracked while it hunts, the club's own name once it has one. */
function Label({ landed }: { landed: ReelItem | null }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [landed, t]);

  return (
    <Animated.View
      style={[
        styles.labelWrap,
        {
          opacity: t,
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
          ],
        },
      ]}
    >
      <Text
        style={landed ? styles.labelClub : styles.labelHunting}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {landed ? landed.club : 'Finding a club'}
      </Text>
    </Animated.View>
  );
}

/** #RRGGBB plus an alpha, for the tints that follow the era colour. */
function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
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
      '0px 22px 44px rgba(0,0,0,0.55), inset 0px 1px 0px rgba(255,255,255,0.07)',
    paddingVertical: space.s4,
    overflow: 'hidden',
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: '14%',
    right: '14%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },

  labelWrap: { alignItems: 'center', height: 30, justifyContent: 'center' },
  labelHunting: {
    fontFamily: font.displaySemi,
    fontSize: 12,
    letterSpacing: 4.2,
    textTransform: 'uppercase',
    color: color.text3,
  },
  labelClub: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 27,
    letterSpacing: 0.4,
    color: color.text1,
  },

  window: {
    height: WINDOW,
    marginTop: space.s3,
    marginHorizontal: space.s3,
    borderRadius: radius.lg,
    backgroundColor: '#060A07',
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
    boxShadow: 'inset 0px 0px 34px rgba(0,0,0,0.9)',
  },

  bloomWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: LEAD * WHEEL.ITEM - WHEEL.ITEM,
    height: WHEEL.ITEM * 3,
  },

  strip: { paddingTop: LEAD * WHEEL.ITEM },
  row: {
    height: WHEEL.ITEM,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingHorizontal: space.s4,
  },
  rowDim: { opacity: 0.4 },
  rowBody: { flex: 1, minWidth: 0 },
  club: {
    fontFamily: font.displayBold,
    fontSize: 21,
    lineHeight: 24,
    letterSpacing: 0.3,
    color: color.text1,
  },
  season: {
    fontFamily: font.displaySemi,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },

  selection: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: LEAD * WHEEL.ITEM,
    height: WHEEL.ITEM,
    borderRadius: radius.sm,
    borderWidth: 1.5,
  },
  selectionFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.sm,
  },
  notch: { position: 'absolute', top: '50%', marginTop: -9, width: 3, height: 18 },
  notchLeft: { left: -6, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  notchRight: { right: -6, borderTopLeftRadius: 2, borderBottomLeftRadius: 2 },

  fadeTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: WHEEL.ITEM * 1.7,
    experimental_backgroundImage:
      'linear-gradient(180deg, rgba(6,10,7,1) 8%, rgba(6,10,7,0) 100%)',
  },
  fadeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: WHEEL.ITEM * 1.7,
    experimental_backgroundImage:
      'linear-gradient(0deg, rgba(6,10,7,1) 8%, rgba(6,10,7,0) 100%)',
  },

  flash: {
    position: 'absolute',
    top: LEAD * WHEEL.ITEM - 6,
    height: WHEEL.ITEM + 12,
    left: -160,
    width: 150,
    experimental_backgroundImage:
      'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.75) 50%, rgba(255,255,255,0) 100%)',
  },

  eraRow: { height: 30, alignItems: 'center', justifyContent: 'center', marginTop: space.s3 },
  hint: {
    fontFamily: font.displaySemi,
    fontSize: 10.5,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  eraPill: {
    paddingHorizontal: space.s3,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  eraText: {
    fontFamily: font.displaySemi,
    fontSize: 10.5,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
