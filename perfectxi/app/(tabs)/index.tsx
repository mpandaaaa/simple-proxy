import { View, Text, StyleSheet } from 'react-native';
import { Screen, Section, Surface, Pill, NumberSlot, Button, Tile } from '../../src/ui/components';
import { color, space, radius } from '../../src/ui/tokens';
import { text } from '../../src/ui/type';

/**
 * TODAY is the front door. Daily challenge, the running event, the streak,
 * and a way back into whatever was left half finished.
 *
 * Phase 1: the layout and the design system are real. Nothing is wired to
 * the engine yet, so the numbers below are fixed sample values.
 */
export default function TodayScreen() {
  return (
    <Screen kicker="Tuesday 31 August" title="Today">
      <Surface level={2} style={styles.hero}>
        <View style={styles.heroTop}>
          <Pill tone="accent">Daily challenge</Pill>
          <Text style={styles.countdown}>Resets in 6h 12m</Text>
        </View>
        <Text style={[text.heading, styles.heroTitle]}>
          Same spins for everyone
        </Text>
        <Text style={text.small}>
          One attempt. Eleven boards. Everybody in the world gets the same
          eleven.
        </Text>
        <Button label="Play today's challenge" style={styles.heroBtn} />
      </Surface>

      <Section label="Your streak">
        <Surface style={styles.statRow}>
          <NumberSlot label="Day streak" value={12} tone={color.accent} />
          <View style={styles.divider} />
          <NumberSlot label="Best" value={31} />
          <View style={styles.divider} />
          <NumberSlot label="Played" value={148} />
        </Surface>
      </Section>

      <Section label="Pick up where you left off">
        <Tile
          tag="In progress"
          tone="gold"
          title="Draft, 7 of 11 picked"
          subtitle="4-3-3 - started 2 hours ago"
          soon
        />
      </Section>

      <Section label="This week">
        <Tile
          tag="Event"
          tone="blue"
          title="Moneyball Week"
          subtitle="No player rated above 85. Find the bargains."
          soon
        />
        <Tile
          tag="New"
          tone="accent"
          title="Live 1v1 is coming"
          subtitle="Draft head to head against a real opponent, same eleven boards, fifteen seconds a pick."
          soon
        />
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
  countdown: {
    ...text.key,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  heroTitle: { marginBottom: space.s2 },
  heroBtn: { marginTop: space.s5 },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: color.border,
    marginHorizontal: space.s3,
  },
});
