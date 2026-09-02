import { useEffect } from 'react';
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
import { router } from 'expo-router';
import {
  ModeScreen,
  Button,
  Ticker,
  Rise,
  ClubDisc,
} from '../../src/ui/components';
import { color, space, radius, line, gradient, positionColor } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { GRAIN_URI } from '../../src/ui/grain';
import { useReduceMotion } from '../../src/ui/feel';
import {
  calcOdds,
  chemBonus,
  ordinal,
  squadAvg,
  squadChem,
  type Position,
  type Slot,
} from '../../src/engine';
import { useRun } from '../../src/game/run';

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

/**
 * The payoff for the draft.
 *
 * Same anatomy as the site: the hero with your overall, the three
 * predictions, the star man, the season outlook, then the XI written out by
 * line. The odds are the site's own curves, tuned against the same strength
 * scale the match engine uses, so the projection and the season it is
 * projecting agree with each other.
 *
 * It is a screen of its own rather than a state of the draft board, which
 * is how the site has it, and it means arriving here is a real transition
 * rather than the pitch quietly turning into something else.
 */
export default function SquadComplete() {
  const run = useRun();

  useEffect(() => {
    if (!run) router.replace('/draft');
  }, [run]);

  if (!run) return null;

  const { squad, config } = run.state;
  const avg = squadAvg(squad);
  const chem = squadChem(squad);
  const bonus = chemBonus(squad);
  const odds = calcOdds(avg, bonus);
  const overall = Math.round(avg);
  const hideRatings = config.diff === 'hard';

  // The best player in the side, and the slot he is standing in.
  let star: Slot | null = null;
  for (const s of squad) {
    if (s.player && (!star || s.player.rtg > star.player!.rtg)) star = s;
  }

  return (
    <ModeScreen
      overline="Squad complete"
      title="Your XI"
      right={
        <View style={styles.fmPill}>
          <Text style={styles.fmText}>{config.formation}</Text>
        </View>
      }
    >
      <Rise delay={0}>
        <Hero overall={overall} chem={chem} bonus={bonus} />
      </Rise>

      <Rise delay={1}>
        <View style={styles.chips}>
          <Chip value={ordinal(odds.projFinish)} label="Proj finish" />
          <Chip value={String(odds.expPts)} label="Exp points" numeric />
          <Chip value={`${odds.winPct}%`} label="Title odds" tint={color.gold} />
        </View>
      </Rise>

      {star?.player ? (
        <Rise delay={2}>
          <StarMan slot={star} hideRatings={hideRatings} />
        </Rise>
      ) : null}

      <Rise delay={3}>
        <Text style={styles.sectionTitle}>Season outlook</Text>
        <View style={styles.outlook}>
          {OUTLOOK.map((o, i) => (
            <OddsRow
              key={o.key}
              label={o.label}
              pct={odds[o.key]}
              tint={o.tint}
              delay={i}
            />
          ))}
          <Text style={styles.outlookNote}>
            What an overall of {overall} should produce. Simulate to see if you
            beat it.
          </Text>
        </View>
      </Rise>

      <Rise delay={4}>
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

      <Rise delay={5}>
        <Button
          label="Simulate the season"
          style={styles.cta}
          onPress={() => router.push('/draft/season')}
        />
      </Rise>
    </ModeScreen>
  );
}

/**
 * The overall, made the largest thing on the screen.
 *
 * Everything about the draft resolves to this one number, so it gets the
 * hero face at seventy two points, a gold bloom behind it, and nothing
 * else competing for the middle of the card.
 */
function Hero({
  overall,
  chem,
  bonus,
}: {
  overall: number;
  chem: number;
  bonus: number;
}) {
  const reduce = useReduceMotion();
  const pop = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) return;
    pop.value = withDelay(
      120,
      withSpring(1, { stiffness: 170, damping: 13, mass: 1 }),
    );
  }, [pop, reduce]);

  const ratingStyle = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: 0.7 + pop.value * 0.3 }],
  }));

  return (
    <View style={styles.hero}>
      <View style={styles.heroOrbs} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="scGold" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={color.gold} stopOpacity={0.3} />
              <Stop offset="1" stopColor={color.gold} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="scGreen" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={color.accent} stopOpacity={0.16} />
              <Stop offset="1" stopColor={color.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50" cy="46" rx="46" ry="40" fill="url(#scGold)" />
          <Ellipse cx="12" cy="94" rx="44" ry="36" fill="url(#scGreen)" />
        </Svg>
      </View>
      <View style={styles.grain} pointerEvents="none">
        <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.grainImage} />
      </View>
      <View style={styles.heroEdge} pointerEvents="none" />

      <View style={styles.heroBadge}>
        <Text style={styles.heroBadgeText}>Squad assembled</Text>
      </View>

      <Animated.View style={[styles.heroRating, ratingStyle]}>
        <Ticker value={overall} style={styles.heroValue} duration={900} />
      </Animated.View>
      <Text style={styles.heroLabel}>Overall</Text>

      <View style={styles.heroChem}>
        <Text style={styles.heroChemText}>
          Chemistry {chem}%
          {bonus > 0 ? `  ·  worth +${bonus.toFixed(2)} to your rating` : ''}
        </Text>
      </View>
    </View>
  );
}

