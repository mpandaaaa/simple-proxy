import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Animated, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ModeScreen, Button, Press, Pitch } from '../../src/ui/components';
import { color, space, radius, gradient, shadow, line } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic, useReduceMotion } from '../../src/ui/feel';
import { chemBonus, simulateSeason, squadAvg, type Grade } from '../../src/engine';
import { runRng, setResult, useRun } from '../../src/game/run';
import { progressStore } from '../../src/save';

/** How long a match sits on screen before the next one lands. */
const TICK = 380;

const OUTCOME_COLOR = {
  win: color.win,
  draw: color.draw,
  loss: color.loss,
} as const;

export default function Season() {
  const run = useRun();
  const reduceMotion = useReduceMotion();
  const [shown, setShown] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saved = useRef(false);
  const progress = useRef(new Animated.Value(0)).current;

  // The whole season is played the moment the screen opens. Revealing it a
  // match at a time is presentation; the result is already decided, which is
  // also what makes it replayable from the seed.
  //
  // Played in an effect rather than in a useMemo. A memo runs during render
  // and this writes to the run store, and writing to a store mid render is
  // how you get a season played twice under StrictMode.
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
    if (reduceMotion) {
      setShown(result.matches.length);
      return;
    }
    if (shown >= result.matches.length) return;
    timer.current = setTimeout(() => {
      // The haptic fires here, not inside the updater. React is free to run
      // an updater more than once, and a win would then buzz twice.
      if (result.matches[shown].oc === 'win') haptic('light');
      setShown((n) => n + 1);
    }, TICK);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [result, shown, reduceMotion]);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: total ? shown / total : 0,
      duration: reduceMotion ? 0 : 200,
      useNativeDriver: true,
    }).start();
  }, [shown, total, progress, reduceMotion]);

  // Banked once, when the season actually finishes.
  useEffect(() => {
    if (!done || !result || saved.current) return;
    saved.current = true;
    haptic(result.position === 1 ? 'success' : 'medium');
    progressStore.update((p) => ({
      ...p,
      seasons: p.seasons + 1,
      titles: p.titles + (result.position === 1 ? 1 : 0),
      best: Math.max(p.best, result.pts),
      coins: p.coins + Math.round(result.pts / 2),
      xp: p.xp + result.pts,
    }));
  }, [done, result]);

  const skip = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    haptic('medium');
    setShown(total);
  }, [total]);

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

  return (
    <ModeScreen
      overline={done ? 'Season complete' : `Match ${shown} of ${total}`}
      title={done ? `${result.pts} points` : `${pts} points`}
      scroll={false}
      right={
        done ? (
          <GradeBadge grade={result.grade} />
        ) : (
          <Press onPress={skip} feel="none" scaleTo={0.94} style={styles.skip}>
            <Text style={styles.skipText}>Skip</Text>
          </Press>
        )
      }
    >
      <View style={styles.bar}>
        <Animated.View
          style={[
            styles.barFill,
            { transform: [{ scaleX: progress }] },
          ]}
        />
      </View>

      <View style={styles.statRow}>
        <Stat label="W" value={w} tone={color.win} />
        <Stat label="D" value={d} tone={color.draw} />
        <Stat label="L" value={l} tone={color.loss} />
        <Stat label="GF" value={gf} />
        <Stat label="GA" value={ga} />
      </View>

      {done ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.finalPad}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[text.label, styles.sectionLabel]}>Final table</Text>
          <View style={styles.table}>
            {result.table.map((r, i) => (
              <View
                key={r.name}
                style={[styles.tableRow, r.isYou && styles.tableRowYou]}
              >
                <Text style={[styles.tPos, r.isYou && styles.tYouText]}>{i + 1}</Text>
                <Text
                  style={[styles.tName, r.isYou && styles.tYouText]}
                  numberOfLines={1}
                >
                  {r.name}
                </Text>
                <Text style={[styles.tNum, r.isYou && styles.tYouText]}>{r.w}</Text>
                <Text style={[styles.tNum, r.isYou && styles.tYouText]}>{r.d}</Text>
                <Text style={[styles.tNum, r.isYou && styles.tYouText]}>{r.l}</Text>
                <Text style={[styles.tNum, styles.tGd, r.isYou && styles.tYouText]}>
                  {r.gf - r.ga > 0 ? '+' : ''}
                  {r.gf - r.ga}
                </Text>
                <Text style={[styles.tPts, r.isYou && styles.tYouText]}>{r.pts}</Text>
              </View>
            ))}
          </View>

          <Text style={[text.label, styles.sectionLabel]}>Your XI</Text>
          <Pitch squad={run.state.squad} formation={run.state.config.formation} />

          <Text style={[text.label, styles.sectionLabel]}>Top scorers</Text>
          <View style={styles.scorers}>
            {Object.entries(result.playerStats)
              .sort((a, b) => b[1].g - a[1].g || b[1].a - a[1].a)
              .slice(0, 5)
              .map(([name, s]) => (
                <View key={name} style={styles.scorerRow}>
                  <Text style={styles.scorerName} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={styles.scorerStat}>
                    {s.g} goals · {s.a} assists
                  </Text>
                </View>
              ))}
          </View>

          <View style={styles.summary}>
            <Text style={[text.small, styles.summaryText]}>
              Squad average {Math.round(squadAvg(run.state.squad))} ·{' '}
              {result.cleanSheets} clean sheets · best run {result.longestStreak}{' '}
              wins · biggest win {result.biggestWin ?? 'none'}
            </Text>
            <Text style={[text.small, styles.summaryText]}>
              Expected {result.xgF} for, {result.xgA} against
            </Text>
          </View>

          <Button
            label="Back to home"
            style={styles.homeBtn}
            onPress={() => router.dismissAll()}
          />
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.feedPad}
          showsVerticalScrollIndicator={false}
        >
          {played
            .slice()
            .reverse()
            .map((m) => (
              <View key={m.n} style={styles.match}>
                <Text style={styles.matchNo}>{m.n}</Text>
                <Text style={styles.matchOpp} numberOfLines={1}>
                  {m.home ? 'v ' : 'at '}
                  {m.opp}
                </Text>
                <View
                  style={[
                    styles.score,
                    { borderColor: OUTCOME_COLOR[m.oc] + '66' },
                  ]}
                >
                  <Text style={[styles.scoreText, { color: OUTCOME_COLOR[m.oc] }]}>
                    {m.gf}-{m.ga}
                  </Text>
                </View>
              </View>
            ))}
        </ScrollView>
      )}
    </ModeScreen>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone ? { color: tone } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const GRADE_TONE: Record<Grade, string> = {
  S: color.gold,
  A: color.accent,
  B: color.accent,
  C: color.blue,
  D: color.text2,
  E: color.warning,
  F: color.danger,
};

