import { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen, Section, Hero, Row, Press } from '../src/ui/components';
import {
  IconTrophy,
  IconCalendar,
  IconSpark,
  IconSwords,
  IconKeypad,
  IconBank,
  IconCpu,
  IconStar,
  IconMedal,
} from '../src/ui/icons';
import { color, space, radius, gap } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { progressStore, dynastyStore } from '../src/save';
import type { Progress, DynastySummary } from '../src/save';

/**
 * Home is the only hub. Every mode is one tap from here and every mode
 * returns here. There is no tab bar and no drawer: once you are inside a
 * mode you see that mode and nothing else.
 *
 * Copy is taken from the live site rather than written fresh, so the app
 * and the website say the same things about the same modes.
 */
export default function Home() {
  const [progress, setProgress] = useState<Progress>(() => progressStore.read());
  const [dynasty, setDynasty] = useState<DynastySummary | null>(() =>
    dynastyStore.read(),
  );

  // Saves change while you are inside a mode, so the status lines are read
  // again every time Home comes back to the front rather than once on mount.
  useFocusEffect(
    useCallback(() => {
      setProgress(progressStore.read());
      setDynasty(dynastyStore.read());
    }, []),
  );

  return (
    <Screen>
      <View style={styles.brand}>
        <View style={styles.brandTop}>
          <Text style={styles.wordmark}>
            PERFECT <Text style={styles.wordmarkXI}>XI</Text>
          </Text>
          <View style={styles.seasonChip}>
            <Text style={[text.key, styles.seasonChipText]}>Season 26/27</Text>
          </View>
        </View>
        <Text style={styles.tagline}>
          Unofficial fan draft game · free to play
        </Text>
      </View>

      <Hero
        kicker="All-Time Premier League"
        title="START A DRAFT"
        subtitle="Spin real club-seasons · build your XI · simulate 38 games"
        onPress={() => router.push('/draft')}
      />

      <View style={styles.afterHero}>
        <Row
          icon={IconTrophy}
          tone="gold"
          title="World Cup 2026"
          subtitle="Pick a nation or build a World XI · win the cup"
          onPress={() =>
            soon('World Cup', 'World Cup 2026', 'Pick one of the qualified nations and draft its real squad, or build a World XI, then play the group stage and the knockouts.')
          }
        />
      </View>

      <Section label="Play today">
        <Row
          icon={IconCalendar}
          tone="blue"
          tag="Daily"
          title="Daily Challenge"
          subtitle="Same spins for everyone · one attempt"
          onPress={() =>
            soon('Play today', 'Daily Challenge', 'Everyone in the world gets the same seeded spins once a day, with one attempt and a shareable scorecard showing all 38 results.')
          }
        />
        <Row
          icon={IconSpark}
          tone="gold"
          tag="Event"
          title="Weekly Event"
          subtitle="A new twist every week"
          onPress={() =>
            soon('Play today', 'Weekly Event', 'A rotating rule twist each week: Nineties Week, Y2K Week, Moneyball, Modern Era and Homegrown.')
          }
        />
        <Row
          icon={IconSwords}
          tone="danger"
          tag="Duel"
          title="Start a duel"
          subtitle="Seeded run · share the code"
          onPress={() =>
            soon('Play today', 'Start a duel', 'Send a code and your friend drafts from your exact spin sequence, then the game declares a winner.')
          }
        />
        <Row
          icon={IconKeypad}
          tone="neutral"
          tag="Code"
          title="Enter a code"
          subtitle="Same spins · beat their points"
          onPress={() =>
            soon('Play today', 'Enter a code', 'Take a code from a friend and draft from the same spins, then see who scored more points.')
          }
        />
      </Section>

      <Section label="Your game">
        <Row
          icon={IconBank}
          tone="accent"
          title={dynasty ? `Dynasty · ${dynasty.club}` : 'Dynasty'}
          subtitle={dynastyLine(dynasty)}
          onPress={() =>
            soon('Your game', 'Dynasty', 'Carry one XI across seasons. Players age, develop, decline and retire, your league finish earns a transfer budget, and a board sets the objectives your job depends on.')
          }
        />
        <Row
          icon={IconCpu}
          tone="blue"
          title="Beat the Machine"
          subtitle="It re-drafts your exact boards · outscore it"
          onPress={() =>
            soon('Your game', 'Beat the Machine', 'Finish a season and the Machine re-drafts your exact boards with best-on-paper picks. Outscore it if you can.')
          }
        />
        <Row
          icon={IconStar}
          tone="purple"
          title={`Progress · Level ${progress.lvl}`}
          subtitle={progressLine(progress)}
          onPress={() =>
            soon('Your game', 'Progress', 'Level, missions, collection and unlocks, all earned from seasons you have actually played.')
          }
        />
        <Row
          icon={IconMedal}
          tone="gold"
          title="Hall of Fame"
          subtitle="Your greatest seasons, ranked"
          onPress={() =>
            soon('Your game', 'Hall of Fame', 'Your greatest seasons, ranked.')
          }
        />
      </Section>

      <Text style={styles.dbLine}>
        51 clubs · 712 squad-seasons · 1992 to 2026
      </Text>

      <View style={styles.footer}>
        {FOOTER.map((f) => (
          <Press
            key={f.label}
            onPress={() => soon('Perfect XI', f.label, f.blurb)}
            feel="select"
            scaleTo={0.94}
            style={styles.footerChip}
          >
            <Text style={styles.footerText}>{f.label}</Text>
          </Press>
        ))}
      </View>

      <Text style={styles.legal}>
        Perfect XI is an unofficial fan game. Not affiliated with the Premier
        League, any football club, or any player.
      </Text>
    </Screen>
  );
}

