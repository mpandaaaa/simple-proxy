import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Stack } from 'expo-router';
import { swap } from '../../src/game/nav';
import {
  ModeScreen,
  Press,
  Rise,
  Shine,
  ClubDisc,
  Ticker,
  MatchLive,
} from '../../src/ui/components';
import {
  color,
  gradient,
  line,
  radius,
  space,
  hue,
  wear,
  alpha,
  vivid,
  deepen,
  readable,
} from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic, useReduceMotion } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import {
  leagueFor,
  clubColour,
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

/** How fast auto sim runs through the fixtures it is not showing you. */
const AUTO_MS = 520;

const OUTCOME = {
  win: { tint: color.win, letter: 'W', label: 'Win' },
  draw: { tint: color.draw, letter: 'D', label: 'Draw' },
  loss: { tint: color.loss, letter: 'L', label: 'Loss' },
} as const;

/* Built per club, because the club you manage is not in your own league
   and a promoted side has taken its place. */
function strengthOf(
  club: string | null,
  league: readonly { name: string; str: number; var: number }[] | null,
  opp: string,
): number {
  for (const t of leagueFor(club, league)) if (t.name === opp) return t.str;
  return 0.5;
}

/**
 * A Dynasty season, played one match at a time.
 *
 * The same shape as the draft's season, because it is the same thing: a
 * fixture list you come back to and a match you choose to watch. What is
 * different is that these are your players, so the run in matters and the
 * derby is marked.
 *
 * The whole season is decided the moment this screen opens. What you are
 * choosing is how much of it you want to see.
 */
export default function DynastySeason() {
  const career = useCareer();
  const reduce = useReduceMotion();
  const [played, setPlayed] = useState(0);
  const [watching, setWatching] = useState<{ index: number; live: boolean } | null>(null);
  const [auto, setAuto] = useState(false);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progress = useSharedValue(0);
  const banked = useRef(false);

  const result: SeasonResult | null = useMemo(() => {
    if (!career) return null;
    const xi = starters(career);
    if (xi.length < 11) return null;
    const rnd = mulberry32((career.seed ^ Math.imul(career.year, 0x9e3779b1)) >>> 0);
    const squad = asSquad(xi);
    return simulateSeason(squad, career.tactic.form, chemBonus(squad), rnd, career.club, career.league);
  }, [career?.seed, career?.year]);

  const total = result ? result.matches.length : 38;
  const done = result !== null && played >= total;

  useEffect(() => {
    if (!career) swap('/dynasty');
  }, [career]);

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
      duration: reduce ? 0 : 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [played, total, progress, reduce]);

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
      const m = result.matches[played];
      haptic(m.oc === 'win' ? 'light' : m.oc === 'loss' ? 'warning' : 'select');
      setPlayed((n) => n + 1);
    }, AUTO_MS);
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
  }, [auto, result, played, done]);

  // Banked the moment the last whistle goes, so leaving cannot lose it.
  useEffect(() => {
    if (!done || !result || banked.current || watching) return;
    banked.current = true;
    stopAuto();
    haptic(result.position === 1 ? 'success' : 'medium');
    sfx(result.position === 1 ? 'trophy' : result.position <= 4 ? 'win' : 'ft');
    setSeasonResult(result);
    updateCareer((d) => ({
      ...d,
      seasons: d.seasons.some((s) => s.s === d.year)
        ? d.seasons
        : [
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
  }, [done, result, watching, stopAuto]);

  const playNext = useCallback(() => {
    if (!result || done) return;
    stopAuto();
    setWatching({ index: played, live: true });
  }, [result, done, played, stopAuto]);

  const closeMatch = useCallback(() => {
    const live = watching?.live;
    setWatching(null);
    if (live) setPlayed((n) => n + 1);
  }, [watching]);

  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  if (!career || !result) return null;
  const next: MatchResult | null = done ? null : result.matches[played];
  const met = standing.pos <= career.objective.target;
  const z = zone(played ? standing.pos : 20);
  const skin = wear(z.tint);
  const oppSkin = next ? wear(clubColour(next.opp)) : null;

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <ModeScreen
        wide
        overline={done ? 'Full time' : `Matchday ${played + 1} of ${total}`}
        title={career.club}
        onBack={() => swap('/dynasty')}
      >
        {/* ---- where you are ---- */}
        <View
          style={[
            styles.standing,
            {
              borderColor: skin.lineSoft,
              experimental_backgroundImage: skin.grad,
            },
          ]}
        >
          <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
          <View style={[styles.zoneChip, { borderColor: skin.line, backgroundColor: skin.wash }]}>
            <Text style={[styles.zoneText, { color: skin.key }]}>{z.name}</Text>
          </View>
          <View style={styles.standRow}>
            <Ticker
              value={played ? standing.pos : 20}
              from={20}
              duration={420}
              style={[styles.standPos, { color: skin.key }]}
            />
            <Text style={[styles.standOrd, { color: skin.key }]} allowFontScaling={false}>
              {played ? ordinal(standing.pos).replace(String(standing.pos), '') : ''}
            </Text>
          </View>
          <Text
            style={[
              styles.standObj,
              played ? { color: met ? hue.emerald : hue.amber } : null,
            ]}
          >
            {career.objective.label}
            {played ? (met ? ' · on course' : ' · not yet') : ''}
          </Text>

          <View style={styles.bar}>
            <Animated.View
              style={[
                styles.barFill,
                barStyle,
                {
                  backgroundColor: skin.key,
                  experimental_backgroundImage: `linear-gradient(90deg, ${alpha(skin.key, 0.55)} 0%, ${skin.key} 100%)`,
                },
              ]}
            />
          </View>

          <View style={styles.stats}>
            <Stat label="W" value={standing.w} tint={hue.emerald} />
            <Stat label="D" value={standing.d} tint={hue.amber} />
            <Stat label="L" value={standing.l} tint={hue.crimson} />
            <Stat label="GF" value={standing.gf} tint={hue.rose} />
            <Stat label="GA" value={standing.ga} tint={hue.sky} />
            <Stat label="Pts" value={standing.pts} tint={hue.gold} big />
          </View>
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

        {/* ---- the next match ---- */}
        {next ? (
          <Rise delay={0}>
            <View
              style={[
                styles.nextCard,
                oppSkin
                  ? {
                      borderColor: oppSkin.line,
                      experimental_backgroundImage: oppSkin.grad,
                      boxShadow: oppSkin.glow,
                    }
                  : null,
              ]}
            >
              <Shine radius={radius.lg} group="feature" bevel={false} clip={false} />
              <Text style={[styles.nextKey, oppSkin ? { color: vivid(oppSkin.key) } : null]}>
                Next {'·'} Matchday {next.n} {'·'} {next.home ? 'Home' : 'Away'}
                {career.rival === next.opp ? ' · the derby' : ''}
              </Text>
              <View style={styles.nextRow}>
                <ClubDisc club={next.opp} size={44} />
                <View style={styles.nextInfo}>
                  <Text style={styles.nextName} numberOfLines={1}>
                    {next.opp}
                  </Text>
                  <Strength value={strengthOf(career.club, career.league, next.opp)} />
                </View>
              </View>

              <Press
                onPress={playNext}
                feel="medium"
                style={[styles.play, kitButton(next.opp)]}
                scaleTo={0.98}
              >
                <Text style={[styles.playText, { color: readable(vivid(clubColour(next.opp))) }]}>
                  Watch the match
                </Text>
              </Press>

              <View style={styles.subRow}>
                <Press
                  onPress={() => {
                    haptic('light');
                    setAuto((a) => !a);
                  }}
                  feel="none"
                  style={[styles.sub, styles.subSky, auto ? styles.subOn : null]}
                  scaleTo={0.97}
                >
                  <Text style={[styles.subText, { color: auto ? hue.emerald : hue.sky }]}>
                    {auto ? 'Stop auto sim' : 'Auto sim'}
                  </Text>
                </Press>
                <Press
                  onPress={() => {
                    stopAuto();
                    haptic('medium');
                    setPlayed(total);
                  }}
                  feel="none"
                  style={[styles.sub, styles.subAmber]}
                  scaleTo={0.97}
                >
                  <Text style={[styles.subText, { color: hue.amber }]}>Sim to end</Text>
                </Press>
              </View>
            </View>
          </Rise>
        ) : (
          <Press
            onPress={() => {
              haptic('medium');
              swap('/dynasty/summer');
            }}
            feel="none"
            style={styles.cta}
            scaleTo={0.98}
          >
            <Text style={styles.ctaText}>The season review</Text>
          </Press>
        )}

        {/* ---- all thirty eight ---- */}
        <Text style={[text.label, styles.sect]}>Fixtures</Text>
        {played ? (
          <Text style={styles.sectNote}>Tap a played match to watch it back.</Text>
        ) : null}
        <View style={styles.fixtures}>
          {result.matches.map((m, i) => (
            <Fixture
              key={m.n}
              match={m}
              club={career.club}
              league={career.league}
              derby={career.rival === m.opp}
              state={i < played ? 'played' : i === played ? 'next' : 'later'}
              onPress={
                i < played
                  ? () => {
                      haptic('light');
                      stopAuto();
                      setWatching({ index: i, live: false });
                    }
                  : i === played
                    ? playNext
                    : undefined
              }
            />
          ))}
        </View>
      </ModeScreen>

      <MatchLive
        match={watching ? result.matches[watching.index] : null}
        seed={career.seed ^ career.year}
        live={watching?.live ?? false}
        visible={watching !== null}
        onDone={closeMatch}
      />
    </>
  );
}

/**
 * The league in four colours.
 *
 * The top card wears where you are, so the screen itself changes colour
 * across a season: gold champions, blue Europe, green the pack, red the
 * drop. It tells you the table before you have read a number.
 */
function zone(pos: number): { tint: string; name: string } {
  if (pos === 1) return { tint: hue.gold, name: 'Champions' };
  if (pos <= 4) return { tint: hue.sky, name: 'Champions League' };
  if (pos <= 7) return { tint: hue.emerald, name: 'Europe' };
  if (pos >= 18) return { tint: hue.crimson, name: 'Relegation' };
  if (pos >= 15) return { tint: hue.amber, name: 'Near the drop' };
  return { tint: hue.indigo, name: 'Mid table' };
}

/** The primary action, painted in the colours of whoever you are facing. */
function kitButton(opp: string) {
  const base = vivid(clubColour(opp));
  return {
    backgroundColor: base,
    experimental_backgroundImage: `linear-gradient(140deg, ${base} 0%, ${deepen(base, 0.28)} 100%)`,
    boxShadow: `0px 8px 22px ${alpha(base, 0.30)}, inset 0px 1px 0px rgba(255,255,255,0.22)`,
  } as const;
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
            { height: 5 + i * 2, backgroundColor: i < lit ? tint : 'rgba(255,255,255,0.10)' },
          ]}
        />
      ))}
    </View>
  );
}