function GradeBadge({ grade }: { grade: Grade }) {
  const tone = GRADE_TONE[grade];
  return (
    <View style={[styles.grade, { borderColor: tone, backgroundColor: tone + '1f' }]}>
      <Text style={[styles.gradeText, { color: tone }]}>{grade}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  skip: {
    paddingHorizontal: space.s3 + 2,
    paddingVertical: space.s2 + 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: line.cardHot,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  skipText: { ...text.key, color: color.text2 },
  grade: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeText: { fontFamily: font.displayBlack, fontSize: 21, lineHeight: 24 },

  bar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: line.card,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    backgroundColor: color.accent,
    // scaleX from a zero-width-anchored bar: transform runs on the native
    // thread, animating width would not.
    width: '100%',
    transform: [{ scaleX: 0 }],
    alignSelf: 'flex-start',
    transformOrigin: 'left',
  },

  statRow: {
    flexDirection: 'row',
    gap: space.s2,
    marginTop: space.s4,
    marginBottom: space.s3,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.s2 + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow: shadow.card,
  },
  statValue: {
    fontFamily: font.displayBold,
    fontSize: 20,
    lineHeight: 23,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { ...text.key, fontSize: 10, color: color.text3 },

  feedPad: { paddingBottom: space.s7 },
  match: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: space.s3,
    paddingHorizontal: space.s3,
    marginBottom: space.s2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow: shadow.card,
  },
  matchNo: {
    ...text.key,
    color: color.text3,
    minWidth: 22,
    fontVariant: ['tabular-nums'],
  },
  matchOpp: {
    flex: 1,
    fontFamily: font.bodyMed,
    fontSize: 15,
    color: color.text1,
  },
  score: {
    minWidth: 58,
    alignItems: 'center',
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  scoreText: {
    fontFamily: font.displayBlack,
    fontSize: 17,
    fontVariant: ['tabular-nums'],
  },

  finalPad: { paddingBottom: space.s8 },
  sectionLabel: { marginTop: space.s5, marginBottom: space.s2 },
  table: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow: shadow.card,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.s2,
    paddingHorizontal: space.s3,
    gap: space.s2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  tableRowYou: { backgroundColor: color.accentWeak },
  tPos: {
    ...text.key,
    color: color.text3,
    minWidth: 18,
    fontVariant: ['tabular-nums'],
  },
  tName: {
    flex: 1,
    fontFamily: font.bodyMed,
    fontSize: 13.5,
    color: color.text1,
  },
  tNum: {
    fontFamily: font.body,
    fontSize: 12.5,
    color: color.text3,
    minWidth: 18,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  tGd: { minWidth: 30 },
  tPts: {
    fontFamily: font.displayBold,
    fontSize: 15,
    color: color.text1,
    minWidth: 26,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  tYouText: { color: color.accent },

  scorers: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow: shadow.card,
    paddingHorizontal: space.s3,
  },
  scorerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s3,
    paddingVertical: space.s3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  scorerName: {
    flex: 1,
    fontFamily: font.bodySemi,
    fontSize: 14,
    color: color.text1,
  },
  scorerStat: { ...text.small, color: color.text3 },

  summary: { marginTop: space.s5, gap: space.s1 },
  summaryText: { textAlign: 'center' },
  homeBtn: { marginTop: space.s6 },
});
