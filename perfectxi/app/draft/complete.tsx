import { useEffect, useState } from 'react';
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
  Ticker,
  Rise,
  ClubDisc,
  Pitch,
  Confirm,
  Shine,
} from '../../src/ui/components';
import { color, space, radius, line, gradient, positionColor } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { GRAIN_URI } from '../../src/ui/grain';
import { useReduceMotion } from '../../src/ui/feel';
import {
  calcOdds,
  chemBonus,
  chemistryLinks,
  eraOf,
  ordinal,
  ratingsHidden,
  squadAvg,
  squadChem,
  strongerThan,
  verdictFor,
  type Position,
  type Slot,
} from '../../src/engine';
import { clearRun, useRequireRun } from '../../src/game/run';

const LINES: { key: Position; title: string }[] = [
  { key: 'GK', title: 'Goalkeeper' },
  { key: 'DEF', title: 'Defence' },
  { key: 'MID', title: 'Midfield' },
  { key: 'ATT', title: 'Attack' },
];

const OUTLOOK = [
  { key: 'top4', label: 'Top 4', tint: color.accent },
  { key: 'top6', label: 'Top 6', tint: color.blue },
  { key: 'top10', label: 'Top 10', tint: color.purple },
  { key: 'rel', label: 'Relegation', tint: color.danger },
] as const;

const ERAS = [
  { key: 'nineties', label: '90s', tint: '#E0A868' },
  { key: 'y2k', label: '00s', tint: '#8FB3D9' },
  { key: 'tens', label: '10s', tint: '#B98CF2' },
  { key: 'modern', label: '20s', tint: '#1FC57E' },
] as const;

/**
 * The payoff for the draft.
 *
 * The site's anatomy is all here: the overall, the three predictions, the
 * star man, the season outlook, the XI by line. What it adds is the things
 * the site had the data for and never said.
 *
 * The XI is shown as the shape you actually built, not only as a list. The
 * overall gets a verdict, so 89 means "title favourites" rather than being
 * a number you have to interpret. Chemistry is broken into the clubs,
 * seasons and countries it came from, which turns it from a score you are
 * handed into something you can draft towards. The eras are counted, because a side
 * pulled from four decades is a different achievement to one from four
 * seasons. And the strength is put against the nineteen clubs you will
 * actually face, which is the way a football fan asks the question.
 */
