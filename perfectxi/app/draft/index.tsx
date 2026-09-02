import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import {
  ModeScreen,
  Button,
  OptionGroup,
  Toggle,
  Pitch,
  Rise,
  RangeSlider,
} from '../../src/ui/components';
import { color, space, radius, line, gradient } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { useReduceMotion } from '../../src/ui/feel';
import {
  FORMATIONS,
  FORMATION_NAMES,
  defaultConfig,
  eraSummary,
  seasonStr,
  slotsFor,
} from '../../src/engine';
import type { DraftConfig, Difficulty, DraftMode, RatingType } from '../../src/engine';
import { startRun } from '../../src/game/run';

const FIRST_YEAR = 1992;
const LAST_YEAR = 2026;

const MODES: readonly { value: DraftMode; label: string; desc: string }[] = [
  { value: 'squad', label: 'Squad draft', desc: 'Any club, any era' },
  { value: 'alltime', label: 'All Time XI', desc: 'Top 20 clubs, all eras merged' },
];

const DIFFS: readonly { value: Difficulty; label: string; desc: string }[] = [
  { value: 'easy', label: 'Easy', desc: '3 rerolls available' },
  { value: 'normal', label: 'Normal', desc: '1 reroll available' },
  { value: 'hard', label: 'Hard', desc: 'No rerolls, ratings hidden' },
];

const RATINGS: readonly { value: RatingType; label: string; desc: string }[] = [
  { value: 'prime', label: 'Prime', desc: 'Every player at their career best' },
  { value: 'season', label: 'That season', desc: 'Rated for the year you found them' },
];

/**
 * Draft setup.
 *
 * Everything that changes a run is decided here and nothing can change once
 * the first board is on the table, which is what makes a run replayable
 * from its seed.
 *
 * Same controls as the site, in the same order. The era is a two ended
 * range rather than a handful of presets, because that is what the site
 * has and because presets cannot say "the nineties and half the 2000s".
 * Underneath it, live, is what the range actually contains, which is the
 * only thing that tells you whether you have narrowed the draft to
 * something interesting or to four clubs.
 */
