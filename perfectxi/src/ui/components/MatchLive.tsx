import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, line, radius, space } from '../tokens';
import { font, text } from '../type';
import { GRAIN_URI } from '../grain';
import { haptic, useReduceMotion } from '../feel';
import { ClubDisc } from './ClubDisc';
import { Press } from './Press';
import { buildMatch, type MatchEvent, type LiveMatch } from '../../game/commentary';
import type { MatchResult } from '../../engine';

/** Ninety minutes in eight seconds. The site plays a minute every 90ms. */
const MINUTE_MS = 90;
/** The break, so half time is a moment rather than a line in a list. */
const HALF_TIME_MS = 750;

/* Match night. The one place in the app that is not green, exactly as it is
   on the site: a floodlit purple with the league's magenta on the edges. */
const NIGHT = {
  top: 'linear-gradient(160deg, #2E0B43 0%, #37003C 52%, #180620 100%)',
  edge: 'rgba(233,0,82,0.34)',
  hot: '#FF2D78',
  me: '#00FF85',
  opp: '#FF5C7A',
};

const ICON: Record<string, string> = {
  ko: '●',
  goal: '⚽',
  ht: '⏸',
  ft: '⏹',
  save: '🧤',
  chance: '❗',
  corner: '🚩',
  foul: '✋',
  offside: '🚩',
  woodwork: '💥',
  yellow: '🟨',
  run: '⚡',
};

/**
 * Watching a match.
 *
 * The result is already in the book. This is the ninety minutes it came
 * from: a clock that runs, a scoreline that moves when someone scores, the
 * pressure swinging between the two sides, and the incident arriving in the
 * order it happened.
 *
 * The site has this and I had left it out, which is why a season here was a
 * list of scores rolling past. What is added on top of the site's version
 * is the minute bar, the momentum, and the full time stats, all of them
 * read off the expected goals the engine already drew for this fixture
 * rather than invented next to it.
 */