export default function SquadComplete() {
  const run = useRequireRun();
  const [leaving, setLeaving] = useState(false);


  if (!run) return null;

  const { squad, config } = run.state;
  const avg = squadAvg(squad);
  const chem = squadChem(squad);
  const bonus = chemBonus(squad);
  const odds = calcOdds(avg, bonus);
  const overall = Math.round(avg);
  const hideRatings = ratingsHidden(config);
  const links = chemistryLinks(squad);
  const beats = strongerThan(avg, bonus);

  // The best and the worst of it. One is a boast, the other is the thing
  // you will blame in April.
  let star: Slot | null = null;
  let weak: Slot | null = null;
  for (const s of squad) {
    if (!s.player) continue;
    if (!star || s.player.rtg > star.player!.rtg) star = s;
    if (!weak || s.player.rtg < weak.player!.rtg) weak = s;
  }

  const eras = ERAS.map((e) => ({
    ...e,
    n: squad.filter((s) => s.player && eraOf(s.player.season).key === e.key).length,
  })).filter((e) => e.n > 0);

  return (
    <>
      {/* The edge swipe would go round the warning, so it is off here. */}
      <Stack.Screen options={{ gestureEnabled: false }} />
    <ModeScreen
      overline="Squad complete"
      title="Your XI"
      // Leaving throws the XI away, so it asks first. The board was
      // replaced by this screen, so there is no draft to go back to.
      onBack={() => setLeaving(true)}
      right={
        <View style={styles.fmPill}>
          <Text style={styles.fmText}>{config.formation}</Text>
        </View>
      }
    >
      <Rise delay={0}>
        <Hero
          overall={overall}
          verdict={verdictFor(odds.projFinish)}
          beats={beats}
        />
      </Rise>

      <Rise delay={1}>
        <View style={styles.chips}>
          <Chip value={ordinal(odds.projFinish)} label="Proj finish" />
          <Chip value={odds.expPts} label="Exp points" numeric />
          <Chip value={`${odds.winPct}%`} label="Title odds" tint={color.gold} />
        </View>
      </Rise>

      {/* The shape you built, not just the names in it. */}
      <Rise delay={2}>
        <View style={styles.pitchWrap}>
          <Pitch squad={squad} formation={config.formation} />
        </View>
      </Rise>

      <Rise delay={3}>
        <View style={styles.pair}>
          {star?.player ? (
            <Marker slot={star} kind="star" hideRatings={hideRatings} />
          ) : null}
          {weak?.player && weak !== star ? (
            <Marker slot={weak} kind="weak" hideRatings={hideRatings} />
          ) : null}
        </View>
      </Rise>

      <Rise delay={4}>
        <Text style={styles.sectionTitle}>Chemistry</Text>
        <View style={styles.panel}>
          <View style={styles.chemHead}>
            <Ticker value={chem} style={styles.chemValue} />
            <Text style={styles.chemPct}>%</Text>
            <Text style={styles.chemWorth}>
              {bonus > 0
                ? `worth +${bonus.toFixed(2)} to your rating`
                : 'no shared clubs, seasons or countries'}
            </Text>
          </View>

          {links.clubs.length || links.seasons.length || links.nations.length ? (
            <>
              {/* Ordered by what each link is actually worth, so the chips
                  read in the same order the maths values them. */}
              <View style={styles.chemLinks}>
                {links.clubs.slice(0, 3).map((l) => (
                  <View key={`c${l.name}`} style={styles.chemChip}>
                    <Text style={styles.chemChipN}>{l.count}</Text>
                    <Text style={styles.chemChipL} numberOfLines={1}>
                      {l.name}
                    </Text>
                  </View>
                ))}
                {links.seasons.slice(0, 2).map((l) => (
                  <View key={`s${l.name}`} style={[styles.chemChip, styles.chemChipSeason]}>
                    <Text style={styles.chemChipN}>{l.count}</Text>
                    <Text style={styles.chemChipL} numberOfLines={1}>
                      {l.name}
                    </Text>
                  </View>
                ))}
                {links.nations.slice(0, 3).map((l) => (
                  <View key={`n${l.name}`} style={[styles.chemChip, styles.chemChipNation]}>
                    <Text style={styles.chemChipN}>{l.count}</Text>
                    <Text style={styles.chemChipL} numberOfLines={1}>
                      {l.name}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.chemKey}>
                Club counts most, then season, then nationality.
              </Text>
            </>
          ) : (
            <Text style={styles.chemNone}>
              Eleven strangers. Draft from one club, one season or one country
              and they will play like they know each other.
            </Text>
          )}
        </View>
      </Rise>

      {eras.length ? (
        <Rise delay={5}>
          <Text style={styles.sectionTitle}>Eras</Text>
          <View style={styles.panel}>
            <View style={styles.eraBar}>
              {eras.map((e) => (
                <View
                  key={e.key}
                  style={[
                    styles.eraSeg,
                    { flex: e.n, backgroundColor: e.tint },
                  ]}
                />
              ))}
            </View>
            <View style={styles.eraKeys}>
              {eras.map((e) => (
                <View key={e.key} style={styles.eraKey}>
                  <View style={[styles.eraDot, { backgroundColor: e.tint }]} />
                  <Text style={styles.eraKeyText}>
                    {e.n} from the {e.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Rise>
      ) : null}

      <Rise delay={6}>
        <Text style={styles.sectionTitle}>Season outlook</Text>
        <View style={styles.panel}>
          {OUTLOOK.map((o, i) => (
            <OddsRow key={o.key} label={o.label} pct={odds[o.key]} tint={o.tint} delay={i} />
          ))}
          <Text style={styles.note}>
            What an overall of {overall} should produce. Simulate to see if you
            beat it.
          </Text>
        </View>
      </Rise>

      <Rise delay={7}>
        {LINES.map((ln) => {
          const members = squad.filter((s) => s.player && s.pos === ln.key);
          if (!members.length) return null;
          const tint = positionColor[ln.key];
          return (
            <View key={ln.key}>
              <View style={styles.lineHead}>
                <View style={[styles.lineBar, { backgroundColor: tint }]} />
                <Text style={styles.lineTitle}>{ln.title}</Text>
              </View>
              {members.map((s, i) => (
                <PlayerLine
                  key={s.player!.n + i}
                  slot={s}
                  tint={tint}
                  hideRatings={hideRatings}
                />
              ))}
            </View>
          );
        })}
      </Rise>

      <Rise delay={8}>
        <Button
          label="Simulate the season"
          style={styles.cta}
          onPress={() => router.push('/draft/season')}
        />
      </Rise>

      <Confirm
        visible={leaving}
        title="Leave this draft?"
        body="Your XI will be lost and the draft reset. This cannot be undone."
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

/**
 * The overall, made the largest thing on the screen, and told what it means.
 *
 * The bloom behind the number is a drawn radial rather than a text shadow.
 * A shadow at that radius renders as a lit rectangle around the glyphs,
 * which is what was putting a faint box behind the 89.
 */
function Hero({
  overall,
  verdict,
  beats,
}: {
  overall: number;
  verdict: string;
  beats: number;
}) {
  const reduce = useReduceMotion();
  const pop = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) return;
    pop.value = withDelay(120, withSpring(1, { stiffness: 170, damping: 13, mass: 1 }));
  }, [pop, reduce]);

  const ratingStyle = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: 0.7 + pop.value * 0.3 }],
  }));
  const bloomStyle = useAnimatedStyle(() => ({ opacity: pop.value }));

  return (
    <View style={styles.hero}>
      <View style={styles.heroOrbs} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="scGreen" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={color.accent} stopOpacity={0.14} />
              <Stop offset="1" stopColor={color.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx="12" cy="96" rx="46" ry="38" fill="url(#scGreen)" />
        </Svg>
      </View>
      <View style={styles.grain} pointerEvents="none">
        <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.grainImage} />
      </View>
      <Shine radius={26} group="feature" bevel={false} clip={false} />
      <View style={styles.heroEdge} pointerEvents="none" />

      <View style={styles.heroBadge}>
        <Text style={styles.heroBadgeText}>Squad assembled</Text>
      </View>

      <View style={styles.heroNumber}>
        <Animated.View style={[styles.heroBloom, bloomStyle]} pointerEvents="none">
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="scGold" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={color.gold} stopOpacity={0.42} />
                <Stop offset="0.55" stopColor={color.gold} stopOpacity={0.1} />
                <Stop offset="1" stopColor={color.gold} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx="50" cy="50" rx="50" ry="50" fill="url(#scGold)" />
          </Svg>
        </Animated.View>
        <Animated.View style={ratingStyle}>
          <Ticker value={overall} style={styles.heroValue} duration={900} />
        </Animated.View>
      </View>

      <Text style={styles.heroLabel}>Overall</Text>
      <Text style={styles.heroVerdict}>{verdict}</Text>
      <Text style={styles.heroBeats}>
        Stronger than {beats} of the 19 clubs you will face
      </Text>
    </View>
  );
}

