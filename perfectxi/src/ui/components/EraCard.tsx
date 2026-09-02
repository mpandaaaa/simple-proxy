import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
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
import { color, radius, space, line, gradient } from '../tokens';
import { font, text } from '../type';
import { haptic, useReduceMotion } from '../feel';
import { clubColour, eraOf } from '../../engine';
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
 * The era card, which on this game is also the spinner.
 *
 * The site has no separate reel. Pressing Start Spinning reveals this card
 * and swaps the club name inside it thirteen times on a three phase
 * schedule. That is the whole spin, and it is what this reproduces: same
 * card, same place on the page, same step count, same timing.
 *
 * The one thing the web could not do is make it move. Instead of the text
 * being replaced, the club row physically travels through the card, and
 * arrives still carrying the speed of its last step so the settle spring
 * takes that velocity, carries it past the winner and brings it back. The
 * overshoot is the reel's own momentum rather than a chosen distance.
 *
 * The card's height never changes, so nothing on the page moves under your
 * thumb when it lands.
 */
export function EraCard({
  pick,
  total,
  club,
  season,
  strength,
  target,
  pool,
  allTime,
  onSettled,
}: {
  pick: number;
  total: number;
  /** the landed club, once the run has a board */
  club: string | null;
  season: string | null;
  /** the squad's average rating, or 0 before it has landed */
  strength: number;
  /** set this to a club-season and the card spins to it */
  target: ReelItem | null;
  pool: readonly ReelItem[];
  allTime?: boolean;
  onSettled: () => void;
}) {
  const reduce = useReduceMotion();

  const y = useSharedValue(offsetFor(0));
  /** 1 at full pace, 0 once still: drives the smear and the dimming */
  const speed = useSharedValue(0);
  const fill = useSharedValue(0);
  const rise = useSharedValue(0);
  const glow = useSharedValue(0);

  const detent = useSharedValue(0);
  const ticking = useSharedValue(false);

  const [strip, setStrip] = useState<ReelItem[]>([]);
  const [spinning, setSpinning] = useState(false);

  const live = !!club && !spinning;
  const tint = live ? clubColour(club) : color.accent;
  const era = live && season ? eraOf(season) : null;
  // Ratings live between about 60 and 97, so that is what the bar spans.
  const fraction = strength ? Math.max(0.05, Math.min(1, (strength - 58) / 38)) : 0;

  /** A club clicking past. The site fires a 6ms buzz; selection is Apple's. */
  const tick = useCallback(() => haptic('select'), []);

  const settle = useCallback(() => {
    haptic('heavy'); // the site's 40ms landing buzz
    setSpinning(false);
    glow.value = withSequence(
      withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 460, easing: Easing.out(Easing.quad) }),
    );
    onSettled();
  }, [glow, onSettled]);

  // Ticks come from real position, so they slow because the reel slows.
  useAnimatedReaction(
    () => y.value,
    (cur) => {
      'worklet';
      if (!ticking.value) return;
      const progress = -cur / WHEEL.ROW - WHEEL.PAD;
      const d = Math.floor(progress + 0.0001);
      if (d <= detent.value) return;
      detent.value = d;
      if (d >= 1) runOnJS(tick)();
    },
  );

  useEffect(() => {
    if (!target || !pool.length) return;

    const delays = stepDelays(allTime);
    const last = stepCount(allTime);

    setStrip(buildReel(target, pool, allTime));
    setSpinning(true);
    y.value = offsetFor(0);
    detent.value = 0;
    fill.value = 0;
    rise.value = 0;

    if (reduce) {
      y.value = offsetFor(last);
      speed.value = 0;
      haptic('heavy');
      setSpinning(false);
      onSettled();
      return;
    }

    ticking.value = true;

    // One timed step per club, on the site's own three phase schedule,
    // then the settle spring carrying the reel's arrival speed.
    const steps = delays.map((ms, i) =>
      withTiming(offsetFor(i + 1), { duration: ms, easing: Easing.linear }),
    );

    y.value = withSequence(
      ...steps,
      withSpring(
        offsetFor(last),
        { ...WHEEL.SETTLE, velocity: arrivalVelocity(allTime) },
        (finished) => {
          'worklet';
          ticking.value = false;
          if (finished) runOnJS(settle)();
        },
      ),
    );

    const runMs = delays.reduce((n, ms) => n + ms, 0);
    speed.value = withSequence(
      withTiming(1, { duration: 0 }),
      withTiming(0, { duration: runMs, easing: Easing.linear }),
    );
    // A new target is a new spin. Nothing else may restart one in flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  useEffect(() => {
    if (!live) return;
    fill.value = withTiming(fraction, {
      duration: reduce ? 0 : 600,
      easing: Easing.out(Easing.cubic),
    });
    rise.value = withSpring(1, { stiffness: 210, damping: 15, mass: 1 });
  }, [live, fraction, fill, rise, reduce]);

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [{ translateY: (1 - rise.value) * 6 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <View style={[styles.card, live && { borderColor: hexA(tint, 0.5) }]}>
      {live ? (
        <View
          style={[
            styles.wash,
            {
              experimental_backgroundImage: `linear-gradient(130deg, ${hexA(tint, 0.22)} 0%, ${hexA(tint, 0.05)} 55%, rgba(0,0,0,0) 100%)`,
            },
          ]}
          pointerEvents="none"
        />
      ) : null}

      {/* the card lighting up as the reel locks home */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.wash,
          glowStyle,
          {
            experimental_backgroundImage: `linear-gradient(130deg, ${hexA(tint, 0.34)} 0%, rgba(0,0,0,0) 70%)`,
          },
        ]}
      />

      <View style={styles.head}>
        <View style={styles.pickWrap}>
          <View style={[styles.dot, { backgroundColor: tint }]} />
          <Text style={styles.pickText}>
            Pick {pick} of {total}
          </Text>
        </View>
        <Text style={styles.yourSquad}>Your squad</Text>
      </View>

      {/* One row tall, and the reel runs through it. */}
      <View style={styles.window}>
        {spinning ? (
          <Animated.View style={[styles.strip, stripStyle]}>
            {strip.map((item, i) => (
              <ReelRow key={i} item={item} index={i} y={y} speed={speed} />
            ))}
          </Animated.View>
        ) : (
          <Animated.View style={[styles.row, live ? bodyStyle : undefined]}>
            {live ? (
              <ClubDisc club={club} size={54} square />
            ) : (
              <View style={styles.discSkeleton} />
            )}
            <View style={styles.names}>
              {live ? (
                <>
                  <Text
                    style={styles.club}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                    allowFontScaling={false}
                  >
                    {club}
                  </Text>
                  <Text style={styles.season}>
                    {season}
                    {/* All Time XI already reads "All Eras"; do not then
                        append "All eras" after it. */}
                    {era && season !== 'All Eras' ? `  ·  ${era.label}` : ''}
                  </Text>
                </>
              ) : (
                <>
                  <View style={[styles.skeleton, styles.skeletonTitle]} />
                  <View style={[styles.skeleton, styles.skeletonSub]} />
                </>
              )}
            </View>
            {live ? (
              <View style={styles.strengthWrap}>
                <CountUp to={strength} />
                <Text style={styles.strengthLabel}>Squad</Text>
              </View>
            ) : null}
          </Animated.View>
        )}
      </View>

      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            barStyle,
            {
              backgroundColor: tint,
              boxShadow: live ? `0px 0px 10px ${hexA(tint, 0.8)}` : undefined,
            },
          ]}
        />
      </View>
    </View>
  );
}

