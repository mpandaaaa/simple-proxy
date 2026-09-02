import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { router, Stack } from 'expo-router';
import { ModeScreen, Press, Ticker, Confirm } from '../../src/ui/components';
import { color, space, radius, line, gradient } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic, useReduceMotion } from '../../src/ui/feel';
import {
  chemBonus,
  livePosition,
  ordinal,
  simulateSeason,
  type MatchResult,
} from '../../src/engine';
import { clearRun, runRng, setResult, useRun } from '../../src/game/run';

/** How long a match holds before the next one lands. */
const TICK = 360;
/** The pause on the last whistle before the results arrive. */
const FINAL_HOLD = 700;

const OUTCOME = {
  win: { tint: color.win, letter: 'W' },
  draw: { tint: color.draw, letter: 'D' },
  loss: { tint: color.loss, letter: 'L' },
} as const;

/**
 * The season playing out.
 *
 * The whole thing is decided the moment the screen opens. Revealing it a
 * match at a time is theatre, and it is also what makes the result
 * replayable: nothing here can change what was already drawn.
 *
 * Same readout as the site: points, goals, conceded and position, a recent
 * form strip, a progress bar and the fixtures as they come in. Position is
 * live, which means pro-rating the other nineteen to the number of games
 * you have actually played, or it reads twentieth until the final whistle.
 */
export default function Season() {
  const run = useRun();
  const reduce = useReduceMotion();
  const [shown, setShown] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feed = useRef<ScrollView>(null);
  const progress = useSharedValue(0);

  // Played the moment the screen opens, in an effect rather than a memo:
  // a memo runs during render and this writes to the run store.
  useEffect(() => {
    if (!run || run.result) return;
    setResult(
      simulateSeason(
        run.state.squad,
        run.state.config.formation,
        chemBonus(run.state.squad),
        runRng(),
      ),
    );
  }, [run]);

  const result = run?.result ?? null;
  const total = result ? result.matches.length : 0;
  const done = total > 0 && shown >= total;

  useEffect(() => {
    if (!run) router.replace('/draft');
  }, [run]);

  useEffect(() => {
    if (!result) return;
    if (reduce) {
      setShown(result.matches.length);
      return;
    }
    if (shown >= result.matches.length) return;
    timer.current = setTimeout(() => {
      // Fired here rather than in the updater: React may run an updater
      // more than once, and a win would then buzz twice.
      const m = result.matches[shown];
      haptic(m.oc === 'win' ? 'light' : m.oc === 'loss' ? 'warning' : 'select');
      setShown((n) => n + 1);
    }, TICK);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [result, shown, reduce]);

  useEffect(() => {
    progress.value = withTiming(total ? shown / total : 0, {
      duration: reduce ? 0 : 220,
      easing: Easing.out(Easing.quad),
    });
  }, [shown, total, progress, reduce]);

  // The final whistle, then the papers.
  useEffect(() => {
    if (!done || !result) return;
    haptic(result.position === 1 ? 'success' : 'medium');
    const t = setTimeout(() => router.replace('/draft/results'), FINAL_HOLD);
    return () => clearTimeout(t);
  }, [done, result]);

  const skip = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    haptic('medium');
    setShown(total);
  }, [total]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  if (!run || !result) return null;

  const played = result.matches.slice(0, shown);
  let w = 0;
  let d = 0;
  let l = 0;
  let gf = 0;
  let ga = 0;
  for (const m of played) {
    if (m.oc === 'win') w++;
    else if (m.oc === 'draw') d++;
    else l++;
    gf += m.gf;
    ga += m.ga;
  }
  const pts = w * 3 + d;
  const pos = livePosition(pts, shown, result.table);
  const form = played.slice(-6);

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <ModeScreen
        overline={done ? 'Full time' : `Match ${shown} of ${total}`}
        title={`${pts} point${pts === 1 ? '' : 's'}`}
        scroll={false}
        onBack={() => setLeaving(true)}
        right={
          done ? undefined : (
            <Press onPress={skip} feel="none" scaleTo={0.94} style={styles.skip}>
              <Text style={styles.skipText}>Skip</Text>
            </Press>
          )
        }
      >
        <View style={styles.bar}>
          <Animated.View style={[styles.barFill, barStyle]} />
        </View>

        <View style={styles.statRow}>
          <Stat value={pts} label="Points" />
          <Stat value={gf} label="Goals" tint={color.win} />
          <Stat value={ga} label="Conceded" tint={color.loss} />
          <Stat
            value={shown ? pos : 0}
            label="Position"
            tint={pos <= 4 ? color.accent : pos >= 18 ? color.danger : undefined}
            ordinalise
          />
        </View>

        <View style={styles.formRow}>
          <Text style={styles.formLabel}>Recent form</Text>
          <View style={styles.formStrip}>
            {form.length ? (
              form.map((m) => (
                <View
                  key={m.n}
                  style={[
                    styles.formPip,
                    {
                      borderColor: OUTCOME[m.oc].tint,
                      backgroundColor: OUTCOME[m.oc].tint + '22',
                    },
                  ]}
                >
                  <Text style={[styles.formPipText, { color: OUTCOME[m.oc].tint }]}>
                    {OUTCOME[m.oc].letter}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.formNone}>Kick off</Text>
            )}
          </View>
        </View>

        <ScrollView
          ref={feed}
          style={styles.feed}
          contentContainerStyle={styles.feedPad}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {played
            .slice()
            .reverse()
            .map((m, i) => (
              <MatchRow key={m.n} match={m} fresh={i === 0 && !done} />
            ))}
        </ScrollView>

        <Confirm
          visible={leaving}
          title="Leave the season?"
          body="The season and your XI will be lost. This cannot be undone."
          confirmLabel="Leave"
          cancelLabel="Stay"
          onCancel={() => setLeaving(false)}
          onConfirm={() => {
            setLeaving(false);
            clearRun();
            router.dismissAll();
          }}
        />
      </ModeScreen>
    </>
  );
}