export default function DraftSetup() {
  const [config, setConfig] = useState<DraftConfig>({ ...defaultConfig });

  const set = <K extends keyof DraftConfig>(key: K, value: DraftConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const fm = FORMATIONS[config.formation];
  const empty = useMemo(() => slotsFor(config.formation), [config.formation]);
  const era = useMemo(
    () => eraSummary(config.eraFrom, config.eraTo),
    [config.eraFrom, config.eraTo],
  );

  const rerolls = config.diff === 'easy' ? 3 : config.diff === 'normal' ? 1 : 0;
  const hidden = config.diff === 'hard' || !config.showRatings;

  return (
    <ModeScreen overline="All-Time Premier League" title="Start a draft">
      <Rise delay={0}>
        <Text style={styles.lead}>
          Build your all-time XI, then simulate a full 38 game season.
        </Text>
      </Rise>

      <Rise delay={1}>
        <OptionGroup
          label="Formation"
          options={FORMATION_NAMES.map((n) => ({ value: n, label: n }))}
          value={config.formation}
          onChange={(v) => set('formation', v)}
        />

        <Text style={[text.small, styles.fmDesc]}>{fm?.desc}</Text>

        {/* The multipliers are real engine inputs, so this is not
            decoration: 4-2-4 really does score more and concede more. */}
        <View style={styles.traits}>
          <Trait label="Attack" value={fm?.att ?? 1} good />
          <Trait label="Defence" value={fm?.def ?? 1} />
        </View>

        <View style={styles.preview}>
          <Pitch squad={empty} formation={config.formation} preview />
        </View>
      </Rise>

      <Rise delay={2}>
        <OptionGroup
          label="Game mode"
          options={MODES}
          value={config.mode}
          onChange={(v) => set('mode', v)}
        />
      </Rise>

      {config.mode === 'squad' ? (
        <Rise delay={3}>
          <Text style={text.label}>Era</Text>
          <View style={styles.eraPanel}>
            <View style={styles.eraHead}>
              <Text style={styles.eraYear}>{seasonStr(config.eraFrom)}</Text>
              <Text style={styles.eraCount}>
                {era.clubs} clubs · {era.seasons} season
                {era.seasons === 1 ? '' : 's'}
              </Text>
              <Text style={styles.eraYear}>{seasonStr(config.eraTo)}</Text>
            </View>

            <RangeSlider
              min={FIRST_YEAR}
              max={LAST_YEAR}
              from={config.eraFrom}
              to={config.eraTo}
              onChange={(from, to) =>
                setConfig((c) => ({ ...c, eraFrom: from, eraTo: to }))
              }
            />

            <Text style={styles.eraNote}>
              {era.entries} club-seasons the wheel can land on.
            </Text>
          </View>
        </Rise>
      ) : null}

      <Rise delay={4}>
        <OptionGroup
          label="Difficulty"
          tone="gold"
          options={DIFFS}
          value={config.diff}
          onChange={(v) => set('diff', v)}
        />

        <OptionGroup
          label="Ratings"
          options={RATINGS}
          value={config.rtype}
          onChange={(v) => set('rtype', v)}
        />

        <View style={styles.toggles}>
          <Toggle
            label="Show ratings"
            hint={
              config.diff === 'hard'
                ? 'Hard hides them whatever this says.'
                : 'Turn off to draft on names alone.'
            }
            value={config.showRatings && config.diff !== 'hard'}
            onChange={(v) => set('showRatings', v)}
          />
          <Toggle
            label="Blitz"
            hint="Only the top three of every board are offered."
            value={config.blitz}
            onChange={(v) => set('blitz', v)}
          />
        </View>
      </Rise>

      <Rise delay={5}>
        {/* Everything chosen, in one line, so the last thing before the
            button is a summary rather than a scroll back up. */}
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {config.formation} · {config.mode === 'alltime' ? 'All Time XI' : 'Squad draft'} ·{' '}
            {rerolls} reroll{rerolls === 1 ? '' : 's'} · {config.rtype === 'prime' ? 'prime' : 'season'} ratings
            {hidden ? ' · hidden' : ''}
            {config.blitz ? ' · blitz' : ''}
          </Text>
        </View>

        <Button
          label="Start spinning"
          style={styles.go}
          onPress={() => {
            startRun(config);
            router.push('/draft/board');
          }}
        />
      </Rise>
    </ModeScreen>
  );
}

/**
 * What a formation costs you, as a filled meter rather than an arrow.
 *
 * An arrow says a direction. The multiplier runs from 0.78 to 1.28, and a
 * bar shows how far from neutral this shape actually is, which is the thing
 * you are choosing between.
 */
function Trait({
  label,
  value,
  good,
}: {
  label: string;
  value: number;
  good?: boolean;
}) {
  const reduce = useReduceMotion();
  const fill = useSharedValue(0);
  // 0.78 to 1.28 is the real span across the twelve formations.
  const fraction = Math.max(0.04, Math.min(1, (value - 0.75) / 0.56));
  const tint = value > 1.02 ? color.accent : value < 0.98 ? color.danger : color.text3;

  // Set in an effect, never during render. Writing a shared value while
  // rendering is how an animation ends up running twice.
  useEffect(() => {
    fill.value = withTiming(fraction, {
      duration: reduce ? 0 : 420,
      easing: Easing.out(Easing.cubic),
    });
  }, [fraction, fill, reduce]);

  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));

  return (
    <View style={styles.trait}>
      <View style={styles.traitHead}>
        <Text style={styles.traitLabel}>{label}</Text>
        <Text style={[styles.traitValue, { color: tint }]} allowFontScaling={false}>
          {value.toFixed(2)}
        </Text>
      </View>
      <View style={styles.traitTrack}>
        <Animated.View
          style={[
            styles.traitFill,
            barStyle,
            { backgroundColor: tint, boxShadow: `0px 0px 8px ${tint}88` },
          ]}
        />
      </View>
      <Text style={styles.traitHint}>
        {value > 1.02
          ? good
            ? 'scores more'
            : 'concedes less'
          : value < 0.98
            ? good
              ? 'scores less'
              : 'concedes more'
            : 'neutral'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: {
    ...text.body,
    color: color.text2,
    marginBottom: space.s5,
  },
  fmDesc: { marginTop: -space.s3, marginBottom: space.s3 },

  traits: { flexDirection: 'row', gap: space.s3, marginBottom: space.s4 },
  trait: {
    flex: 1,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    gap: 5,
  },
  traitHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  traitLabel: { ...text.key, fontSize: 9.5, color: color.text3 },
  traitValue: {
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  traitTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  traitFill: {
    height: 4,
    width: '100%',
    borderRadius: 2,
    alignSelf: 'flex-start',
    transformOrigin: 'left',
  },
  traitHint: { fontFamily: font.body, fontSize: 11, color: color.text3 },

  preview: { marginBottom: space.s5 },

  eraPanel: {
    marginTop: space.s2,
    marginBottom: space.s5,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  eraHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s2,
  },
  eraYear: {
    fontFamily: font.displayBold,
    fontSize: 16,
    lineHeight: 19,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  eraCount: {
    flex: 1,
    textAlign: 'center',
    ...text.key,
    fontSize: 9.5,
    color: color.accent,
    fontVariant: ['tabular-nums'],
  },
  eraNote: {
    ...text.small,
    color: color.text3,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  toggles: {
    marginBottom: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },

  summary: {
    alignItems: 'center',
    paddingVertical: space.s3,
    paddingHorizontal: space.s4,
    marginBottom: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  summaryText: {
    ...text.key,
    fontSize: 9.5,
    color: color.text2,
    textAlign: 'center',
    lineHeight: 15,
  },
  go: { marginBottom: space.s5 },
});
