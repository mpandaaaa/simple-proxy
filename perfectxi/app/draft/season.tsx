import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { router, Stack } from 'expo-router';
import {
  ModeScreen,
  Press,
  Ticker,
  Confirm,
  ClubDisc,
  MatchLive,
  Rise,
} from '../../src/ui/components';
import { color, space, radius, line, gradient } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { GRAIN_URI } from '../../src/ui/grain';
import { haptic, useReduceMotion } from '../../src/ui/feel';
import {
  SIM_LEAGUE,
  chemBonus,
  livePosition,
  ordinal,
  simulateSeason,
  squadAvg,
  type MatchResult,
} from '../../src/engine';
import { clearRun, runRng, setResult, useRun } from '../../src/game/run';

/** How fast auto sim runs through the fixtures it is not showing you. */
const AUTO_MS = 560;
/** The pause on the final whistle of the season before the papers arrive. */
const FINAL_HOLD = 800;

/* Match night, the same purple the live match is dressed in. */
const NIGHT = {
  hero:
    'radial-gradient(130% 100% at 50% 0%, rgba(233,0,82,0.22) 0%, rgba(55,0,60,0.62) 46%, #14031B 86%)',
  edge: 'rgba(233,0,82,0.30)',
  hot: '#FF2D78',
  play: 'linear-gradient(100deg, #E90052 0%, #FF2D78 100%)',
};

const OUTCOME = {
  win: { tint: color.win, letter: 'W', label: 'Win' },
  draw: { tint: color.draw, letter: 'D', label: 'Draw' },
  loss: { tint: color.loss, letter: 'L', label: 'Loss' },
} as const;

const STRENGTH: Record<string, number> = {};
for (const t of SIM_LEAGUE) STRENGTH[t.name] = t.str;

/**
 * The season, played one match at a time.
 *
 * This is the shape the site has and the shape I had missed: a hub you come
 * back to, with the fixture list running down it and a match you choose to
 * watch. A season that plays itself while you sit there is a progress bar
 * with football written on it.
 *
 * The whole season is decided the moment this screen opens, so nothing
 * pressed here changes a result. What is being chosen is how much of it you
 * want to see: every minute of every game, a score at a time, or none of it.
 */