function Fixture({
  match,
  state,
  derby,
  club,
  league,
  onPress,
}: {
  match: MatchResult;
  state: 'played' | 'next' | 'later';
  derby: boolean;
  club: string;
  league: readonly { name: string; str: number; var: number }[];
  onPress?: () => void;
}) {
  const oc = OUTCOME[match.oc];
  const body = (
    <>
      <ClubDisc club={match.opp} size={34} />
      <View style={styles.fxInfo}>
        <Text style={styles.fxKey}>
          Matchday {match.n} {'·'} {match.home ? 'Home' : 'Away'}
          {derby ? ' · derby' : ''}
        </Text>
        <Text style={styles.fxName} numberOfLines={1}>
          {match.opp}
        </Text>
        {state === 'played' ? (
          <Text style={styles.fxHint}>Watch it back</Text>
        ) : (
          <Strength value={strengthOf(club, league, match.opp)} />
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
        <View style={[styles.fxPlay, { backgroundColor: vivid(clubColour(match.opp)) }]}>
          <Text
            style={[styles.fxPlayText, { color: readable(vivid(clubColour(match.opp))) }]}
          >
            Play
          </Text>
        </View>
      ) : (
        <Text style={styles.fxDash} allowFontScaling={false}>
          {'–'}
        </Text>
      )}
    </>
  );

  const kit = clubColour(match.opp);
  const style = [
    styles.fx,
    state === 'next'
      ? [
          styles.fxNext,
          { borderColor: alpha(kit, 0.5), boxShadow: `0px 0px 18px ${alpha(kit, 0.18)}` },
        ]
      : null,
    state === 'later' ? styles.fxLater : null,
    derby && state !== 'later' ? { borderColor: color.gold + '59' } : null,
    state === 'played' ? { borderColor: oc.tint + '3D' } : null,
  ];

  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Press onPress={onPress} feel="light" style={style} scaleTo={0.985}>
      {body}
    </Press>
  );
}

