import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Text, View, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { router, Stack } from 'expo-router';
import {
  ModeScreen,
  Button,
  Press,
  Ticker,
  Rise,
  Pitch,
  Sheet,
  Confirm,
} from '../../src/ui/components';
import { color, space, radius, line, gradient } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { GRAIN_URI } from '../../src/ui/grain';
import { haptic, useReduceMotion } from '../../src/ui/feel';
import {
  awards,
  calcOdds,
  chemBonus,
  lastName,
  ordinal,
  squadAvg,
  verdict,
  type Grade,
  type MatchResult,
  type SeasonResult,
} from '../../src/engine';
import { clearRun, useRun } from '../../src/game/run';
import { progressStore } from '../../src/save';

/**
 * What finishing there actually means, and what colour it is.
 *
 * A results screen that treats first and seventeenth the same is a
 * scoreboard. This is the moment the whole run resolves into, so where you
 * came dresses the entire top of the page.
 */
function finishTone(pos: number) {
  if (pos === 1)
    return { tint: color.gold, badge: 'Champions', mark: '🏆' };
  if (pos <= 4)
    return { tint: color.accent, badge: 'Champions League', mark: '★' };
  if (pos <= 7)
    return { tint: color.blue, badge: 'Europe', mark: '✦' };
  if (pos <= 17)
    return { tint: color.text2, badge: 'Survived', mark: '—' };
  return { tint: color.danger, badge: 'Relegated', mark: '▼' };
}

const GRADE_TINT: Record<Grade, string> = {
  S: color.gold,
  A: color.accent,
  B: color.accent,
  C: color.blue,
  D: color.text2,
  E: color.warning,
  F: color.danger,
};

const OUTCOME = {
  win: { tint: color.win, letter: 'W' },
  draw: { tint: color.draw, letter: 'D' },
  loss: { tint: color.loss, letter: 'L' },
} as const;

/**
 * The season, finished.
 *
 * The site shows a table, some highlights and a verdict. This keeps all of
 * that and adds the thing the site had the numbers for and never said: you
 * were told before kick off exactly where an XI this good should finish, so
 * the first thing this screen does is tell you whether you beat it.
 */
