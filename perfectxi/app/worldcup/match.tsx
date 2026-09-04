import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { ModeScreen, Press, Confetti, Shine } from '../../src/ui/components';
import { back, swap } from '../../src/game/nav';
import { color, space, radius, line, hue, alpha } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic, useReduceMotion } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import { STAGE_NAME, wcTeam, type WcPlayed } from '../../src/engine';
import { playNextMatch, useWorldCup } from '../../src/game/worldcup';

/**
 * One match.
 *
 * The whole reason the World Cup is its own mode. A league season is
 * thirty eight results arriving; this is one match, and it gets a screen
 * to itself: who you are playing, a moment of nothing happening, and
 * then a scoreline that means you are through or out.
 *
 * The result is decided the instant you arrive, because it has to be
 * banked before anything is shown or a phone that dies halfway through
 * an animation comes back to a different score. The clock is theatre
 * over a result that already exists, which is the only honest way to
 * animate something that has to survive being closed.
 */
export default function WorldCupMatch() {
  const run = useWorldCup();
  const reduce = useReduceMotion();
  const [step, setStep] = useState<WcPlayed | null>(null);
  const [shown, setShown] = useState(false);
  const fired = useRef(false);

  const minute = useSharedValue(0);
  const pop = useSharedValue(0.9);

  /* Played once, on arrival, and banked before a pixel of it is drawn. */
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const got = playNextMatch();
    if (!got) {
      swap('/worldcup/hub');
      return;
    }
    setStep(got);
    haptic('medium');
    sfx('tick');

    if (reduce) {
      setShown(true);
      minute.value = 1;
      pop.value = 1;
      return;
    }
    minute.value = withTiming(1, { duration: 2200 });
    const t = setTimeout(() => {
      setShown(true);
      const won = got.match.pens
        ? got.match.pens.a > got.match.pens.b
        : got.match.ga > got.match.gb;
      haptic(won ? 'success' : 'warning');
      sfx(won ? 'pick' : 'tick');
      pop.value = withSequence(
        withSpring(1.08, { stiffness: 280, damping: 12 }),
        withSpring(1, { stiffness: 240, damping: 18 }),
      );
    }, 2300);
    return () => clearTimeout(t);
  }, [reduce, minute, pop]);

  const clock = useAnimatedStyle(() => ({ width: `${minute.value * 100}%` }));
  const scoreStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const onDone = useCallback(() => {
    haptic('light');
    swap('/worldcup/hub');
  }, []);

  if (!run || !step) {
    return (
      <ModeScreen overline="World Cup 2026" title="Kick off" scroll={false} onBack={() => back()}>
        <View />
      </ModeScreen>
    );
  }

  const m = step.match;
  const me = wcTeam(m.a);
  const them = wcTeam(m.b);
  const won = m.pens ? m.pens.a > m.pens.b : m.ga > m.gb;
  const lost = m.pens ? m.pens.a < m.pens.b : m.ga < m.gb;
  const tint = !shown ? hue.gold : won ? hue.emerald : lost ? hue.crimson : hue.amber;

  /* What it meant, which in a knockout is everything. */
  const after = step.run;
  const line = !shown
    ? ''
    : m.stage === 'group'
      ? after.over
        ? 'Out at the group stage.'
        : after.stage === 'group'
          ? 'One more group game.'
          : `Through. ${STAGE_NAME[after.stage]} next.`
      : won
        ? m.stage === 'final'
          ? 'Champions of the world.'
          : `Through to the ${STAGE_NAME[after.stage]}.`
        : 'Out.';

  return (
    <ModeScreen
      overline={STAGE_NAME[m.stage]}
      title={shown ? 'Full time' : 'Kick off'}
      scroll={false}
      onBack={() => (shown ? onDone() : undefined)}
    >
      {shown && won && m.stage === 'final' ? <Confetti fire /> : null}

      <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
        <View style={[styles.pitch, { borderColor: alpha(tint, 0.45) }]}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%">
              <Defs>
                <RadialGradient id="mglow" cx="50%" cy="30%" r="80%">
                  <Stop offset="0" stopColor={tint} stopOpacity={0.22} />
                  <Stop offset="1" stopColor={tint} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#mglow)" />
            </Svg>
          </View>
          <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />

          <View style={styles.sides}>
            <View style={styles.side}>
              <Text style={styles.flag} allowFontScaling={false}>
                {me?.f}
              </Text>
              <Text style={styles.sideName} numberOfLines={1}>
                {me?.n}
              </Text>
              <Text style={styles.sideRate}>Rated {me?.r}</Text>
            </View>

            <View style={styles.middle}>
              {shown ? (
                <Animated.Text style={[styles.score, scoreStyle]} allowFontScaling={false}>
                  {m.ga}-{m.gb}
                </Animated.Text>
              ) : (
                <Text style={styles.versus}>v</Text>
              )}
              {shown && m.pens ? (
                <Text style={styles.pens}>
                  {m.pens.a}-{m.pens.b} on penalties
                </Text>
              ) : null}
            </View>

            <View style={styles.side}>
              <Text style={styles.flag} allowFontScaling={false}>
                {them?.f}
              </Text>
              <Text style={styles.sideName} numberOfLines={1}>
                {them?.n}
              </Text>
              <Text style={styles.sideRate}>Rated {them?.r}</Text>
            </View>
          </View>

          {!shown ? (
            <View style={styles.clock}>
              <Animated.View style={[styles.clockFill, clock]} />
            </View>
          ) : (
            <Text style={[styles.line, { color: tint }]}>{line}</Text>
          )}
        </View>

        {shown && step.scorers.length ? (
          <>
            <Text style={[text.label, styles.sect]}>Your scorers</Text>
            <View style={styles.card}>
              {step.scorers.map((s, i) => (
                <View key={`${s.scorer}-${i}`} style={styles.scorer}>
                  <Text style={styles.ball} allowFontScaling={false}>
                    {'⚽'}
                  </Text>
                  <Text style={styles.scorerName} numberOfLines={1}>
                    {s.scorer}
                  </Text>
                  {s.assist ? (
                    <Text style={styles.assist} numberOfLines={1}>
                      {s.assist}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </>
        ) : null}

        {shown && !step.scorers.length ? (
          <Text style={styles.blank}>
            {m.ga === 0 ? 'Nobody could find a way through.' : ''}
          </Text>
        ) : null}

        {shown ? (
          <Press onPress={onDone} feel="medium" scaleTo={0.98} style={styles.go}>
            <Text style={styles.goText}>
              {after.over ? 'The tournament report' : 'Back to the tournament'}
            </Text>
          </Press>
        ) : null}

        <View style={{ height: space.s6 }} />
      </ScrollView>
    </ModeScreen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  pitch: {
    paddingVertical: space.s5,
    paddingHorizontal: space.s3,
    borderRadius: radius.xl,
    borderWidth: 1,
    backgroundColor: '#0B100C',
    overflow: 'hidden',
    gap: space.s4,
  },
  sides: { flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1, alignItems: 'center', gap: 1 },
  flag: { fontSize: 40, lineHeight: 50 },
  sideName: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 19,
    color: color.text1,
    textAlign: 'center',
  },
  sideRate: { ...text.key, fontSize: 7.5, color: color.text3 },
  middle: { alignItems: 'center', paddingHorizontal: space.s2, gap: 2 },
  versus: { fontFamily: font.displayBold, fontSize: 20, color: color.text3 },
  score: {
    fontFamily: font.hero,
    fontSize: 44,
    lineHeight: 54,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  pens: { ...text.key, fontSize: 7.5, color: color.text3, textAlign: 'center' },

  clock: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  clockFill: { height: 5, borderRadius: 3, backgroundColor: hue.gold },
  line: { ...text.button, fontSize: 15, textAlign: 'center' },

  sect: { marginTop: space.s5, marginBottom: space.s2 },
  card: {
    padding: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  scorer: { flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingVertical: 6 },
  ball: { fontSize: 14 },
  scorerName: {
    flex: 1,
    minWidth: 0,
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 20,
    color: color.text1,
  },
  assist: { ...text.small, fontSize: 11.5, color: color.text3, maxWidth: 130 },
  blank: { ...text.small, fontSize: 13, color: color.text3, textAlign: 'center', marginTop: space.s4 },

  go: {
    marginTop: space.s5,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.gold, 0.5),
    backgroundColor: alpha(hue.gold, 0.14),
  },
  goText: { ...text.button, fontSize: 15, color: hue.gold },
});