/**
 * One club on the reel. Its appearance is a worklet reading the shared
 * scroll value, so it never re-renders while the card is spinning.
 */
const ReelRow = memo(function ReelRow({
  item,
  index,
  y,
  speed,
}: {
  item: ReelItem;
  index: number;
  y: SharedValue<number>;
  speed: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    // where this row sits relative to the window, in rows
    const d = (index * WHEEL.ROW + y.value) / WHEEL.ROW;
    const ad = Math.abs(d);
    const c = Extrapolation.CLAMP;
    const smear = interpolate(speed.value, [0, 1], [1, 1.35]);

    return {
      // Gone by 0.62 of a row, while the window still has 0.775 either
      // side, so nothing is ever cut off mid glyph.
      opacity: interpolate(ad, [0, 0.28, 0.62], [1, 0.34, 0], c),
      transform: [
        { perspective: 620 },
        { rotateX: `${interpolate(d, [-1, 0, 1], [30, 0, -30], c)}deg` },
        { scale: interpolate(ad, [0, 0.7], [1, 0.9], c) },
        { scaleY: smear },
      ],
    };
  });

  return (
    <Animated.View style={[styles.row, style]}>
      <ClubDisc club={item.club} size={54} square />
      <View style={styles.names}>
        <Text style={[styles.club, styles.clubSpinning]} numberOfLines={1}>
          {item.club}
        </Text>
        <Text style={styles.season}>{item.season}</Text>
      </View>
    </Animated.View>
  );
});