export default function Results() {
  const run = useRun();
  const [tapped, setTapped] = useState<MatchResult | null>(null);
  const [leaving, setLeaving] = useState(false);
  /** banked once, on arrival, however many times this screen re-renders */
  const banked = useRef(false);

  useEffect(() => {
    if (!run || !run.result) router.replace('/draft');
  }, [run]);

  // The season goes on the record here rather than while it was playing,
  // so a season abandoned halfway never counts.
  useEffect(() => {
    const r = run?.result;
    if (!r || banked.current) return;
    banked.current = true;
    progressStore.update((p) => ({
      ...p,
      seasons: p.seasons + 1,
      titles: p.titles + (r.position === 1 ? 1 : 0),
      best: Math.max(p.best, r.pts),
      coins: p.coins + 30 + Math.round(r.pts / 2) + (r.position === 1 ? 120 : r.position <= 4 ? 45 : 0),
      xp: p.xp + 140 + r.pts * 3 + (r.position === 1 ? 400 : r.position <= 4 ? 180 : r.position <= 10 ? 60 : 0),
    }));
  }, [run]);

  const result = run?.result ?? null;

  const trophies = useMemo(
    () => (run && result ? awards(result.playerStats, run.state.squad) : null),
    [run, result],
  );

  if (!run || !result) return null;

  const { squad, config } = run.state;
  const avg = squadAvg(squad);
  const odds = calcOdds(avg, chemBonus(squad));
  const tone = finishTone(result.position);
  const paper = verdict(result);

  // What you were promised, against what you did.
  const placesBetter = odds.projFinish - result.position;
  const pointsBetter = result.pts - odds.expPts;

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <ModeScreen
        overline="Season complete"
        title={paper.headline}
        onBack={() => setLeaving(true)}
        right={
          <View
            style={[
              styles.grade,
              { borderColor: GRADE_TINT[result.grade], backgroundColor: GRADE_TINT[result.grade] + '1f' },
            ]}
          >
            <Text style={[styles.gradeText, { color: GRADE_TINT[result.grade] }]}>
              {result.grade}
            </Text>
          </View>
        }
      >
        <Rise delay={0}>
          <Finish result={result} tone={tone} />
        </Rise>

        <Rise delay={1}>
          <View style={[styles.paper, { borderLeftColor: tone.tint }]}>
            <Text style={styles.paperQuote}>{paper.quote}</Text>
            <Text style={styles.paperSource}>{paper.source}</Text>
          </View>
        </Rise>

        {/* The loop back to what squad complete promised. */}
        <Rise delay={2}>
          <Text style={styles.sectionTitle}>Against the odds</Text>
          <View style={styles.panel}>
            <Expectation
              label="Finish"
              expected={ordinal(odds.projFinish)}
              actual={ordinal(result.position)}
              delta={placesBetter}
              unit={Math.abs(placesBetter) === 1 ? 'place' : 'places'}
            />
            <Expectation
              label="Points"
              expected={String(odds.expPts)}
              actual={String(result.pts)}
              delta={pointsBetter}
              unit={Math.abs(pointsBetter) === 1 ? 'point' : 'points'}
            />
          </View>
        </Rise>

        <Rise delay={3}>
          <Text style={styles.sectionTitle}>Season highlights</Text>
          <View style={styles.grid}>
            <Cell v={(result.pts / 38).toFixed(2)} l="Points per game" />
            <Cell v={`${Math.round((result.wins / 38) * 100)}%`} l="Win rate" />
            <Cell
              v={`${result.gf - result.ga >= 0 ? '+' : ''}${result.gf - result.ga}`}
              l="Goal difference"
            />
            <Cell v={(result.gf / 38).toFixed(1)} l="Goals per game" />
            <Cell v={String(result.cleanSheets)} l="Clean sheets" />
            <Cell v={String(result.longestStreak)} l="Longest win run" />
            <Cell v={result.biggestWin ?? 'None'} l="Biggest win" />
            <Cell v={`${result.xgF}`} l="Expected goals" />
          </View>
        </Rise>

        {trophies && (trophies.boot || trophies.playmaker || trophies.glove) ? (
          <Rise delay={4}>
            <Text style={styles.sectionTitle}>Awards</Text>
            <View style={styles.awards}>
              {trophies.boot ? (
                <AwardRow
                  label="Golden Boot"
                  name={trophies.boot.name}
                  value={`${trophies.boot.value} goals`}
                  tint={color.gold}
                />
              ) : null}
              {trophies.playmaker ? (
                <AwardRow
                  label="Playmaker"
                  name={trophies.playmaker.name}
                  value={`${trophies.playmaker.value} assists`}
                  tint={color.accent}
                />
              ) : null}
              {trophies.glove ? (
                <AwardRow
                  label="Golden Glove"
                  name={trophies.glove.name}
                  value={`${trophies.glove.value} clean sheets`}
                  tint={color.gk}
                />
              ) : null}
            </View>
          </Rise>
        ) : null}

        {/* The whole season at a glance, and any of it one tap away. */}
        <Rise delay={5}>
          <Text style={styles.sectionTitle}>All 38 results</Text>
          <View style={styles.panel}>
            <View style={styles.matchGrid}>
              {result.matches.map((m) => (
                <Press
                  key={m.n}
                  onPress={() => {
                    haptic('select');
                    setTapped(m);
                  }}
                  feel="none"
                  scaleTo={0.88}
                  style={[
                    styles.pip,
                    {
                      borderColor: OUTCOME[m.oc].tint,
                      backgroundColor: OUTCOME[m.oc].tint + '22',
                    },
                  ]}
                >
                  <Text style={[styles.pipText, { color: OUTCOME[m.oc].tint }]}>
                    {OUTCOME[m.oc].letter}
                  </Text>
                </Press>
              ))}
            </View>
            <Text style={styles.note}>Tap any result for the score.</Text>
          </View>
        </Rise>

        <Rise delay={6}>
          <Text style={styles.sectionTitle}>Final table</Text>
          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={[styles.tPos, styles.tHeadText]}>#</Text>
              <Text style={[styles.tName, styles.tHeadText]}>Club</Text>
              <Text style={[styles.tNum, styles.tHeadText]}>W</Text>
              <Text style={[styles.tNum, styles.tHeadText]}>D</Text>
              <Text style={[styles.tNum, styles.tHeadText]}>L</Text>
              <Text style={[styles.tNum, styles.tGd, styles.tHeadText]}>GD</Text>
              <Text style={[styles.tPts, styles.tHeadText]}>Pts</Text>
            </View>
            {result.table.map((r, i) => {
              const zone =
                i === 0
                  ? color.gold
                  : i < 4
                    ? color.accent
                    : i < 7
                      ? color.blue
                      : i >= 17
                        ? color.danger
                        : 'transparent';
              return (
                <View
                  key={r.name}
                  style={[
                    styles.tableRow,
                    r.isYou && { backgroundColor: tone.tint + '1f' },
                  ]}
                >
                  <View style={[styles.zone, { backgroundColor: zone }]} />
                  <Text style={[styles.tPos, r.isYou && styles.tYou]}>{i + 1}</Text>
                  <Text style={[styles.tName, r.isYou && styles.tYou]} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={[styles.tNum, r.isYou && styles.tYou]}>{r.w}</Text>
                  <Text style={[styles.tNum, r.isYou && styles.tYou]}>{r.d}</Text>
                  <Text style={[styles.tNum, r.isYou && styles.tYou]}>{r.l}</Text>
                  <Text style={[styles.tNum, styles.tGd, r.isYou && styles.tYou]}>
                    {r.gf - r.ga > 0 ? '+' : ''}
                    {r.gf - r.ga}
                  </Text>
                  <Text style={[styles.tPts, r.isYou && styles.tYou]}>{r.pts}</Text>
                </View>
              );
            })}
          </View>
        </Rise>

        <Rise delay={7}>
          <Text style={styles.sectionTitle}>The XI that did it</Text>
          <Pitch squad={squad} formation={config.formation} />
        </Rise>

        <Rise delay={8}>
          <Button
            label="Draft another XI"
            style={styles.cta}
            onPress={() => {
              clearRun();
              router.dismissAll();
              router.push('/draft');
            }}
          />
        </Rise>

        <Sheet visible={!!tapped} onClose={() => setTapped(null)}>
          <View style={styles.sheet}>
            <View style={styles.sheetGrab} />
            {tapped ? <MatchDetail match={tapped} tone={tone.tint} /> : null}
          </View>
        </Sheet>

        <Confirm
          visible={leaving}
          title="Leave this season?"
          body="The result will not be kept. This cannot be undone."
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

/** Where you finished, dressed as what it means. */
function Finish({
  result,
  tone,
}: {
  result: SeasonResult;
  tone: ReturnType<typeof finishTone>;
}) {
  const reduce = useReduceMotion();
  const pop = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) return;
    pop.value = withDelay(140, withSpring(1, { stiffness: 160, damping: 12, mass: 1 }));
  }, [pop, reduce]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: 0.6 + pop.value * 0.4 }],
  }));
  const bloomStyle = useAnimatedStyle(() => ({ opacity: pop.value }));

  return (
    <View style={[styles.finish, { borderColor: tone.tint + '55' }]}>
      <Animated.View style={[styles.finishBloom, bloomStyle]} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="finishGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={tone.tint} stopOpacity={0.32} />
              <Stop offset="1" stopColor={tone.tint} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50" cy="34" rx="52" ry="44" fill="url(#finishGlow)" />
        </Svg>
      </Animated.View>
      <View style={styles.grain} pointerEvents="none">
        <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.grainImage} />
      </View>
      <View style={styles.finishEdge} pointerEvents="none" />

      <Animated.Text style={[styles.finishMark, markStyle]}>{tone.mark}</Animated.Text>

      <View style={[styles.finishBadge, { borderColor: tone.tint + '77', backgroundColor: tone.tint + '1f' }]}>
        <Text style={[styles.finishBadgeText, { color: tone.tint }]}>{tone.badge}</Text>
      </View>

      <View style={styles.finishPos}>
        <Ticker value={result.position} style={styles.finishNum} duration={800} />
        <Text style={[styles.finishOrd, { color: tone.tint }]}>
          {ordinal(result.position).replace(String(result.position), '')}
        </Text>
      </View>

      <Text style={styles.finishRecord}>
        {result.wins}W · {result.draws}D · {result.losses}L    {result.gf} scored ·{' '}
        {result.ga} conceded
      </Text>
    </View>
  );
}