const FOOTER = [
  {
    label: 'Guides',
    blurb:
      'How to play, the match engine, squad chemistry, formations and the ratings database, written from the game’s own numbers.',
  },
  {
    label: 'Changelog',
    blurb: 'What changed in each update.',
  },
  {
    label: 'Privacy',
    blurb:
      'Perfect XI needs no account and stores your saves on this device rather than on a server.',
  },
  {
    label: 'Contact',
    blurb: 'Feedback, bug reports, or an argument about a rating.',
  },
];

/**
 * One honest screen for anything not built yet, rather than a dead tap or
 * a badge on the home screen. Each entry carries its own real description
 * from the live site, so the screen says something true about the mode.
 */
function soon(overline: string, title: string, blurb: string) {
  router.push({ pathname: '/soon', params: { overline, title, blurb } });
}

/** No career yet is a real state, so it gets the description, not a blank. */
function dynastyLine(d: DynastySummary | null): string {
  if (!d) return 'A career across seasons · ages, transfers, the board';
  if (d.sacked) return 'Sacked · start again';
  return `Season ${d.season} · £${d.budget}m · ${d.trophies} titles`;
}

function progressLine(p: Progress): string {
  return `${p.coins} coins · ${p.streak}-day streak`;
}

const styles = StyleSheet.create({
  brand: { marginBottom: space.s5 },
  brandTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s3,
  },
  wordmark: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 29,
    letterSpacing: 1.2,
    color: color.text1,
  },
  wordmarkXI: { color: color.accent },
  seasonChip: {
    paddingHorizontal: space.s3,
    paddingVertical: space.s1 + 1,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surface1,
  },
  seasonChipText: { color: color.text2 },
  tagline: {
    ...text.small,
    marginTop: space.s1,
  },
  afterHero: { marginTop: space.s3 },
  dbLine: {
    ...text.key,
    color: color.text3,
    textAlign: 'center',
    marginTop: gap.group,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.s2,
    marginTop: space.s4,
  },
  footerChip: {
    paddingHorizontal: space.s4,
    paddingVertical: space.s2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    backgroundColor: color.surface1,
  },
  footerText: {
    fontFamily: font.bodyMed,
    fontSize: 12,
    color: color.text2,
  },
  legal: {
    ...text.small,
    fontSize: 11,
    lineHeight: 16,
    color: color.text3,
    textAlign: 'center',
    marginTop: space.s4,
  },
});