/**
 * A number that arrives rather than appears. Driven from JavaScript
 * because glyphs in a Text node cannot be animated from the native side.
 */
function CountUp({ to }: { to: number }) {
  const reduce = useReduceMotion();
  const [n, setN] = useState(reduce ? to : 0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (reduce || !to) {
      setN(to);
      return;
    }
    const start = Date.now();
    const step = () => {
      const p = Math.min(1, (Date.now() - start) / 560);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [to, reduce]);

  return (
    <Text style={styles.strengthValue} allowFontScaling={false}>
      {n || '—'}
    </Text>
  );
}

function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow:
      '0px 10px 24px rgba(0,0,0,0.45), inset 0px 1px 0px rgba(255,255,255,0.06)',
    padding: space.s4,
    gap: space.s3,
    overflow: 'hidden',
  },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickWrap: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pickText: {
    fontFamily: font.bodySemi,
    fontSize: 13.5,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  yourSquad: { ...text.key, fontSize: 10, color: color.text3 },

  /**
   * Taller than a row on purpose.
   *
   * At exactly one row the club sliding in was cut in half by the edge of
   * the card, which reads as an invisible barrier rather than as a reel.
   * The window is a row and a half, and a row fades to nothing well before
   * it reaches either edge, so clubs arrive and leave rather than being
   * chopped.
   */
  window: {
    height: WHEEL.ROW * 1.55,
    marginVertical: -WHEEL.ROW * 0.275,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  strip: { position: 'absolute', left: 0, right: 0, top: WHEEL.ROW * 0.275 },
  row: {
    height: WHEEL.ROW,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s4,
  },

  names: { flex: 1, minWidth: 0 },
  club: {
    fontFamily: font.displayBlack,
    fontSize: 31,
    lineHeight: 37,
    letterSpacing: 0.2,
    color: color.text1,
  },
  clubSpinning: { color: color.text2 },
  season: {
    fontFamily: font.bodyMed,
    fontSize: 12.5,
    color: color.text3,
    marginTop: 1,
  },

  discSkeleton: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: line.card,
  },
  skeleton: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 5 },
  skeletonTitle: { height: 24, width: '62%' },
  skeletonSub: { height: 11, width: '38%', marginTop: 6 },

  strengthWrap: { alignItems: 'flex-end' },
  strengthValue: {
    fontFamily: font.hero,
    fontSize: 30,
    lineHeight: 39,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  strengthLabel: { ...text.key, fontSize: 8.5, color: color.text3, marginTop: 1 },

  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  fill: {
    height: 5,
    width: '100%',
    borderRadius: 3,
    alignSelf: 'flex-start',
    transformOrigin: 'left',
  },
});