export function MatchLive({
  match,
  seed,
  live,
  visible,
  onDone,
}: {
  match: MatchResult | null;
  /** the run's seed, so a match watched twice plays out the same */
  seed: number;
  /** true when this is being played for the first time, not rewatched */
  live: boolean;
  visible: boolean;
  onDone: () => void;
}) {
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const [minute, setMinute] = useState(0);
  const [shown, setShown] = useState<MatchEvent[]>([]);
  const [ended, setEnded] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursor = useRef(0);
  const clock = useRef(0);

  const p = useSharedValue(0);
  const clockBar = useSharedValue(0);
  const swing = useSharedValue(0);
  const flash = useSharedValue(0);
  const bump = useSharedValue(0);
  const statsIn = useSharedValue(0);

  const built: LiveMatch | null = useMemo(
    () => (match ? buildMatch(match, seed) : null),
    [match, seed],
  );

  const drop = useCallback(() => setMounted(false), []);

  /* ---- presentation ---- */
  useEffect(() => {
    if (visible) {
      setMounted(true);
      p.value = 0;
      p.value = reduce
        ? withTiming(1, { duration: 120 })
        : withSpring(1, { stiffness: 240, damping: 22, mass: 1 });
      return;
    }
    p.value = withTiming(0, { duration: reduce ? 90 : 190 }, (f) => {
      'worklet';
      if (f) runOnJS(drop)();
    });
  }, [visible, p, reduce, drop]);

  /* ---- the clock ---- */
  const stop = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    stop();
    setEnded(true);
    haptic('medium');
  }, [stop]);

  // Everything that has not been seen yet, dumped in at once. Used by the
  // skip button and by Reduce Motion, which should not sit through eight
  // seconds of animation to reach a score it could be told.
  const rush = useCallback(() => {
    if (!built) return;
    stop();
    setShown(built.events.slice().reverse());
    cursor.current = built.events.length;
    clock.current = 90;
    setMinute(90);
    clockBar.value = withTiming(1, { duration: 200 });
    swing.value = withTiming(built.momentum[90] ?? 0, { duration: 260 });
    finish();
  }, [built, stop, finish, clockBar, swing]);

  useEffect(() => {
    if (!visible || !built) return;

    // A fresh match: rewind everything the last one left behind.
    cursor.current = 0;
    clock.current = 0;
    setMinute(0);
    setShown([]);
    setEnded(false);
    clockBar.value = 0;
    swing.value = built.momentum[0] ?? 0;
    statsIn.value = 0;

    if (reduce) {
      rush();
      return;
    }

    haptic('light');

    const step = () => {
      clock.current += 1;
      const m = clock.current;
      setMinute(m);
      clockBar.value = withTiming(m / 90, { duration: MINUTE_MS, easing: Easing.linear });
      swing.value = withTiming(built.momentum[m] ?? 0, { duration: 260 });

      let paused = false;
      const landed: MatchEvent[] = [];
      while (cursor.current < built.events.length && built.events[cursor.current].min <= m) {
        const e = built.events[cursor.current++];
        if (e.kind === 'ft' && m < 90) {
          cursor.current--;
          break;
        }
        landed.push(e);
        if (e.kind === 'goal') {
          haptic(e.side === 'me' ? 'heavy' : 'warning');
          flash.value = withSequence(
            withTiming(1, { duration: 90 }),
            withTiming(0, { duration: 420 }),
          );
          bump.value = withSequence(
            withSpring(1, { stiffness: 500, damping: 14, mass: 0.7 }),
            withSpring(0, { stiffness: 260, damping: 20, mass: 1 }),
          );
        }
        if (e.kind === 'ht') {
          haptic('select');
          paused = true;
        }
      }
      if (landed.length) {
        setShown((prev) => landed.slice().reverse().concat(prev));
      }

      if (m >= 90) {
        // Anything left with a minute past ninety still belongs to the game.
        const rest = built.events.slice(cursor.current);
        cursor.current = built.events.length;
        if (rest.length) setShown((prev) => rest.slice().reverse().concat(prev));
        finish();
        return;
      }
      timer.current = setTimeout(step, paused ? HALF_TIME_MS : MINUTE_MS);
    };

    timer.current = setTimeout(step, 620);
    return stop;
  }, [
    visible,
    built,
    reduce,
    rush,
    stop,
    finish,
    clockBar,
    swing,
    flash,
    bump,
    statsIn,
  ]);

  useEffect(() => {
    if (!ended) return;
    statsIn.value = withDelay(
      reduce ? 0 : 220,
      withSpring(1, { stiffness: 200, damping: 22, mass: 1 }),
    );
  }, [ended, statsIn, reduce]);

  /* ---- styles ---- */
  const dimStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [
      { scale: 0.94 + p.value * 0.06 },
      { translateY: (1 - p.value) * 26 },
    ],
  }));
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: clockBar.value }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value * 0.20 }));
  const scoreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + bump.value * 0.14 }],
  }));
  const meSwing = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(0, swing.value) }],
  }));
  const oppSwing = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(0, -swing.value) }],
  }));
  const statsStyle = useAnimatedStyle(() => ({
    opacity: statsIn.value,
    transform: [{ translateY: (1 - statsIn.value) * 14 }],
  }));

  if (!mounted || !match || !built) return null;

  const head = shown.length ? shown[0] : null;
  const me = ended ? match.gf : (head?.me ?? 0);
  const them = ended ? match.ga : (head?.opp ?? 0);
  const tone =
    match.oc === 'win' ? NIGHT.me : match.oc === 'loss' ? NIGHT.opp : color.gold;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDone}>
      <Animated.View style={[styles.dim, dimStyle]} pointerEvents="none" />
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + space.s3, paddingBottom: insets.bottom + space.s3 },
        ]}
      >
        <Animated.View style={[styles.card, cardStyle]}>
          {/* ---- the broadcast ---- */}
          <View style={styles.top}>
            <View style={styles.bloom} pointerEvents="none">
              <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                <Defs>
                  <RadialGradient id="mlBloom" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={NIGHT.hot} stopOpacity={0.34} />
                    <Stop offset="1" stopColor={NIGHT.hot} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Ellipse cx="50" cy="0" rx="66" ry="52" fill="url(#mlBloom)" />
              </Svg>
            </View>
            <View style={styles.grain} pointerEvents="none">
              <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.fill} />
            </View>
            <Animated.View
              style={[styles.flash, flashStyle]}
              pointerEvents="none"
            />
            <View style={styles.topEdge} pointerEvents="none" />

            <Text style={styles.comp}>
              Premier League {'·'} Matchday {match.n} {'·'}{' '}
              {match.home ? 'Home' : 'Away'}
            </Text>

            <View style={styles.scoreline}>
              <View style={styles.side}>
                <ClubDisc club={null} code="XI" size={46} />
                <Text style={styles.team} numberOfLines={1}>
                  Your XI
                </Text>
              </View>

              <View style={styles.centre}>
                <Animated.View style={[styles.scoreRow, scoreStyle]}>
                  <Text style={styles.score} allowFontScaling={false}>
                    {me}
                  </Text>
                  <Text style={styles.colon} allowFontScaling={false}>
                    {'–'}
                  </Text>
                  <Text style={styles.score} allowFontScaling={false}>
                    {them}
                  </Text>
                </Animated.View>
                <Text
                  style={[styles.clock, ended && { color: tone }]}
                  allowFontScaling={false}
                >
                  {ended ? 'FULL TIME' : minute === 45 ? 'HALF TIME' : `${minute}'`}
                </Text>
              </View>

              <View style={styles.side}>
                <ClubDisc club={match.opp} size={46} />
                <Text style={styles.team} numberOfLines={1}>
                  {match.opp}
                </Text>
              </View>
            </View>

            {/* the ninety, with the break marked */}
            <View style={styles.clockTrack}>
              <Animated.View style={[styles.clockFill, barStyle]} />
              <View style={styles.halfNotch} />
            </View>

            {/* who is on top, right now */}
            <View style={styles.swingHead}>
              <Text style={styles.swingKey}>Momentum</Text>
            </View>
            <View style={styles.swingTrack}>
              <View style={styles.swingHalf}>
                <Animated.View
                  style={[styles.swingFill, styles.swingLeft, oppSwing]}
                />
              </View>
              <View style={styles.swingSpine} />
              <View style={styles.swingHalf}>
                <Animated.View
                  style={[styles.swingFill, styles.swingRight, meSwing]}
                />
              </View>
            </View>
          </View>

          {/* ---- the feed ---- */}
          <ScrollView
            style={styles.feed}
            contentContainerStyle={styles.feedPad}
            showsVerticalScrollIndicator={false}
          >
            {ended ? (
              <Animated.View style={[styles.stats, statsStyle]}>
                <Text style={styles.statsTitle}>Full time</Text>
                <StatBar
                  label="Possession"
                  a={built.stats.possession}
                  b={100 - built.stats.possession}
                  suffix="%"
                />
                <StatBar label="Shots" a={built.stats.shots[0]} b={built.stats.shots[1]} />
                <StatBar
                  label="On target"
                  a={built.stats.onTarget[0]}
                  b={built.stats.onTarget[1]}
                />
                <StatBar
                  label="Expected goals"
                  a={built.stats.xg[0]}
                  b={built.stats.xg[1]}
                  decimals={2}
                />
                <StatBar
                  label="Corners"
                  a={built.stats.corners[0]}
                  b={built.stats.corners[1]}
                />
                <StatBar label="Fouls" a={built.stats.fouls[0]} b={built.stats.fouls[1]} />
              </Animated.View>
            ) : null}

            {shown.map((e) => (
              <EventRow key={e.id} event={e} reduce={reduce} />
            ))}
          </ScrollView>

          {/* ---- actions ---- */}
          <View style={styles.actions}>
            {ended ? (
              <Press onPress={onDone} feel="medium" style={styles.primary} scaleTo={0.98}>
                <Text style={styles.primaryText}>{live ? 'Continue' : 'Close'}</Text>
              </Press>
            ) : (
              <Press onPress={rush} feel="light" style={styles.secondary} scaleTo={0.98}>
                <Text style={styles.secondaryText}>Skip to full time</Text>
              </Press>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * One line of commentary, arriving.
 *
 * It animates itself on mount rather than through a layout animation: the
 * list is rebuilt at the top every time something happens, and a layout
 * animation would re-run on every row below it.
 */
const EventRow = memo(function EventRow({
  event,
  reduce,
}: {
  event: MatchEvent;
  reduce: boolean;
}) {
  const inn = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) return;
    inn.value = withSpring(1, { stiffness: 240, damping: 24, mass: 1 });
  }, [inn, reduce]);

  const style = useAnimatedStyle(() => ({
    opacity: inn.value,
    transform: [{ translateY: (1 - inn.value) * -12 }],
  }));

  const goal = event.kind === 'goal';
  const whistle = event.kind === 'ht' || event.kind === 'ft' || event.kind === 'ko';

  return (
    <Animated.View
      style={[
        styles.ev,
        style,
        goal && (event.side === 'me' ? styles.evMe : styles.evOpp),
      ]}
    >
      <Text style={styles.evMin} allowFontScaling={false}>
        {event.kind === 'ko'
          ? ''
          : event.kind === 'ht'
            ? 'HT'
            : event.kind === 'ft'
              ? 'FT'
              : `${event.min}'`}
      </Text>
      <Text style={styles.evIcon} allowFontScaling={false}>
        {ICON[event.kind] ?? '•'}
      </Text>
      <View style={styles.evBody}>
        <Text style={[styles.evText, goal && styles.evTextGoal, whistle && styles.evTextWhistle]}>
          {event.text}
        </Text>
        {goal ? (
          <Text style={styles.evScore} allowFontScaling={false}>
            {event.me} {'–'} {event.opp}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
});

/**
 * A stat as a tug of war rather than two numbers in a row.
 *
 * The bar is the point: 62 shots to 4 and 6 shots to 4 are different games,
 * and only one of those is visible in the figures alone.
 */
function StatBar({
  label,
  a,
  b,
  suffix = '',
  decimals = 0,
}: {
  label: string;
  a: number;
  b: number;
  suffix?: string;
  decimals?: number;
}) {
  const total = a + b;
  const share = total > 0 ? a / total : 0.5;
  const fmt = (n: number) => n.toFixed(decimals) + suffix;

  return (
    <View style={styles.sb}>
      <View style={styles.sbHead}>
        <Text style={[styles.sbVal, { color: NIGHT.me }]} allowFontScaling={false}>
          {fmt(a)}
        </Text>
        <Text style={styles.sbLabel}>{label}</Text>
        <Text style={[styles.sbVal, styles.sbValRight]} allowFontScaling={false}>
          {fmt(b)}
        </Text>
      </View>
      <View style={styles.sbTrack}>
        <View style={[styles.sbFill, { flex: Math.max(0.02, share), backgroundColor: NIGHT.me }]} />
        <View style={styles.sbGap} />
        <View
          style={[
            styles.sbFill,
            { flex: Math.max(0.02, 1 - share), backgroundColor: 'rgba(255,255,255,0.22)' },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(3,4,8,0.86)',
  },
  root: { flex: 1, paddingHorizontal: space.s3 },
  fill: { width: '100%', height: '100%' },

  card: {
    flex: 1,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: NIGHT.edge,
    backgroundColor: '#0B0E10',
    overflow: 'hidden',
    boxShadow: '0px 26px 64px rgba(0,0,0,0.7)',
  },

  /* the broadcast block */
  top: {
    paddingTop: space.s4,
    paddingHorizontal: space.s4,
    paddingBottom: space.s3,
    backgroundColor: '#37003C',
    experimental_backgroundImage: NIGHT.top,
    borderBottomWidth: 1,
    borderBottomColor: NIGHT.edge,
    overflow: 'hidden',
  },
  bloom: { position: 'absolute', top: -40, left: -30, right: -30, height: 190 },
  grain: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05 },
  flash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: '18%',
    right: '18%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  comp: {
    ...text.key,
    fontSize: 10,
    color: NIGHT.hot,
    textAlign: 'center',
    marginBottom: space.s3,
  },

  scoreline: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s2 },
  side: { flex: 1, alignItems: 'center', gap: 7, minWidth: 0 },
  team: {
    ...text.key,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.86)',
    textAlign: 'center',
  },
  centre: { minWidth: 118, alignItems: 'center' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  score: {
    fontFamily: font.hero,
    fontSize: 46,
    lineHeight: 60,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  colon: {
    fontFamily: font.hero,
    fontSize: 26,
    lineHeight: 60,
    color: 'rgba(255,255,255,0.42)',
  },
  clock: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 1.4,
    color: NIGHT.me,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },

  clockTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: space.s4,
    overflow: 'hidden',
  },
  clockFill: {
    height: 3,
    width: '100%',
    borderRadius: 2,
    alignSelf: 'flex-start',
    transformOrigin: 'left',
    backgroundColor: NIGHT.hot,
    boxShadow: `0px 0px 8px ${NIGHT.hot}`,
  },
  halfNotch: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  swingHead: { alignItems: 'center', marginTop: space.s3 },
  swingKey: {
    ...text.key,
    fontSize: 8.5,
    letterSpacing: 1.6,
    color: 'rgba(255,255,255,0.42)',
  },
  swingTrack: { flexDirection: 'row', alignItems: 'center', marginTop: 5, height: 6 },
  swingHalf: { flex: 1, height: 6, justifyContent: 'center' },
  swingFill: { height: 6, width: '100%', borderRadius: 3 },
  swingLeft: {
    alignSelf: 'flex-end',
    transformOrigin: 'right',
    backgroundColor: NIGHT.opp,
  },
  swingRight: {
    alignSelf: 'flex-start',
    transformOrigin: 'left',
    backgroundColor: NIGHT.me,
  },
  swingSpine: { width: 2, height: 10, backgroundColor: 'rgba(255,255,255,0.28)' },

  /* the feed */
  feed: { flex: 1 },
  feedPad: { padding: space.s4, paddingBottom: space.s5 },

  ev: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.s3,
    paddingVertical: 10,
    paddingHorizontal: space.s3,
    marginHorizontal: -space.s3,
    borderRadius: radius.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  evMe: { backgroundColor: 'rgba(0,255,133,0.09)' },
  evOpp: { backgroundColor: 'rgba(255,92,122,0.09)' },
  evMin: {
    width: 30,
    textAlign: 'right',
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 19,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  evIcon: { fontSize: 14, lineHeight: 19, width: 18, textAlign: 'center' },
  evBody: { flex: 1, gap: 2 },
  evText: {
    fontFamily: font.bodyMed,
    fontSize: 14,
    lineHeight: 19,
    color: color.text1,
  },
  evTextGoal: { fontFamily: font.bodyBold },
  evTextWhistle: {
    ...text.key,
    fontSize: 10,
    lineHeight: 19,
    color: color.text2,
  },
  evScore: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 1,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },

  /* full time stats */
  stats: {
    marginBottom: space.s4,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: 'linear-gradient(180deg, #16241C 0%, #0D1611 100%)',
    gap: space.s3,
  },
  statsTitle: {
    ...text.key,
    fontSize: 10,
    color: NIGHT.hot,
    marginBottom: 2,
  },
  sb: { gap: 6 },
  sbHead: { flexDirection: 'row', alignItems: 'baseline' },
  sbVal: {
    width: 54,
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 18,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  sbValRight: { textAlign: 'right', color: color.text2 },
  sbLabel: {
    flex: 1,
    textAlign: 'center',
    ...text.key,
    fontSize: 9.5,
    color: color.text3,
  },
  sbTrack: { flexDirection: 'row', alignItems: 'center', height: 5 },
  sbFill: { height: 5, borderRadius: 3 },
  sbGap: { width: 3 },

  /* actions */
  actions: {
    padding: space.s3,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  primary: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: '#E90052',
    experimental_backgroundImage: 'linear-gradient(100deg, #E90052 0%, #FF2D78 100%)',
    boxShadow: '0px 8px 22px rgba(233,0,82,0.35), inset 0px 1px 0px rgba(255,255,255,0.2)',
  },
  primaryText: { ...text.button, color: '#FFFFFF' },
  secondary: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  secondaryText: { ...text.button, color: color.text1 },
});
