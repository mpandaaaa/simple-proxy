import { View, StyleSheet } from 'react-native';
import { Screen, Section, Surface, Tile, NumberSlot } from '../../src/ui/components';
import { color, space } from '../../src/ui/tokens';

/**
 * CAREER is Dynasty and nothing else. It is a big enough mode to own a tab.
 */
export default function CareerScreen() {
  return (
    <Screen kicker="Multi-season management" title="Career">
      <Section label="Your club">
        <Surface style={styles.statRow}>
          <NumberSlot label="Season" value={4} />
          <View style={styles.divider} />
          <NumberSlot label="Trophies" value={2} tone={color.gold} />
          <View style={styles.divider} />
          <NumberSlot label="Budget" value="£84m" tone={color.accent} />
        </Surface>
      </Section>

      <Section label="Start a dynasty">
        <Tile
          tag="Career"
          tone="accent"
          title="Dynasty"
          subtitle="Ages, development, retirement, transfers, wages, the board. One XI across many seasons."
          soon
        />
      </Section>

      <Section label="Run the club">
        <Tile tag="Squad" tone="neutral" title="Squad and bench" soon />
        <Tile tag="Tactics" tone="neutral" title="Tactics" soon />
        <Tile tag="Staff" tone="neutral" title="Staff" soon />
        <Tile tag="Youth" tone="neutral" title="Academy" soon />
        <Tile tag="Money" tone="neutral" title="Finances" soon />
        <Tile tag="Club" tone="neutral" title="Stadium and facilities" soon />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', alignItems: 'center' },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: color.border,
    marginHorizontal: space.s3,
  },
});