function Stat({
  value,
  label,
  tint,
  ordinalise,
}: {
  value: number;
  label: string;
  tint?: string;
  ordinalise?: boolean;
}) {
  return (
    <View style={styles.stat}>
      {ordinalise ? (
        <Text
          style={[styles.statValue, tint ? { color: tint } : null]}
          allowFontScaling={false}
        >
          {value ? ordinal(value) : '—'}
        </Text>
      ) : (
        <Ticker
          value={value}
          duration={280}
          style={[styles.statValue, tint ? { color: tint } : null]}
        />
      )}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** The newest result lands rather than appearing. */
function MatchRow({ match, fresh }: { match: MatchResult; fresh: boolean }) {
  const reduce = useReduceMotion();
  const land = useSharedValue(fresh && !reduce ? 0 : 1);

  useEffect(() => {
    if (!fresh || reduce) return;
    land.value = withSpring(1, { stiffness: 260, damping: 18, mass: 1 });
  }, [fresh, land, reduce]);

  const style = useAnimatedStyle(() => ({
    opacity: land.value,
    transform: [{ translateY: (1 - land.value) * -10 }],
  }));

  const oc = OUTCOME[match.oc];

  return (
    <Animated.View style={[styles.match, style, { borderLeftColor: oc.tint }]}>
      <Text style={styles.matchNo}>{match.n}</Text>
      <View style={styles.matchBody}>
        <Text style={styles.matchOpp} numberOfLines={1}>
          {match.home ? 'v ' : 'at '}
          {match.opp}
        </Text>
        {match.scorers.length ? (
          <Text style={styles.matchScorers} numberOfLines={1}>
            {match.scorers.map((s) => `${s.name} ${s.min}'`).join('  ·  ')}
          </Text>
        ) : null}
      </View>
      <View style={[styles.score, { borderColor: oc.tint + '77', backgroundColor: oc.tint + '1a' }]}>
        <Text style={[styles.scoreText, { color: oc.tint }]} allowFontScaling={false}>
          {match.gf}-{match.ga}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  skip: {
    paddingHorizontal: space.s3 + 2,
    paddingVertical: space.s2 + 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: line.cardHot,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  skipText: { ...text.key, fontSize: 10, color: color.text2 },

  bar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: line.card,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    width: '100%',
    backgroundColor: color.accent,
    alignSelf: 'flex-start',
    transformOrigin: 'left',
    boxShadow: `0px 0px 10px ${color.accent}88`,
  },

  statRow: { flexDirection: 'row', gap: space.s2, marginTop: space.s4 },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  statValue: {
    fontFamily: font.displayBlack,
    fontSize: 22,
    lineHeight: 27,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { ...text.key, fontSize: 8.5, color: color.text3, marginTop: 2 },

  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    marginTop: space.s3,
  },
  formLabel: { ...text.key, fontSize: 9.5, color: color.text3 },
  formStrip: { flexDirection: 'row', gap: 5, flex: 1 },
  formPip: {
    width: 26,
    height: 26,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formPipText: { fontFamily: font.displayBlack, fontSize: 12, lineHeight: 15 },
  formNone: { ...text.small, color: color.text3 },

  feed: { flex: 1, marginTop: space.s4 },
  feedPad: { paddingBottom: space.s7 },
  match: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    marginBottom: space.s2,
    paddingVertical: space.s2 + 2,
    paddingHorizontal: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    borderLeftWidth: 3,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  matchNo: {
    ...text.key,
    fontSize: 10,
    color: color.text3,
    minWidth: 22,
    fontVariant: ['tabular-nums'],
  },
  matchBody: { flex: 1, minWidth: 0 },
  matchOpp: {
    fontFamily: font.bodySemi,
    fontSize: 15,
    lineHeight: 20,
    color: color.text1,
  },
  matchScorers: {
    fontFamily: font.body,
    fontSize: 11,
    lineHeight: 15,
    color: color.text3,
  },
  score: {
    minWidth: 60,
    alignItems: 'center',
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  scoreText: {
    fontFamily: font.displayBlack,
    fontSize: 17,
    lineHeight: 21,
    fontVariant: ['tabular-nums'],
  },
});