function Chip({
  value,
  label,
  tint,
  numeric,
}: {
  value: string | number;
  label: string;
  tint?: string;
  numeric?: boolean;
}) {
  return (
    <View style={styles.chip}>
      {numeric ? (
        <Ticker value={Number(value)} style={[styles.chipValue, tint ? { color: tint } : null]} />
      ) : (
        <Text style={[styles.chipValue, tint ? { color: tint } : null]} allowFontScaling={false}>
          {value}
        </Text>
      )}
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

/** The best player in the side, and the one you will worry about. */
function Marker({
  slot,
  kind,
  hideRatings,
}: {
  slot: Slot;
  kind: 'star' | 'weak';
  hideRatings: boolean;
}) {
  const p = slot.player!;
  const tint = positionColor[slot.pos];
  const accent = kind === 'star' ? color.gold : color.text3;
  return (
    <View style={[styles.marker, kind === 'star' && styles.markerStar]}>
      <View style={styles.markerTop}>
        <ClubDisc club={p.club} size={34} square />
        <Text style={[styles.markerLabel, { color: accent }]}>
          {kind === 'star' ? 'Star man' : 'Weak link'}
        </Text>
      </View>
      <Text style={styles.markerName} numberOfLines={1}>
        {p.n}
      </Text>
      <Text style={styles.markerSub} numberOfLines={1}>
        {p.club} · {p.season}
      </Text>
      <Text
        style={[styles.markerRating, { color: hideRatings ? color.text3 : tint }]}
        allowFontScaling={false}
      >
        {hideRatings ? '?' : p.rtg}
      </Text>
    </View>
  );
}

function OddsRow({
  label,
  pct,
  tint,
  delay,
}: {
  label: string;
  pct: number;
  tint: string;
  delay: number;
}) {
  const reduce = useReduceMotion();
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = withDelay(
      reduce ? 0 : 200 + delay * 90,
      withTiming(Math.min(1, pct / 100), {
        duration: reduce ? 0 : 780,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [pct, fill, delay, reduce]);

  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));

  return (
    <View style={styles.oddsRow}>
      <Text style={styles.oddsLabel}>{label}</Text>
      <View style={styles.oddsTrack}>
        <Animated.View
          style={[
            styles.oddsFill,
            barStyle,
            { backgroundColor: tint, boxShadow: `0px 0px 10px ${tint}88` },
          ]}
        />
      </View>
      <Text style={[styles.oddsPct, { color: tint }]} allowFontScaling={false}>
        {pct}%
      </Text>
    </View>
  );
}

function PlayerLine({
  slot,
  tint,
  hideRatings,
}: {
  slot: Slot;
  tint: string;
  hideRatings: boolean;
}) {
  const p = slot.player!;
  return (
    <View style={[styles.playerRow, { borderLeftColor: tint }]}>
      <View style={[styles.posChip, { backgroundColor: tint + '22', borderColor: tint + '66' }]}>
        <Text style={[styles.posChipText, { color: tint }]}>{slot.pos}</Text>
      </View>
      <View style={styles.playerBody}>
        <Text style={styles.playerName} numberOfLines={1}>
          {p.n}
        </Text>
        <Text style={styles.playerSub} numberOfLines={1}>
          {p.club}  ·  {p.season}
        </Text>
      </View>
      <Text
        style={[styles.playerRating, { color: hideRatings ? color.text3 : tint }]}
        allowFontScaling={false}
      >
        {hideRatings ? '?' : p.rtg}
      </Text>
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
  fmPill: {
    paddingHorizontal: space.s3,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  fmText: { ...text.key, fontSize: 10.5, color: color.text2, fontVariant: ['tabular-nums'] },

  hero: {
    alignItems: 'center',
    paddingVertical: space.s5,
    paddingHorizontal: space.s5,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.34)',
    backgroundColor: '#0D1611',
    experimental_backgroundImage:
      'linear-gradient(180deg, #17231C 0%, #0C120E 60%, #080C09 100%)',
    boxShadow:
      '0px 20px 44px rgba(0,0,0,0.55), inset 0px 1px 0px rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  heroOrbs: { position: 'absolute', top: -30, left: -30, right: -30, bottom: -30 },
  grain: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.04 },
  grainImage: { width: '100%', height: '100%' },
  heroEdge: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroBadge: {
    paddingHorizontal: space.s4,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.5)',
    backgroundColor: 'rgba(214,178,94,0.14)',
  },
  heroBadgeText: { ...text.key, fontSize: 10, color: color.gold },

  heroNumber: { alignItems: 'center', justifyContent: 'center', marginTop: space.s2 },
  heroBloom: { position: 'absolute', width: 240, height: 240, top: -62 },
  heroValue: {
    fontFamily: font.hero,
    fontSize: 76,
    lineHeight: 99,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  heroLabel: { ...text.key, fontSize: 10, color: color.text3, marginTop: -space.s3 },
  heroVerdict: {
    fontFamily: font.displayBlack,
    fontSize: 23,
    lineHeight: 28,
    color: color.gold,
    marginTop: space.s3,
    textAlign: 'center',
  },
  heroBeats: {
    fontFamily: font.bodyMed,
    fontSize: 12.5,
    color: color.text2,
    marginTop: space.s1,
    textAlign: 'center',
  },

  chips: { flexDirection: 'row', gap: space.s3, marginTop: space.s3 },
  chip: {
    ...PANEL,
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.s3 + 2,
    borderRadius: radius.md,
  },
  chipValue: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 29,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  chipLabel: { ...text.key, fontSize: 8.5, color: color.text3, marginTop: 2 },

  pitchWrap: { marginTop: space.s4 },

  pair: { flexDirection: 'row', gap: space.s3, marginTop: space.s4 },
  marker: {
    ...PANEL,
    flex: 1,
    padding: space.s3 + 2,
    gap: 2,
  },
  markerStar: { borderColor: 'rgba(214,178,94,0.4)' },
  markerTop: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  markerLabel: { ...text.key, fontSize: 9 },
  markerName: {
    fontFamily: font.displayBold,
    fontSize: 17,
    lineHeight: 21,
    color: color.text1,
    marginTop: space.s2,
  },
  markerSub: { fontFamily: font.body, fontSize: 11, color: color.text3 },
  markerRating: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 32,
    fontVariant: ['tabular-nums'],
    marginTop: space.s1,
  },

  sectionTitle: {
    ...text.label,
    fontSize: 12.5,
    color: color.text2,
    marginTop: space.s6,
    marginBottom: space.s2,
  },
  panel: { ...PANEL, padding: space.s4, gap: space.s3 },
  note: { ...text.small, color: color.text3, marginTop: space.s1 },

  chemHead: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  chemValue: {
    fontFamily: font.hero,
    fontSize: 34,
    lineHeight: 44,
    color: color.accent,
    fontVariant: ['tabular-nums'],
  },
  chemPct: { fontFamily: font.displayBold, fontSize: 17, lineHeight: 21, color: color.accent },
  chemWorth: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 12.5,
    color: color.text3,
    textAlign: 'right',
  },
  chemLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  chemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.s3,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: line.accent,
    backgroundColor: 'rgba(31,197,126,0.12)',
  },
  chemChipSeason: {
    borderColor: 'rgba(185,140,242,0.4)',
    backgroundColor: 'rgba(185,140,242,0.12)',
  },
  chemChipNation: {
    borderColor: 'rgba(76,160,255,0.4)',
    backgroundColor: 'rgba(76,160,255,0.12)',
  },
  chemKey: { ...text.small, fontSize: 11.5, color: color.text3 },
  chemChipN: {
    fontFamily: font.displayBlack,
    fontSize: 13,
    lineHeight: 16,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  chemChipL: { fontFamily: font.bodyMed, fontSize: 12, color: color.text2 },
  chemNone: { ...text.small, color: color.text3 },

  eraBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  eraSeg: { height: 10 },
  eraKeys: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s3 },
  eraKey: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eraDot: { width: 7, height: 7, borderRadius: 4 },
  eraKeyText: { fontFamily: font.body, fontSize: 12, color: color.text2 },

  oddsRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  oddsLabel: { fontFamily: font.bodyMed, fontSize: 13, color: color.text2, width: 76 },
  oddsTrack: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  oddsFill: {
    height: 7,
    width: '100%',
    borderRadius: 4,
    alignSelf: 'flex-start',
    transformOrigin: 'left',
  },
  oddsPct: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 17,
    width: 46,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  lineHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    marginTop: space.s5,
    marginBottom: space.s2,
  },
  lineBar: { width: 3, height: 14, borderRadius: 2 },
  lineTitle: { ...text.label, fontSize: 12, color: color.text2 },

  playerRow: {
    ...PANEL,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    marginBottom: space.s2,
    paddingVertical: space.s2 + 2,
    paddingHorizontal: space.s3,
    borderRadius: radius.md,
    borderLeftWidth: 3,
  },
  posChip: {
    width: 42,
    height: 28,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posChipText: { ...text.key, fontSize: 9.5 },
  playerBody: { flex: 1, minWidth: 0 },
  playerName: {
    fontFamily: font.bodyBold,
    fontSize: 15.5,
    lineHeight: 20,
    color: color.text1,
  },
  playerSub: { fontFamily: font.body, fontSize: 11.5, color: color.text3 },
  playerRating: {
    fontFamily: font.displayBlack,
    fontSize: 20,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
    minWidth: 30,
    textAlign: 'right',
  },

  cta: { marginTop: space.s6, marginBottom: space.s5 },
});