/** Expected against actual, with the gap named. */
function Expectation({
  label,
  expected,
  actual,
  delta,
  unit,
}: {
  label: string;
  expected: string;
  actual: string;
  delta: number;
  unit: string;
}) {
  const good = delta > 0;
  const tint = delta === 0 ? color.text2 : good ? color.accent : color.danger;
  return (
    <View style={styles.expect}>
      <Text style={styles.expectLabel}>{label}</Text>
      <View style={styles.expectPair}>
        <Text style={styles.expectExpected}>{expected}</Text>
        <Text style={styles.expectArrow}>→</Text>
        <Text style={[styles.expectActual, { color: tint }]}>{actual}</Text>
      </View>
      <Text style={[styles.expectDelta, { color: tint }]}>
        {delta === 0
          ? 'exactly as predicted'
          : `${good ? '+' : ''}${delta} ${unit} ${good ? 'better' : 'worse'}`}
      </Text>
    </View>
  );
}

function Cell({ v, l }: { v: string; l: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellValue} allowFontScaling={false}>
        {v}
      </Text>
      <Text style={styles.cellLabel}>{l}</Text>
    </View>
  );
}

function AwardRow({
  label,
  name,
  value,
  tint,
}: {
  label: string;
  name: string;
  value: string;
  tint: string;
}) {
  return (
    <View style={[styles.award, { borderLeftColor: tint }]}>
      <View style={styles.awardBody}>
        <Text style={[styles.awardLabel, { color: tint }]}>{label}</Text>
        <Text style={styles.awardName} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <Text style={styles.awardValue}>{value}</Text>
    </View>
  );
}

