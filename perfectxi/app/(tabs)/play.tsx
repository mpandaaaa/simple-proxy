import { Screen, Section, Tile } from '../../src/ui/components';

/**
 * PLAY holds the games. Blitz is deliberately absent: it stays a toggle on
 * the draft setup screen rather than a mode of its own.
 */
export default function PlayScreen() {
  return (
    <Screen kicker="All-time Premier League" title="Play">
      <Section label="The main game">
        <Tile
          tag="Draft"
          tone="accent"
          title="Start a draft"
          subtitle="Spin real club-seasons, build your XI, simulate 38 games."
          soon
        />
      </Section>

      <Section label="Against someone else">
        <Tile
          tag="Live"
          tone="danger"
          title="1v1"
          subtitle="Matched against a real opponent. Same boards, fifteen seconds a pick."
          soon
        />
        <Tile
          tag="Duel"
          tone="gold"
          title="Duels"
          subtitle="Share a code. They draft your exact spins, then the game picks a winner."
          soon
        />
        <Tile
          tag="Solo"
          tone="blue"
          title="Beat the Machine"
          subtitle="It re-drafts your exact boards with the best on paper. Outscore it."
          soon
        />
      </Section>

      <Section label="Tournament">
        <Tile
          tag="Cup"
          tone="gold"
          title="World Cup 2026"
          subtitle="Take a nation, or hand-pick a World XI. 48 teams, groups and knockouts."
          soon
        />
      </Section>
    </Screen>
  );
}
