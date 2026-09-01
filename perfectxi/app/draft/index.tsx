import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ModeScreen, Button, Choice, Toggle, Surface } from '../../src/ui/components';
import { color, space, radius } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { FORMATIONS, FORMATION_NAMES, defaultConfig } from '../../src/engine';
import type { DraftConfig, Difficulty, DraftMode, RatingType } from '../../src/engine';
import { startRun } from '../../src/game/run';

/**
 * Draft setup. Everything that changes the run is decided here and nothing
 * can change once the first board is on the table, which is what makes a
 * run replayable from its seed.
 */

const MODES: readonly { value: DraftMode; label: string }[] = [
  { value: 'squad', label: 'Squad draft' },
  { value: 'alltime', label: 'All Time XI' },
];

const DIFFS: readonly { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

const RATINGS: readonly { value: RatingType; label: string }[] = [
  { value: 'prime', label: 'Prime' },
  { value: 'season', label: 'That season' },
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
  const rerolls = config.diff === 'easy' ? 3 : config.diff === 'normal' ? 1 : 0;

  return (
    <ModeScreen overline="All-Time Premier League" title="Start a draft">
      <Choice
        label="Formation"
        options={FORMATION_NAMES.map((n) => ({ value: n, label: n }))}
        value={config.formation}
        onChange={(v) => set('formation', v)}
        hint={fm?.desc}
      />

      <Choice
        label="Mode"
        options={MODES}
        value={config.mode}
        onChange={(v) => set('mode', v)}
        hint={
          config.mode === 'alltime'
            ? 'Pick from one club’s entire history, every season pooled together.'
            : 'Every spin lands on a real club from a real season.'
        }
      />

      {config.mode === 'squad' ? (
        <Choice
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

      <Choice
        label="Difficulty"
        options={DIFFS}
        value={config.diff}
        onChange={(v) => set('diff', v)}
        hint={
          rerolls === 0
            ? 'No rerolls. Whatever the spin gives you, you take.'
            : `${rerolls} reroll${rerolls === 1 ? '' : 's'} across the whole draft.`
        }
      />

      <Choice
        label="Ratings"
        options={RATINGS}
        value={config.rtype}
        onChange={(v) => set('rtype', v)}
        hint={
          config.rtype === 'prime'
            ? 'Every player is rated at their career best.'
            : 'Every player is rated for the season you found them in.'
        }
      />

      <Surface style={styles.blitz}>
        <Toggle
          label="Blitz"
          hint="Only the top three of every board are offered."
          value={config.blitz}
          onChange={(v) => set('blitz', v)}
        />
      </Surface>

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {config.formation} · {fm ? fm.rows.length : 0} lines ·{' '}
          {rerolls} reroll{rerolls === 1 ? '' : 's'}
          {config.blitz ? ' · blitz' : ''}
        </Text>
      </View>

      <Button
        label="Spin the first board"
        style={styles.go}
        onPress={() => {
          startRun(config);
          router.push('/draft/board');
        }}
      />
    </ModeScreen>
  );
}

const styles = StyleSheet.create({
  blitz: { paddingVertical: 0, marginBottom: space.s5 },
  summary: {
    alignItems: 'center',
    paddingVertical: space.s3,
    marginBottom: space.s3,
    borderRadius: radius.sm,
    backgroundColor: color.surface1,
  },
  summaryText: {
    ...text.key,
    color: color.text2,
    fontFamily: font.displaySemi,
  },
  go: { marginBottom: space.s4 },
});
