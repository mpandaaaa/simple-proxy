import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import {
  Screen,
  Section,
  Surface,
  Pill,
  NumberSlot,
  Tile,
  Toggle,
} from '../../src/ui/components';
import { color, space, radius } from '../../src/ui/tokens';
import { text } from '../../src/ui/type';
import { settingsStore, type Settings } from '../../src/save';

/** Verified against the database, not the marketing copy. */
const TOTAL_CLUB_SEASONS = 712;
const TOTAL_PLAYERS = 3003;

export default function YouScreen() {
  // Settings are read straight off disk on first render, so a relaunch
  // shows exactly what was left behind.
  const [settings, setSettings] = useState<Settings>(() => settingsStore.read());

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(settingsStore.update((s) => ({ ...s, [key]: value })));
  }

  const collected = 41;
  const pct = Math.round((collected / TOTAL_CLUB_SEASONS) * 100);

  return (
    <Screen kicker="Level 7 - Contender" title="You">
      <Surface level={2} style={styles.hero}>
        <View style={styles.heroTop}>
          <Pill tone="accent">Level 7</Pill>
          <Text style={styles.xp}>1,240 / 1,960 XP</Text>
        </View>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: '63%' }]} />
        </View>
        <View style={styles.statRow}>
          <NumberSlot label="Coins" value={430} tone={color.gold} />
          <View style={styles.divider} />
          <NumberSlot label="Seasons" value={148} />
          <View style={styles.divider} />
          <NumberSlot label="Titles" value={9} tone={color.accent} />
        </View>
      </Surface>

      <Section label="Collection">
        <Surface>
          <View style={styles.collectTop}>
            <Text style={text.bodyStrong}>Club seasons found</Text>
            <Text style={[text.stat, styles.collectVal]}>
              {collected}
              <Text style={styles.collectOf}> / {TOTAL_CLUB_SEASONS}</Text>
            </Text>
          </View>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${pct}%` }]} />
          </View>
          <Text style={[text.small, styles.collectFoot]}>
            {TOTAL_PLAYERS.toLocaleString('en-GB')} players across 51 clubs and 35
            seasons, 1992 to 2026.
          </Text>
        </Surface>
      </Section>

      <Section label="Records">
        <Tile tag="Hall" tone="gold" title="Hall of Fame" subtitle="Your greatest seasons, ranked" soon />
        <Tile tag="Cabinet" tone="neutral" title="Trophy cabinet" soon />
        <Tile tag="History" tone="neutral" title="Draft history" soon />
      </Section>

      <Section label="Settings">
        <Surface>
          <Toggle
            label="Sound"
            hint="Spin, goal and whistle effects"
            value={settings.sound}
            onChange={(v) => set('sound', v)}
          />
          <Toggle
            label="Haptics"
            hint="Taptic feedback on picks and results"
            value={settings.haptics}
            onChange={(v) => set('haptics', v)}
          />
          <Toggle
            label="Reduced motion"
            hint="Cuts confetti, shake and the spin animation"
            value={settings.reducedMotion}
            onChange={(v) => set('reducedMotion', v)}
          />
          <Toggle
            label="Colourblind mode"
            hint="Adds shape cues to the position colours"
            value={settings.colourblind}
            onChange={(v) => set('colourblind', v)}
          />
        </Surface>
        <Text style={[text.small, styles.saveNote]}>
          These save straight away. Force quit the app and reopen it, they
          should come back exactly as you left them.
        </Text>
      </Section>

      <Section label="Build">
        <Surface>
          <Text style={[text.small, styles.stamp]}>
            Perfect XI {Constants.expoConfig?.version ?? '1.0.0'}
            {'\n'}Phase 1: shell, tokens, fonts, save layer
            {'\n'}Engine and database land in Phase 2
          </Text>
        </Surface>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { padding: space.s5, borderRadius: radius.lg },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.s3,
  },
  xp: { ...text.key, color: color.text3, fontVariant: ['tabular-nums'] },
  bar: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: color.surface3,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: color.accent, borderRadius: radius.pill },
  statRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.s5 },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: color.border,
    marginHorizontal: space.s3,
  },
  collectTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: space.s3,
  },
  collectVal: { color: color.accent },
  collectOf: { ...text.small, color: color.text3 },
  collectFoot: { marginTop: space.s3 },
  saveNote: { marginTop: space.s3 },
  stamp: { lineHeight: 21 },
});
