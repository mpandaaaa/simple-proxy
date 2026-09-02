import { useEffect, useRef, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { color, radius, space, line, gradient } from '../tokens';
import { font, text } from '../type';
import { useReduceMotion } from '../feel';
import { clubColour, eraOf } from '../../engine';
import { ClubDisc } from './ClubDisc';

/**
 * The card the reel lands into.
 *
 * This is what the web build actually shows: a pick counter, the club, the
 * season, and how strong that squad is. Same anatomy, with the club's own
 * colour washing the panel and the strength bar filling while the number
 * counts up.
 *
 * Its height never changes. An empty state that is shorter than a full one
 * makes the whole page jump every time the reel lands, so the empty state
 * is a skeleton of exactly the right size rather than a gap.
 */
export function EraCard({
  pick,
  total,
  club,
  season,
  strength,
  cycling,
}: {
  pick: number;
  total: number;
  /** null while the reel is still running */
  club: string | null;
  season: string | null;
  /** the squad's average rating, or 0 while spinning */
  strength: number;
  /** the club currently under the pointer, while the reel runs */
  cycling?: string | null;
}) {
  const reduce = useReduceMotion();
  const fill = useSharedValue(0);
  const rise = useSharedValue(0);

  const live = !!club;
  const tint = live ? clubColour(club) : color.accent;
  const era = season ? eraOf(season) : null;
  // Ratings live between about 60 and 97, so that is what the bar spans.
  const fraction = strength ? Math.max(0.05, Math.min(1, (strength - 58) / 38)) : 0;

  useEffect(() => {
    if (!live) {
      fill.value = 0;
      rise.value = 0;
      return;
    }
    fill.value = withTiming(fraction, {
      duration: reduce ? 0 : 600,
      easing: Easing.out(Easing.cubic),
    });
    rise.value = withSpring(1, { stiffness: 210, damping: 15, mass: 1 });
  }, [live, fraction, fill, rise, reduce]);

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [{ translateY: (1 - rise.value) * 8 }],
  }));
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: fill.value }],
  }));

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

      <View style={styles.head}>
        <View style={styles.pickWrap}>
          <View style={[styles.dot, { backgroundColor: live ? tint : color.accent }]} />
          <Text style={styles.pickText}>
            Pick {pick} of {total}
          </Text>
        </View>
        <Text style={styles.yourSquad}>Your squad</Text>
      </View>

      <View style={styles.body}>
        {live ? (
          <Animated.View style={bodyStyle}>
            <ClubDisc club={club} size={54} square />
          </Animated.View>
        ) : cycling ? (
          <ClubDisc club={cycling} size={54} square />
        ) : (
          <View style={styles.discSkeleton} />
        )}

        <View style={styles.names}>
          {live ? (
            <Animated.View style={bodyStyle}>
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
                {era ? `  ·  ${era.label}` : ''}
              </Text>
            </Animated.View>
          ) : cycling ? (
            // The site swaps the club name here as it spins. Same idea, but
            // the name comes from the card actually under the pointer.
            <>
              <Text style={[styles.club, styles.clubSpinning]} numberOfLines={1}>
                {cycling}
              </Text>
              <Text style={styles.season}>. . .</Text>
            </>
          ) : (
            <>
              <View style={[styles.skeleton, styles.skeletonTitle]} />
              <View style={[styles.skeleton, styles.skeletonSub]} />
            </>
          )}
        </View>

        {live ? (
          <Animated.View style={[styles.strengthWrap, bodyStyle]}>
            <CountUp to={strength} />
            <Text style={styles.strengthLabel}>Squad</Text>
          </Animated.View>
        ) : null}
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
 * A number that arrives rather than appears.
 *
 * Driven from JavaScript because there is no way to animate the glyphs in
 * a Text node from the native side. It runs for half a second, once per
 * spin, while nothing else is moving, and stops the moment it unmounts.
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
    const DUR = 560;
    const step = () => {
      const p = Math.min(1, (Date.now() - start) / DUR);
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

  // Fixed height so the landing never resizes the page under your thumb.
  body: { flexDirection: 'row', alignItems: 'center', gap: space.s4, height: 56 },
  names: { flex: 1, minWidth: 0, gap: 6 },
  club: {
    fontFamily: font.displayBlack,
    fontSize: 31,
    lineHeight: 34,
    letterSpacing: 0.2,
    color: color.text1,
  },
  season: {
    fontFamily: font.bodyMed,
    fontSize: 12.5,
    color: color.text2,
    marginTop: 1,
  },
  clubSpinning: { color: color.text2 },

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
  skeletonSub: { height: 11, width: '38%' },

  strengthWrap: { alignItems: 'flex-end' },
  strengthValue: {
    fontFamily: font.hero,
    fontSize: 30,
    lineHeight: 32,
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
