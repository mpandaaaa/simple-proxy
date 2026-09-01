import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View, StyleSheet } from 'react-native';
import { color, radius, space, line, gradient, shadow } from '../tokens';
import { font, text } from '../type';
import { useReduceMotion } from '../feel';
import { eraOf } from '../../engine';
import { ClubDisc } from './ClubDisc';

/**
 * The card the reel lands into.
 *
 * This is what the web build actually shows a player: a pick counter, the
 * club, the season, and how strong that squad is. The reel above it is the
 * app's addition; this is the part that has to say what was won.
 *
 * Empty until the reel settles. The bar filling and the number counting
 * are the payoff for the spin, so neither is allowed to simply appear.
 */
export function EraCard({
  pick,
  total,
  club,
  season,
  strength,
}: {
  pick: number;
  total: number;
  /** null while the reel is still running */
  club: string | null;
  season: string | null;
  /** the squad's average rating, or 0 while spinning */
  strength: number;
}) {
  const reduce = useReduceMotion();
  const fill = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;

  const live = !!club;
  const era = season ? eraOf(season) : null;
  const tint = era?.tint ?? color.accent;
  // Ratings live between about 60 and 97, so that is the range the bar
  // spans. Anchoring it at zero would leave every squad looking identical.
  const fraction = strength ? Math.max(0.04, Math.min(1, (strength - 58) / 38)) : 0;

  useEffect(() => {
    if (!live) {
      fill.setValue(0);
      rise.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(fill, {
        toValue: fraction,
        duration: reduce ? 0 : 620,
        delay: reduce ? 0 : 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(rise, {
        toValue: 1,
        useNativeDriver: true,
        speed: 14,
        bounciness: 6,
      }),
    ]).start();
  }, [live, fraction, fill, rise, reduce]);

  return (
    <View style={[styles.card, live && { borderColor: hexA(tint, 0.42) }]}>
      {live ? (
        <View
          style={[
            styles.tint,
            {
              experimental_backgroundImage: `linear-gradient(135deg, ${hexA(tint, 0.16)} 0%, rgba(0,0,0,0) 62%)`,
            },
          ]}
          pointerEvents="none"
        />
      ) : null}

      <View style={styles.head}>
        <View style={[styles.pickBadge, live && { borderColor: hexA(tint, 0.45), backgroundColor: hexA(tint, 0.12) }]}>
          <Text style={[styles.pickText, live && { color: tint }]}>
            Pick {pick} of {total}
          </Text>
        </View>
        <Text style={styles.yourSquad}>Your squad</Text>
      </View>

      <Animated.View
        style={[
          styles.body,
          {
            opacity: live ? rise : 0.45,
            transform: [
              {
                translateY: live
                  ? rise.interpolate({ inputRange: [0, 1], outputRange: [8, 0] })
                  : 0,
              },
            ],
          },
        ]}
      >
        {live ? (
          <ClubDisc club={club} size={56} />
        ) : (
          <View style={styles.discEmpty} />
        )}

        <View style={styles.names}>
          <Text
            style={styles.club}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {club ?? '—'}
          </Text>
          <Text style={styles.season}>{season ?? '. . .'}</Text>
        </View>
      </Animated.View>

      <View style={styles.strengthRow}>
        <Text style={styles.strengthLabel}>Squad strength</Text>
        <CountUp to={live ? strength : 0} />
      </View>

      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: tint,
              boxShadow: live ? `0px 0px 12px ${hexA(tint, 0.7)}` : undefined,
              transform: [{ scaleX: fill }],
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
 * a Text node from the native side. It runs for six hundred milliseconds
 * at most, once per spin, while nothing else is moving, and it stops the
 * moment it is unmounted.
 */
function CountUp({ to }: { to: number }) {
  const reduce = useReduceMotion();
  const [n, setN] = useState(to);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (reduce || to === 0) {
      setN(to);
      return;
    }

    const from = 0;
    const start = Date.now();
    const DUR = 600;

    const step = () => {
      const p = Math.min(1, (Date.now() - start) / DUR);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(from + (to - from) * eased));
      if (p < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [to, reduce]);

  return (
    <Text style={styles.strengthValue} allowFontScaling={false}>
      {n === 0 ? '—' : n}
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
    experimental_backgroundImage: gradient.cardLift,
    boxShadow: shadow.lift,
    padding: space.s4,
    gap: space.s3,
    overflow: 'hidden',
  },
  tint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickBadge: {
    paddingHorizontal: space.s3,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pickText: {
    ...text.key,
    fontSize: 10,
    color: color.text2,
    fontVariant: ['tabular-nums'],
  },
  yourSquad: { ...text.key, fontSize: 10, color: color.text3 },

  body: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
  discEmpty: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  names: { flex: 1, minWidth: 0 },
  club: {
    fontFamily: font.displayBlack,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: 0.3,
    color: color.text1,
  },
  season: {
    fontFamily: font.displaySemi,
    fontSize: 12,
    letterSpacing: 2,
    color: color.text3,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },

  strengthRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  strengthLabel: { ...text.key, fontSize: 10, color: color.text3 },
  strengthValue: {
    fontFamily: font.hero,
    fontSize: 26,
    lineHeight: 28,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: line.card,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    width: '100%',
    borderRadius: 3,
    alignSelf: 'flex-start',
    transformOrigin: 'left',
  },
});
