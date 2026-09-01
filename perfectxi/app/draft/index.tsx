import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  ModeScreen,
  Button,
  OptionGroup,
  Toggle,
  Surface,
  Pitch,
  Rise,
} from '../../src/ui/components';
import { color, space, radius, line } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { FORMATIONS, FORMATION_NAMES, defaultConfig, slotsFor } from '../../src/engine';
import type { DraftConfig, Difficulty, DraftMode, RatingType } from '../../src/engine';
import { startRun } from '../../src/game/run';

/**
 * Draft setup. Everything that changes the run is decided here and nothing
 * can change once the first board is on the table, which is what makes a
 * run replayable from its seed.
 *
 * Every choice shows what it does rather than only what it is called, and
 * the formation is shown as a shape on a pitch rather than as a number.
 */

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

/** The 1992 to 2026 span, cut where the eras actually changed. */
const ERAS = [
  { value: 'all', label: 'All eras', from: 1992, to: 2026 },
  { value: 'nineties', label: 'Nineties', from: 1992, to: 1999 },
  { value: 'y2k', label: '2000s', from: 2000, to: 2009 },
  { value: 'tens', label: '2010s', from: 2010, to: 2019 },
  { value: 'modern', label: 'Modern', from: 2020, to: 2026 },
] as const;

type EraKey = (typeof ERAS)[number]['value'];

export default function DraftSetup() {
  const [config, setConfig] = useState<DraftConfig>({ ...defaultConfig });
  const [era, setEra] = useState<EraKey>('all');

  const set = <K extends keyof DraftConfig>(key: K, value: DraftConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const fm = FORMATIONS[config.formation];
  const empty = useMemo(() => slotsFor(config.formation), [config.formation]);

  return (
    <ModeScreen overline="All-Time Premier League" title="Start a draft">
      <Rise delay={0}>
        <OptionGroup
          label="Formation"
          options={FORMATION_NAMES.map((n) => ({ value: n, label: n }))}
          value={config.formation}
          onChange={(v) => set('formation', v)}
        />

        <Text style={[text.small, styles.fmDesc]}>{fm?.desc}</Text>

        <View style={styles.traits}>
          <Trait label="Attack" value={fm?.att ?? 1} />
          <Trait label="Defence" value={fm?.def ?? 1} />
        </View>

        <View style={styles.preview}>
          <Pitch squad={empty} formation={config.formation} preview />
        </View>
      </Rise>

      <Rise delay={1}>
        <OptionGroup
          label="Game mode"
          options={MODES}
          value={config.mode}
          onChange={(v) => set('mode', v)}
        />

        {config.mode === 'squad' ? (
          <OptionGroup
            label="Era"
            options={ERAS.map((e) => ({ value: e.value, label: e.label }))}
            value={era}
            onChange={(v) => {
              const found = ERAS.find((e) => e.value === v)!;
              setEra(v);
              setConfig((c) => ({ ...c, eraFrom: found.from, eraTo: found.to }));
            }}
            hint={`Spins land between ${config.eraFrom} and ${config.eraTo}.`}
          />
        ) : null}

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

        <Surface style={styles.blitz}>
          <Toggle
            label="Blitz"
            hint="Only the top three of every board are offered."
            value={config.blitz}
            onChange={(v) => set('blitz', v)}
          />
        </Surface>
      </Rise>

      <Rise delay={2}>
        <Button
          label="Spin the first board"
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
 * What a formation actually costs you. The multipliers are real engine
 * inputs, so this is not decoration: 4-2-4 really does score more and
 * concede more.
 */
function Trait({ label, value }: { label: string; value: number }) {
  const up = value > 1.02;
  const down = value < 0.98;
  const tone = up ? color.accent : down ? color.danger : color.text3;
  const mark = up ? '▲' : down ? '▼' : '—';
  return (
    <View style={[styles.trait, { borderColor: tone + '55' }]}>
      <Text style={[styles.traitLabel, { color: color.text2 }]}>{label}</Text>
      <Text style={[styles.traitMark, { color: tone }]}>{mark}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fmDesc: { marginTop: -space.s3, marginBottom: space.s3 },
  traits: { flexDirection: 'row', gap: space.s2, marginBottom: space.s4 },
  trait: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  traitLabel: {
    ...text.key,
    fontSize: 10.5,
  },
  traitMark: { fontFamily: font.displayBold, fontSize: 12 },
  preview: { marginBottom: space.s5 },
  blitz: {
    paddingVertical: 0,
    marginBottom: space.s5,
    borderColor: line.card,
    borderWidth: 1,
  },
  go: { marginBottom: space.s4 },
});