function Chip({
  value,
  label,
  tint,
  numeric,
}: {
  value: string;
  label: string;
  tint?: string;
  numeric?: boolean;
}) {
  return (
    <View style={styles.chip}>
      {numeric ? (
        <Ticker value={Number(value)} style={[styles.chipValue, tint ? { color: tint } : null]} />
      ) : (
        <Text
          style={[styles.chipValue, tint ? { color: tint } : null]}
          allowFontScaling={false}
        >
          {value}
        </Text>
      )}
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

function StarMan({ slot, hideRatings }: { slot: Slot; hideRatings: boolean }) {
  const p = slot.player!;
  const tint = positionColor[slot.pos];
  return (
    <View style={styles.star}>
      <View
        style={[styles.starWash, {
          experimental_backgroundImage: `linear-gradient(120deg, rgba(214,178,94,0.20) 0%, rgba(0,0,0,0) 62%)`,
        }]}
        pointerEvents="none"
      />
      <ClubDisc club={p.club} size={48} square />
      <View style={styles.starBody}>
        <Text style={styles.starLabel}>Star man</Text>
        <Text style={styles.starName} numberOfLines={1}>
          {p.n}
        </Text>
        <Text style={styles.starSub} numberOfLines={1}>
          {p.club}  ·  {p.season}
        </Text>
      </View>
      <View style={[styles.starRating, { borderColor: tint + '77', backgroundColor: tint + '1f' }]}>
        <Text style={[styles.starRatingText, { color: hideRatings ? color.text3 : tint }]}>
          {hideRatings ? '?' : p.rtg}
        </Text>
      </View>
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

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: fill.value }],
  }));

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

const styles = StyleSheet.create({
  fmPill: {
    paddingHorizontal: space.s3,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  fmText: {
    ...text.key,
    fontSize: 10.5,
    color: color.text2,
    fontVariant: ['tabular-nums'],
  },

  hero: {
    alignItems: 'center',
    paddingVertical: space.s6,
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
  heroRating: { marginTop: space.s3 },
  heroValue: {
    fontFamily: font.hero,
    fontSize: 76,
    lineHeight: 99,
    color: color.text1,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(214,178,94,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  heroLabel: { ...text.key, fontSize: 10, color: color.text3, marginTop: -space.s2 },
  heroChem: { marginTop: space.s4 },
  heroChemText: {
    fontFamily: font.bodyMed,
    fontSize: 12.5,
    color: color.text2,
    textAlign: 'center',
  },

  chips: { flexDirection: 'row', gap: space.s3, marginTop: space.s3 },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.s3 + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow: 'inset 0px 1px 0px rgba(255,255,255,0.05)',
  },
  chipValue: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 29,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  chipLabel: { ...text.key, fontSize: 8.5, color: color.text3, marginTop: 2 },

  star: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    marginTop: space.s3,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.4)',
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.cardLift,
    boxShadow: '0px 10px 24px rgba(0,0,0,0.45)',
    overflow: 'hidden',
  },
  starWash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  starBody: { flex: 1, minWidth: 0 },
  starLabel: { ...text.key, fontSize: 9.5, color: color.gold },
  starName: {
    fontFamily: font.displayBlack,
    fontSize: 22,
    lineHeight: 27,
    color: color.text1,
    marginTop: 1,
  },
  starSub: { fontFamily: font.body, fontSize: 12, color: color.text3 },
  starRating: {
    minWidth: 52,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starRatingText: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 29,
    fontVariant: ['tabular-nums'],
  },

  sectionTitle: {
    ...text.label,
    fontSize: 12.5,
    color: color.text2,
    marginTop: space.s6,
    marginBottom: space.s2,
  },
  outlook: {
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    gap: space.s3,
  },
  oddsRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  oddsLabel: {
    fontFamily: font.bodyMed,
    fontSize: 13,
    color: color.text2,
    width: 76,
  },
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
  outlookNote: {
    ...text.small,
    color: color.text3,
    marginTop: space.s1,
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
