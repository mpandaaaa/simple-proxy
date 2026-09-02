import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { router, Stack } from 'expo-router';
import { ModeScreen, Press, Shine, ClubDisc, Ticker } from '../../src/ui/components';
import { color, gradient, line, radius, space } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic, useReduceMotion } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import {
  asSquad,
  chemBonus,
  livePosition,
  mulberry32,
  ordinal,
  simulateSeason,
  starters,
  type MatchResult,
  type SeasonResult,
} from '../../src/engine';
import { useCareer, updateCareer } from '../../src/game/career';
import { setSeasonResult } from '../../src/game/careerSeason';

/** A normal week. */
const TICK = 300;
/** A derby, or anything in the last five, gets held on. */
const BIG = 900;

/**
 * A Dynasty season, played out.
 *
 * The result is decided the moment this screen opens. Revealing it a week
 * at a time is theatre, but it is the theatre the season is for: you watch
 * the table move, and the app slows down for the games that matter, which
 * are the derby and anything in the run in.
 */
export default function DynastySeason() {
  const career = useCareer();
  const reduce = useReduceMotion();
  const [shown, setShown] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progress = useSharedValue(0);

  const result: SeasonResult | null = useMemo(() => {
    if (!career) return null;
    const xi = starters(career);
    if (xi.length < 11) return null;
    const rnd = mulberry32((career.seed ^ Math.imul(career.year, 0x9e3779b1)) >>> 0);
    const squad = asSquad(xi);
    return simulateSeason(squad, career.tactic.form, chemBonus(squad), rnd);
  }, [career]);

  const total = result ? result.matches.length : 38;
  const done = result !== null && shown >= total;

  const isBig = useCallback(
    (m: MatchResult, i: number) =>
      (career?.rival != null && m.opp === career.rival) || i >= total - 5,
    [career, total],
  );

  useEffect(() => {
    if (!career) router.replace('/dynasty');
  }, [career]);

  useEffect(() => {
    if (!result || reduce) {
      if (result && reduce) setShown(total);
      return;
    }
    if (shown >= total) return;
    const m = result.matches[shown];
    timer.current = setTimeout(
      () => {
        haptic(m.oc === 'win' ? 'light' : m.oc === 'loss' ? 'warning' : 'select');
        if (isBig(m, shown)) sfx(m.oc === 'win' ? 'goal' : m.oc === 'loss' ? 'against' : 'tick');
        setShown((n) => n + 1);
      },
      shown > 0 && isBig(result.matches[shown - 1], shown - 1) ? BIG : TICK,
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [result, shown, total, reduce, isBig]);

  useEffect(() => {
    progress.value = withTiming(total ? shown / total : 0, {
      duration: reduce ? 0 : 240,
      easing: Easing.out(Easing.quad),
    });
  }, [shown, total, progress, reduce]);

  // Banked the moment the last whistle goes, so leaving cannot lose it.
  const banked = useRef(false);
  useEffect(() => {
    if (!done || !result || banked.current) return;
    banked.current = true;
    haptic(result.position === 1 ? 'success' : 'medium');
    sfx(result.position === 1 ? 'trophy' : result.position <= 4 ? 'win' : 'ft');
    setSeasonResult(result);
    updateCareer((d) => ({
      ...d,
      seasons: [
        ...d.seasons,
        {
          s: d.year,
          fin: result.position,
          pts: result.pts,
          w: result.wins,
          d: result.draws,
          l: result.losses,
          gf: result.gf,
          ga: result.ga,
          met: result.position <= d.objective.target,
          rev: 0,
          profit: 0,
          ded: 0,
        },
      ],
    }));
  }, [done, result]);

  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  if (!career || !result) return null;

  const seen = result.matches.slice(0, shown);
  let w = 0;
  let d = 0;
  let l = 0;
  let gf = 0;
  let ga = 0;
  for (const m of seen) {
    gf += m.gf;
    ga += m.ga;
    if (m.oc === 'win') w++;
    else if (m.oc === 'draw') d++;
    else l++;
  }
  const pts = w * 3 + d;
  const pos = livePosition(pts, shown, result.table);
  const met = pos <= career.objective.target;

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <ModeScreen
        overline={done ? 'Full time' : `Matchday ${Math.min(shown + 1, total)} of ${total}`}
        title={career.club}
        onBack={() => router.replace('/dynasty')}
        right={
          done ? undefined : (
            <Press
              onPress={() => {
                if (timer.current) clearTimeout(timer.current);
                haptic('medium');
                setShown(total);
              }}
              feel="none"
              scaleTo={0.94}
              style={styles.skip}
            >
              <Text style={styles.skipText}>Skip</Text>
            </Press>
          )
        }
      >
        {/* ---- where you are ---- */}
        <View style={styles.standing}>
          <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
          <Text style={styles.standKey}>Position</Text>
          <View style={styles.standRow}>
            <Ticker
              value={shown ? pos : 20}
              from={20}
              duration={420}
              style={[styles.standPos, { color: posTint(pos) }]}
            />
            <Text style={[styles.standOrd, { color: posTint(pos) }]} allowFontScaling={false}>
              {shown ? ordinal(pos).replace(String(pos), '') : ''}
            </Text>
          </View>
          <Text style={[styles.standObj, met ? { color: color.accent } : null]}>
            {career.objective.label}
            {shown ? (met ? ' · on course' : ' · not yet') : ''}
          </Text>

          <View style={styles.bar}>
            <Animated.View style={[styles.barFill, barStyle]} />
          </View>

          <View style={styles.stats}>
            <Stat label="W" value={w} tint={color.win} />
            <Stat label="D" value={d} tint={color.draw} />
            <Stat label="L" value={l} tint={color.loss} />
            <Stat label="GF" value={gf} />
            <Stat label="GA" value={ga} />
            <Stat label="Pts" value={pts} big />
          </View>
        </View>

        {done ? (
          <Press
            onPress={() => {
              haptic('medium');
              router.replace('/dynasty/summer');
            }}
            feel="none"
            style={styles.cta}
            scaleTo={0.98}
          >
            <Text style={styles.ctaText}>The summer</Text>
          </Press>
        ) : null}

        {/* ---- the season, newest first ---- */}
        <Text style={[text.label, styles.sect]}>Results</Text>
        <View style={styles.feed}>
          {[...seen].reverse().map((m) => {
            const big = career.rival != null && m.opp === career.rival;
            return (
              <View
                key={m.n}
                style={[
                  styles.match,
                  big ? { borderColor: color.gold + '59' } : null,
                ]}
              >
                <Text style={styles.matchNo} allowFontScaling={false}>
                  {m.n}
                </Text>
                <ClubDisc club={m.opp} size={26} />
                <View style={styles.matchBody}>
                  <Text style={styles.matchOpp} numberOfLines={1}>
                    {m.opp}
                  </Text>
                  <Text style={styles.matchWhere}>
                    {m.home ? 'Home' : 'Away'}
                    {big ? ' · the derby' : ''}
                  </Text>
                </View>
                <Text
                  style={[styles.matchScore, { color: ocTint(m.oc) }]}
                  allowFontScaling={false}
                >
                  {m.gf}
                  {'–'}
                  {m.ga}
                </Text>
              </View>
            );
          })}
        </View>
      </ModeScreen>
    </>
  );
}

function posTint(pos: number): string {
  if (pos === 1) return color.gold;
  if (pos <= 4) return color.blue;
  if (pos <= 7) return color.accent;
  if (pos >= 18) return color.danger;
  return color.text1;
}

function ocTint(oc: string): string {
  return oc === 'win' ? color.win : oc === 'draw' ? color.draw : color.loss;
}

function Stat({
  label,
  value,
  tint,
  big,
}: {
  label: string;
  value: number;
  tint?: string;
  big?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Ticker
        value={value}
        from={0}
        blank="0"
        duration={300}
        style={[styles.statValue, big ? styles.statBig : null, tint ? { color: tint } : null]}
      />
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  skip: {
    paddingHorizontal: space.s3,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: line.card,
  },
  skipText: { ...text.key, fontSize: 10, color: color.text2 },

  standing: {
    alignItems: 'center',
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#0C1510',
    experimental_backgroundImage:
      'linear-gradient(180deg, #16281F 0%, #0D1712 62%, #080D0A 100%)',
    overflow: 'hidden',
  },
  standKey: { ...text.key, fontSize: 9, color: color.text3 },
  standRow: { flexDirection: 'row', alignItems: 'flex-start' },
  standPos: {
    fontFamily: font.hero,
    fontSize: 64,
    lineHeight: 84,
    fontVariant: ['tabular-nums'],
  },
  standOrd: {
    fontFamily: font.displayBlack,
    fontSize: 20,
    lineHeight: 34,
    marginLeft: 2,
  },
  standObj: { ...text.key, fontSize: 9.5, color: color.text3, marginTop: -space.s2 },
  bar: {
    alignSelf: 'stretch',
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
    marginTop: space.s4,
  },
  barFill: {
    height: 5,
    width: '100%',
    borderRadius: 3,
    alignSelf: 'flex-start',
    transformOrigin: 'left',
    backgroundColor: color.accent,
  },
  stats: { flexDirection: 'row', alignSelf: 'stretch', marginTop: space.s4 },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statValue: {
    fontFamily: font.displayBold,
    fontSize: 18,
    lineHeight: 22,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  statBig: { fontSize: 22, lineHeight: 27 },
  statLabel: { ...text.key, fontSize: 8, color: color.text3 },

  cta: {
    marginTop: space.s4,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: 'rgba(214,178,94,0.12)',
  },
  ctaText: { ...text.button, color: color.gold },

  sect: { marginTop: space.s6, marginBottom: space.s3 },
  feed: { gap: space.s2, paddingBottom: space.s6 },
  match: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  matchNo: {
    width: 20,
    textAlign: 'right',
    fontFamily: font.displayBold,
    fontSize: 12,
    lineHeight: 16,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  matchBody: { flex: 1, minWidth: 0 },
  matchOpp: { fontFamily: font.bodySemi, fontSize: 14, lineHeight: 19, color: color.text1 },
  matchWhere: { fontFamily: font.body, fontSize: 10.5, lineHeight: 14, color: color.text3 },
  matchScore: {
    fontFamily: font.displayBold,
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
});