const styles = StyleSheet.create({
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
  zoneChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginBottom: 2,
  },
  zoneText: { ...text.key, fontSize: 9 },
  standRow: { flexDirection: 'row', alignItems: 'flex-start' },
  standPos: {
    fontFamily: font.hero,
    fontSize: 64,
    lineHeight: 84,
    fontVariant: ['tabular-nums'],
  },
  standOrd: { fontFamily: font.displayBlack, fontSize: 20, lineHeight: 34, marginLeft: 2 },
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

  nextCard: {
    marginTop: space.s5,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.accent,
    backgroundColor: '#0C1510',
    experimental_backgroundImage: 'linear-gradient(180deg, #17291F 0%, #0C1611 100%)',
    overflow: 'hidden',
    gap: space.s3,
  },
  nextKey: { ...text.key, fontSize: 9.5, color: color.accent },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  nextInfo: { flex: 1, gap: 5 },
  nextName: {
    fontFamily: font.displayBold,
    fontSize: 22,
    lineHeight: 27,
    color: color.text1,
  },
  play: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: color.accent,
    experimental_backgroundImage: 'linear-gradient(140deg, #22D287 0%, #12A866 100%)',
    boxShadow: '0px 8px 22px rgba(31,197,126,0.3), inset 0px 1px 0px rgba(255,255,255,0.22)',
  },
  playText: { ...text.button, color: '#05170E' },
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
  subSky: { borderColor: alpha(hue.sky, 0.34), backgroundColor: alpha(hue.sky, 0.10) },
  subAmber: { borderColor: alpha(hue.amber, 0.34), backgroundColor: alpha(hue.amber, 0.10) },
  subOn: { borderColor: line.accent, backgroundColor: 'rgba(31,197,126,0.12)' },
  subText: {
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 19,
    letterSpacing: 0.4,
    color: color.text2,
  },

  cta: {
    marginTop: space.s5,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: 'rgba(214,178,94,0.12)',
  },
  ctaText: { ...text.button, color: color.gold },

  sect: { marginTop: space.s6, marginBottom: space.s2 },
  sectNote: { ...text.small, fontSize: 11.5, marginBottom: space.s3 },
  fixtures: { gap: space.s2, paddingBottom: space.s6 },
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
    boxShadow:
      'inset 0px 1px 0px rgba(255,255,255,0.06), inset 0px 0px 0px 1px rgba(255,255,255,0.035)',
  },
  fxNext: {
    borderColor: line.accent,
    backgroundColor: '#0E1B14',
    boxShadow: '0px 0px 18px rgba(31,197,126,0.18)',
  },
  fxLater: { opacity: 0.52 },
  fxInfo: { flex: 1, gap: 2 },
  fxKey: { ...text.key, fontSize: 8.5, color: color.text3 },
  fxName: { fontFamily: font.displayBold, fontSize: 17, lineHeight: 21, color: color.text1 },
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
    backgroundColor: color.accent,
    boxShadow: 'inset 0px 1px 0px rgba(255,255,255,0.24)',
  },
  fxPlayText: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#05170E',
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
