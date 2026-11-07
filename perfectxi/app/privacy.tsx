import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { back } from '../src/game/nav';
import { ModeScreen } from '../src/ui/components';
import { color, space, radius, line, hue, alpha } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { me } from '../src/save';

/**
 * What the app knows about you.
 *
 * Written from what the code actually does rather than from a template,
 * which is why it is short: there are no accounts, no analytics, no
 * advertising and no third party anything. The only thing that ever
 * leaves the phone is what a duel needs, and a duel needs three numbers.
 *
 * If any of that changes, this page changes with it. A privacy page that
 * has drifted from the code is worse than none.
 */
export default function Privacy() {
  return (
    <ModeScreen overline="Perfect XI" title="Privacy" scroll={false} onBack={() => back()}>
      <ScrollView
        keyboardShouldPersistTaps="handled" style={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.headline}>
          <Text style={styles.headlineText}>
            No account, no email, no adverts and no tracking, and nothing about
            you sold to anybody.
          </Text>
        </View>

        <Section title="What stays on this phone">
          Everything you play. Your drafts, your seasons, your Dynasty, your
          album, your coins and your level are stored on the device and nowhere
          else. Deleting the app deletes all of it, and there is no way to get
          it back, because there is no copy anywhere.
        </Section>

        <Section title="What leaves it">
          Only what a live duel needs, and only when you start one. Three
          things go up: a random id made on this phone the first time it was
          needed, the handle shown to your opponent, and the seed, the picks
          and the score of that duel.
        </Section>

        <Section title="What that id is">
          Sixteen bytes of random numbers, made on the device. It is not your
          phone's identifier, it is not linked to your Apple account, and it
          identifies nobody: it exists so that two people in the same duel can
          tell each other apart. Yours is {me().id.slice(0, 8)} and it was made
          on this phone.
        </Section>

        <Section title="How long it is kept">
          A duel that nobody joins is deleted after two minutes. A duel that
          was played is deleted after six hours. Nothing else is stored on the
          server at all.
        </Section>

        <Section title="Where that goes">
          To a database hosted by Supabase, in Europe. It holds a queue of
          people waiting for a duel and the result of one, and nothing else.
          It is the only server the game itself ever sends anything to, and
          there is no analytics service of any kind.
        </Section>

        <Section title="That list in full">
          In Apple's own categories, which is how it is written on the App
          Store listing:
        </Section>

        <View style={styles.table}>
          {COLLECTED.map((row) => (
            <View key={row.what} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.what}>{row.what}</Text>
                <Text style={styles.why}>{row.why}</Text>
              </View>
              {row.tracking ? <Text style={styles.tracks}>Tracking</Text> : null}
            </View>
          ))}
        </View>

        <Section title="What there is not">
          No adverts, no tracking, no analytics and no crash reporting. No
          third party in here except the database above. No account and
          nothing to sign in to. We do not sell
          anything about you to anybody, and there is nothing to sell,
          because nothing about what you play ever reaches us either.
        </Section>

        <Section title="Children">
          The game asks for nothing and stores nothing personal, so there is
          nothing here that a child could give away.
        </Section>

        <Section title="The football">
          Perfect XI is an unofficial fan game. Player names, club names and
          seasons are matters of public record, used to describe real football
          history. It is not affiliated with, endorsed by or connected to the
          Premier League, FIFA, UEFA, any football club, any competition or
          any player.
        </Section>

        <Section title="Getting in touch">
          Anything at all, including asking what is held about you and asking
          for it to be deleted: perfectxigame@gmail.com. There is no account
          to look up, so if you write about a duel it helps to say roughly
          when you played it.
        </Section>

        <View style={{ height: space.s6 }} />
      </ScrollView>
    </ModeScreen>
  );
}

/*
 * What the game's online layer collects, in Apple's words.
 *
 * The same list as the privacy manifest in app.config.js and the same
 * list as the table on web/app-privacy.html, and check-privacy.mjs refuses
 * to let the three drift apart.
 */
const COLLECTED: { what: string; why: string; tracking: boolean }[] = [
  { what: 'User ID', why: 'App functionality', tracking: false },
  { what: 'Gameplay content', why: 'App functionality', tracking: false },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  headline: {
    padding: space.s4,
    marginBottom: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(hue.emerald, 0.4),
    backgroundColor: alpha(hue.emerald, 0.08),
  },
  headlineText: {
    fontFamily: font.displayBold,
    fontSize: 17,
    lineHeight: 24,
    color: color.text1,
  },
  section: {
    marginBottom: space.s4,
    paddingBottom: space.s4,
    borderBottomWidth: 1,
    borderBottomColor: line.card,
    gap: space.s2,
  },
  title: { ...text.label, fontSize: 12, color: color.text2 },
  table: {
    marginTop: -space.s2,
    marginBottom: space.s4,
    paddingBottom: space.s4,
    borderBottomWidth: 1,
    borderBottomColor: line.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: space.s2,
    borderTopWidth: 1,
    borderTopColor: line.card,
  },
  rowText: { flex: 1, gap: 2 },
  what: { ...text.small, fontSize: 13.5, color: color.text2 },
  why: { ...text.small, fontSize: 12, color: color.text3 },
  tracks: {
    ...text.label,
    fontSize: 10,
    color: hue.gold,
    borderWidth: 1,
    borderColor: alpha(hue.gold, 0.4),
    borderRadius: radius.sm,
    paddingHorizontal: space.s2,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  body: { ...text.small, fontSize: 13.5, lineHeight: 21, color: color.text3 },
});