export default function Season() {
  const run = useRun();
  const reduce = useReduceMotion();
  const [played, setPlayed] = useState(0);
  const [watching, setWatching] = useState<{ index: number; live: boolean } | null>(null);
  const [auto, setAuto] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progress = useSharedValue(0);

  // Played the moment the screen opens, in an effect rather than a memo: a
  // memo runs during render and this writes to the run store.
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

  useEffect(() => {
    if (!run) router.replace('/draft');
  }, [run]);

  const result = run?.result ?? null;
  const total = result ? result.matches.length : 38;
  const done = result !== null && played >= total;

  const avg = useMemo(() => (run ? Math.round(squadAvg(run.state.squad)) : 0), [run]);

  /* ---- the table as it stands ---- */
  const standing = useMemo(() => {
    const seen = result ? result.matches.slice(0, played) : [];
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
    return {
      w,
      d,
      l,
      gf,
      ga,
      pts,
      form: seen.slice(-6),
      pos: result ? livePosition(pts, played, result.table) : 20,
    };
  }, [result, played]);

  useEffect(() => {
    progress.value = withTiming(total ? played / total : 0, {
      duration: reduce ? 0 : 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [played, total, progress, reduce]);

  /* ---- auto sim ---- */
  const stopAuto = useCallback(() => {
    setAuto(false);
    if (autoTimer.current) {
      clearTimeout(autoTimer.current);
      autoTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (!auto || !result || done) return;
    autoTimer.current = setTimeout(() => {
      // Fired here rather than inside the updater: React may run an updater
      // more than once and a win would then buzz twice.
      const m = result.matches[played];
      haptic(m.oc === 'win' ? 'light' : m.oc === 'loss' ? 'warning' : 'select');
      setPlayed((n) => n + 1);
    }, AUTO_MS);
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
  }, [auto, result, played, done]);

  // The final whistle of the season, then the papers. Held back while a
  // match is still on screen so the last game is not cut off mid sentence.
  useEffect(() => {
    if (!done || watching) return;
    stopAuto();
    haptic('success');
    const t = setTimeout(() => router.replace('/draft/results'), FINAL_HOLD);
    return () => clearTimeout(t);
  }, [done, watching, stopAuto]);

  /* ---- what the buttons do ---- */
  const playNext = useCallback(() => {
    if (!result || done) return;
    stopAuto();
    setWatching({ index: played, live: true });
  }, [result, done, played, stopAuto]);

  const rewatch = useCallback(
    (index: number) => {
      stopAuto();
      setWatching({ index, live: false });
    },
    [stopAuto],
  );

  const closeMatch = useCallback(() => {
    const live = watching?.live;
    setWatching(null);
    if (live) setPlayed((n) => n + 1);
  }, [watching]);

  const simRest = useCallback(() => {
    stopAuto();
    haptic('medium');
    setPlayed(total);
  }, [total, stopAuto]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  if (!run || !result) return null;

  const next: MatchResult | null = done ? null : result.matches[played];

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />

      <ModeScreen
        overline="Premier League"
        title="Season"
        onBack={() => {
          stopAuto();
          setLeaving(true);
        }}
      >
        {/* ---- the club, and how far through ---- */}
        <View style={styles.hero}>
          <View style={styles.heroBloom} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              <Defs>
                <RadialGradient id="seasonBloom" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={NIGHT.hot} stopOpacity={0.3} />
                  <Stop offset="1" stopColor={NIGHT.hot} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Ellipse cx="50" cy="2" rx="64" ry="48" fill="url(#seasonBloom)" />
            </Svg>
          </View>
          <View style={styles.grain} pointerEvents="none">
            <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.fill} />
          </View>
          <View style={styles.heroEdge} pointerEvents="none" />

          <ClubDisc club={null} code="XI" size={54} />
          <Text style={styles.heroName}>Your XI</Text>
          <Text style={styles.heroMeta}>
            Squad rating {avg} {'·'} {run.state.config.formation}
          </Text>

          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, barStyle]} />
          </View>
          <Text style={styles.heroProg}>
            {done ? 'Season complete' : `Matchday ${played + 1} of ${total}`}
            {played > 0 ? ` · ${ordinal(standing.pos)} in the table` : ''}
          </Text>
        </View>

        {/* ---- the season so far ---- */}
        <View style={styles.statRow}>
          <Stat label="W" value={standing.w} tint={color.win} />
          <Stat label="D" value={standing.d} tint={color.draw} />
          <Stat label="L" value={standing.l} tint={color.loss} />
          <Stat label="GF" value={standing.gf} />
          <Stat label="GA" value={standing.ga} />
          <Stat label="Pts" value={standing.pts} tint={NIGHT.hot} big />
        </View>

        {standing.form.length ? (
          <View style={styles.form}>
            <Text style={styles.formKey}>Form</Text>
            <View style={styles.formRow}>
              {standing.form.map((m) => (
                <View
                  key={m.n}
                  style={[
                    styles.formPip,
                    {
                      borderColor: OUTCOME[m.oc].tint + '66',
                      backgroundColor: OUTCOME[m.oc].tint + '1F',
                    },
                  ]}
                >
                  <Text
                    style={[styles.formLetter, { color: OUTCOME[m.oc].tint }]}
                    allowFontScaling={false}
                  >
                    {OUTCOME[m.oc].letter}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ---- the next match, and the ways past it ---- */}
        {next ? (
          <Rise delay={0}>
            <View style={styles.nextCard}>
              <Text style={styles.nextKey}>
                Next {'·'} Matchday {next.n} {'·'} {next.home ? 'Home' : 'Away'}
              </Text>
              <View style={styles.nextRow}>
                <ClubDisc club={next.opp} size={44} />
                <View style={styles.nextInfo}>
                  <Text style={styles.nextName} numberOfLines={1}>
                    {next.opp}
                  </Text>
                  <Strength value={STRENGTH[next.opp] ?? 0.5} />
                </View>
              </View>

              <Press onPress={playNext} feel="medium" style={styles.play} scaleTo={0.98}>
                <Text style={styles.playText}>Play the match</Text>
              </Press>

              <View style={styles.subRow}>
                <Press
                  onPress={() => {
                    haptic('light');
                    setAuto((a) => !a);
                  }}
                  feel="none"
                  style={[styles.sub, auto ? styles.subOn : null]}
                  scaleTo={0.97}
                >
                  <Text style={[styles.subText, auto ? { color: NIGHT.hot } : null]}>
                    {auto ? 'Stop auto sim' : 'Auto sim'}
                  </Text>
                </Press>
                <Press onPress={simRest} feel="none" style={styles.sub} scaleTo={0.97}>
                  <Text style={styles.subText}>Sim to end</Text>
                </Press>
              </View>
            </View>
          </Rise>
        ) : null}

        {/* ---- all thirty eight ---- */}
        <Text style={[text.label, styles.sect]}>Fixtures</Text>
        <View style={styles.fixtures}>
          {result.matches.map((m, i) => (
            <Fixture
              key={m.n}
              match={m}
              state={i < played ? 'played' : i === played ? 'next' : 'later'}
              onPress={i < played ? () => rewatch(i) : i === played ? playNext : undefined}
            />
          ))}
        </View>
      </ModeScreen>

      <MatchLive
        match={watching ? result.matches[watching.index] : null}
        seed={run.seed}
        live={watching?.live ?? false}
        visible={watching !== null}
        onDone={closeMatch}
      />

      <Confirm
        visible={leaving}
        title="Leave the season?"
        body="This XI and everything it has done so far will be gone. The draft starts again from the beginning."
        confirmLabel="Leave"
        onCancel={() => setLeaving(false)}
        onConfirm={() => {
          setLeaving(false);
          clearRun();
          router.dismissAll();
        }}
      />
    </>
  );
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
        duration={340}
        style={[styles.statValue, big ? styles.statValueBig : null, tint ? { color: tint } : null]}
      />
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/**
 * How good the club you are about to play is, as five bars.
 *
 * The engine already knows: every club in the league has a strength and it
 * is the number the match is decided with. Showing it turns a fixture list
 * into a run of games with easy weeks and hard ones in it.
 */
function Strength({ value }: { value: number }) {
  const lit = Math.max(1, Math.min(5, Math.round(((value - 0.25) / 0.68) * 5)));
  const tint =
    lit >= 5 ? color.danger : lit >= 4 ? color.warning : lit >= 3 ? color.gold : color.text3;
  return (
    <View style={styles.strength}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={[
            styles.strengthBar,
            {
              height: 5 + i * 2,
              backgroundColor: i < lit ? tint : 'rgba(255,255,255,0.10)',
            },
          ]}
        />
      ))}
    </View>
  );
}

/** One line of the fixture list. */
function Fixture({
  match,
  state,
  onPress,
}: {
  match: MatchResult;
  state: 'played' | 'next' | 'later';
  onPress?: () => void;
}) {
  const oc = OUTCOME[match.oc];
  const body = (
    <>
      <ClubDisc club={match.opp} size={34} />
      <View style={styles.fxInfo}>
        <Text style={styles.fxKey}>
          Matchday {match.n} {'·'} {match.home ? 'Home' : 'Away'}
        </Text>
        <Text style={styles.fxName} numberOfLines={1}>
          {match.opp}
        </Text>
        {state === 'played' ? (
          <Text style={styles.fxHint}>Watch it back</Text>
        ) : (
          <Strength value={STRENGTH[match.opp] ?? 0.5} />
        )}
      </View>

      {state === 'played' ? (
        <View style={styles.fxRes}>
          <Text style={[styles.fxScore, { color: oc.tint }]} allowFontScaling={false}>
            {match.gf}
            {'–'}
            {match.ga}
          </Text>
          <Text style={[styles.fxOc, { color: oc.tint }]}>{oc.label}</Text>
        </View>
      ) : state === 'next' ? (
        <View style={styles.fxPlay}>
          <Text style={styles.fxPlayText}>Play</Text>
        </View>
      ) : (
        <Text style={styles.fxDash} allowFontScaling={false}>
          {'–'}
        </Text>
      )}
    </>
  );

  const style = [
    styles.fx,
    state === 'next' ? styles.fxNext : null,
    state === 'later' ? styles.fxLater : null,
    state === 'played' ? { borderColor: OUTCOME[match.oc].tint + '3D' } : null,
  ];

  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Press onPress={onPress} feel="light" style={style} scaleTo={0.985}>
      {body}
    </Press>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  grain: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05 },

  /* hero */
  hero: {
    alignItems: 'center',
    paddingTop: space.s5,
    paddingHorizontal: space.s4,
    paddingBottom: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: NIGHT.edge,
    backgroundColor: '#14031B',
    experimental_backgroundImage: NIGHT.hero,
    boxShadow: '0px 14px 34px rgba(0,0,0,0.5)',
    overflow: 'hidden',
    marginBottom: space.s4,
  },
  heroBloom: { position: 'absolute', top: -30, left: -30, right: -30, height: 180 },
  heroEdge: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroName: {
    fontFamily: font.displayBlack,
    fontSize: 34,
    lineHeight: 43,
    letterSpacing: 0.4,
    color: '#FFFFFF',
    marginTop: space.s2,
  },
  heroMeta: { ...text.small, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  progressTrack: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginTop: space.s4,
  },
  progressFill: {
    height: 6,
    width: '100%',
    borderRadius: 3,
    alignSelf: 'flex-start',
    transformOrigin: 'left',
    backgroundColor: NIGHT.hot,
    experimental_backgroundImage: 'linear-gradient(90deg, #E90052 0%, #FF2D78 100%)',
    boxShadow: `0px 0px 10px ${NIGHT.hot}AA`,
  },
  heroProg: {
    ...text.key,
    fontSize: 10,
    color: NIGHT.hot,
    marginTop: space.s3,
    textAlign: 'center',
  },

  /* the season so far */
  statRow: {
    flexDirection: 'row',
    paddingVertical: space.s3,
    paddingHorizontal: space.s2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: {
    fontFamily: font.displayBold,
    fontSize: 19,
    lineHeight: 23,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  statValueBig: { fontSize: 23, lineHeight: 27 },
  statLabel: { ...text.key, fontSize: 8.5, color: color.text3 },

  form: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    marginTop: space.s3,
    paddingHorizontal: space.s1,
  },
  formKey: { ...text.key, fontSize: 9, color: color.text3 },
  formRow: { flexDirection: 'row', gap: 6 },
  formPip: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formLetter: { fontFamily: font.displayBold, fontSize: 13, lineHeight: 16 },

  /* next match */
  nextCard: {
    marginTop: space.s5,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: NIGHT.edge,
    backgroundColor: '#150A18',
    experimental_backgroundImage:
      'linear-gradient(180deg, #221029 0%, #140A18 70%, #0E0712 100%)',
    boxShadow: '0px 10px 26px rgba(0,0,0,0.45)',
    gap: space.s3,
  },
  nextKey: { ...text.key, fontSize: 9.5, color: NIGHT.hot },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  nextInfo: { flex: 1, gap: 5 },
  nextName: {
    fontFamily: font.displayBold,
    fontSize: 22,
    lineHeight: 26,
    color: color.text1,
  },
  play: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: '#E90052',
    experimental_backgroundImage: NIGHT.play,
    boxShadow: '0px 8px 22px rgba(233,0,82,0.36), inset 0px 1px 0px rgba(255,255,255,0.22)',
  },
  playText: { ...text.button, color: '#FFFFFF' },
  subRow: { flexDirection: 'row', gap: space.s3 },
  sub: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  subOn: { borderColor: NIGHT.edge, backgroundColor: 'rgba(233,0,82,0.12)' },
  subText: {
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: 0.4,
    color: color.text2,
  },

  /* fixtures */
  sect: { marginTop: space.s6, marginBottom: space.s3 },
  fixtures: { gap: space.s2, paddingBottom: space.s5 },
  fx: {
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
  fxNext: {
    borderColor: NIGHT.edge,
    backgroundColor: '#170B1B',
    experimental_backgroundImage: 'linear-gradient(180deg, #24122B 0%, #150A19 100%)',
    boxShadow: '0px 0px 18px rgba(233,0,82,0.20)',
  },
  fxLater: { opacity: 0.52 },
  fxInfo: { flex: 1, gap: 2 },
  fxKey: { ...text.key, fontSize: 8.5, color: color.text3 },
  fxName: { fontFamily: font.displayBold, fontSize: 17, lineHeight: 20, color: color.text1 },
  fxHint: { ...text.small, fontSize: 11, color: color.text3 },
  fxRes: { alignItems: 'flex-end' },
  fxScore: {
    fontFamily: font.displayBlack,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  fxOc: { ...text.key, fontSize: 8.5 },
  fxPlay: {
    paddingHorizontal: space.s4,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: '#E90052',
    experimental_backgroundImage: NIGHT.play,
    boxShadow: 'inset 0px 1px 0px rgba(255,255,255,0.24)',
  },
  fxPlayText: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  fxDash: {
    fontFamily: font.displayBold,
    fontSize: 18,
    lineHeight: 22,
    color: color.text3,
    paddingRight: space.s2,
  },

  strength: { flexDirection: 'row', alignItems: 'flex-end', gap: 2.5, height: 13 },
  strengthBar: { width: 4, borderRadius: 1.5 },
});