function MatchDetail({ match, tone }: { match: MatchResult; tone: string }) {
  const oc = OUTCOME[match.oc];
  return (
    <View style={styles.detail}>
      <Text style={styles.detailOverline}>Match {match.n} of 38</Text>
      <Text style={styles.detailOpp}>
        {match.home ? 'v ' : 'at '}
        {match.opp}
      </Text>
      <View style={[styles.detailScore, { borderColor: oc.tint, backgroundColor: oc.tint + '1f' }]}>
        <Text style={[styles.detailScoreText, { color: oc.tint }]} allowFontScaling={false}>
          {match.gf}-{match.ga}
        </Text>
      </View>
      {match.scorers.length ? (
        <View style={styles.detailScorers}>
          {match.scorers.map((s, i) => (
            <View key={i} style={styles.detailScorer}>
              <Text style={styles.detailMin}>{s.min}&apos;</Text>
              <Text style={styles.detailName} numberOfLines={1}>
                {lastName(s.name)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.detailNone}>No goals.</Text>
      )}
      <Text style={styles.detailXg}>
        Expected {match.xgF} for, {match.xgA} against
      </Text>
      <View style={[styles.detailRule, { backgroundColor: tone }]} />
    </View>
  );
}

const PANEL = {
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: line.card,
  backgroundColor: '#101A14',
  experimental_backgroundImage: gradient.card,
} as const;

const styles = StyleSheet.create({
  grade: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeText: { fontFamily: font.displayBlack, fontSize: 21, lineHeight: 26 },

  finish: {
    alignItems: 'center',
    paddingVertical: space.s5,
    paddingHorizontal: space.s5,
    borderRadius: 26,
    borderWidth: 1,
    backgroundColor: '#0D1611',
    experimental_backgroundImage:
      'linear-gradient(180deg, #17231C 0%, #0C120E 60%, #080C09 100%)',
    boxShadow:
      '0px 20px 44px rgba(0,0,0,0.55), inset 0px 1px 0px rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  finishBloom: { position: 'absolute', top: -30, left: -30, right: -30, bottom: -30 },
  grain: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.04 },
  grainImage: { width: '100%', height: '100%' },
  finishEdge: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  finishMark: { fontSize: 44, lineHeight: 52 },
  finishBadge: {
    marginTop: space.s2,
    paddingHorizontal: space.s4,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  finishBadgeText: { ...text.key, fontSize: 10 },
  finishPos: { flexDirection: 'row', alignItems: 'flex-start', marginTop: space.s3 },
  finishNum: {
    fontFamily: font.hero,
    fontSize: 72,
    lineHeight: 94,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  finishOrd: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 32,
    marginTop: space.s4,
  },
  finishRecord: {
    fontFamily: font.bodyMed,
    fontSize: 12.5,
    color: color.text2,
    marginTop: -space.s2,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  paper: {
    ...PANEL,
    marginTop: space.s3,
    padding: space.s4,
    borderLeftWidth: 3,
  },
  paperQuote: {
    fontFamily: font.body,
    fontSize: 15,
    lineHeight: 22,
    color: color.text1,
    fontStyle: 'italic',
  },
  paperSource: { ...text.key, fontSize: 9.5, color: color.text3, marginTop: space.s2 },

  sectionTitle: {
    ...text.label,
    fontSize: 12.5,
    color: color.text2,
    marginTop: space.s6,
    marginBottom: space.s2,
  },
  panel: { ...PANEL, padding: space.s4, gap: space.s3 },
  note: { ...text.small, color: color.text3 },

  expect: { gap: 2 },
  expectLabel: { ...text.key, fontSize: 9.5, color: color.text3 },
  expectPair: { flexDirection: 'row', alignItems: 'baseline', gap: space.s2 },
  expectExpected: {
    fontFamily: font.displayBold,
    fontSize: 20,
    lineHeight: 24,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  expectArrow: { fontFamily: font.body, fontSize: 14, color: color.text3 },
  expectActual: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 32,
    fontVariant: ['tabular-nums'],
  },
  expectDelta: { fontFamily: font.bodyMed, fontSize: 12.5 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  cell: {
    ...PANEL,
    flexBasis: '47.5%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: space.s3,
    borderRadius: radius.md,
  },
  cellValue: {
    fontFamily: font.displayBlack,
    fontSize: 21,
    lineHeight: 26,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  cellLabel: { ...text.key, fontSize: 8.5, color: color.text3, marginTop: 2 },

  awards: { gap: space.s2 },
  award: {
    ...PANEL,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderLeftWidth: 3,
  },
  awardBody: { flex: 1, minWidth: 0 },
  awardLabel: { ...text.key, fontSize: 9 },
  awardName: {
    fontFamily: font.bodyBold,
    fontSize: 15.5,
    lineHeight: 20,
    color: color.text1,
  },
  awardValue: { fontFamily: font.bodyMed, fontSize: 12.5, color: color.text2 },

  matchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pip: {
    width: 34,
    height: 34,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipText: { fontFamily: font.displayBlack, fontSize: 13, lineHeight: 16 },

  table: { ...PANEL, overflow: 'hidden' },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingVertical: space.s2,
    paddingHorizontal: space.s3,
    borderBottomWidth: 1,
    borderBottomColor: line.card,
  },
  tHeadText: { ...text.key, fontSize: 8.5, color: color.text3 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingVertical: space.s2 + 1,
    paddingHorizontal: space.s3,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  zone: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  tPos: {
    fontFamily: font.displaySemi,
    fontSize: 12,
    color: color.text3,
    minWidth: 18,
    fontVariant: ['tabular-nums'],
  },
  tName: { flex: 1, fontFamily: font.bodyMed, fontSize: 13.5, color: color.text1 },
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
    lineHeight: 18,
    color: color.text1,
    minWidth: 26,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  tYou: { color: color.text1, fontFamily: font.bodyBold },

  cta: { marginTop: space.s6, marginBottom: space.s5 },

  sheet: {
    backgroundColor: '#0B120E',
    experimental_backgroundImage:
      'linear-gradient(180deg, #16231B 0%, #0B120E 52%, #070B08 100%)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: space.s5,
    paddingTop: space.s3,
    paddingBottom: space.s8,
  },
  sheetGrab: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: space.s4,
  },

  detail: { alignItems: 'center', gap: space.s2 },
  detailOverline: { ...text.key, fontSize: 9.5, color: color.text3 },
  detailOpp: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 32,
    color: color.text1,
  },
  detailScore: {
    paddingHorizontal: space.s5,
    paddingVertical: space.s2,
    borderRadius: radius.md,
    borderWidth: 1.5,
    marginTop: space.s1,
  },
  detailScoreText: {
    fontFamily: font.hero,
    fontSize: 40,
    lineHeight: 52,
    fontVariant: ['tabular-nums'],
  },
  detailScorers: { alignSelf: 'stretch', gap: space.s1, marginTop: space.s2 },
  detailScorer: { flexDirection: 'row', alignItems: 'baseline', gap: space.s3 },
  detailMin: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 16,
    color: color.accent,
    minWidth: 34,
    fontVariant: ['tabular-nums'],
  },
  detailName: { flex: 1, fontFamily: font.bodySemi, fontSize: 15, color: color.text1 },
  detailNone: { ...text.small, color: color.text3, marginTop: space.s2 },
  detailXg: { ...text.small, color: color.text3, marginTop: space.s2 },
  detailRule: {
    alignSelf: 'stretch',
    height: 2,
    borderRadius: 1,
    marginTop: space.s3,
    opacity: 0.5,
  },
});
