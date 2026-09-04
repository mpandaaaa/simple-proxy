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
      <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.headline}>
          <Text style={styles.headlineText}>
            No account, no email, and nothing about you sold to anybody. There
            are adverts, and this page says exactly what they see.
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
          There is no other server, no analytics service and no third party
          that sees anything.
        </Section>

        <Section title="The adverts">
          There are two kinds and no more. One you choose to watch, in the
          shop, in exchange for a pack or some coins. And one full screen
          advert at a break in play, after a season or a tournament has
          finished, at most once every few minutes. There are none during a
          match, none in the Daily, the Weekly or a duel, and no banners
          anywhere.
        </Section>

        <Section title="Who shows them">
          Google, through AdMob. When an advert is requested Google receives
          what any advert needs: roughly where in the world the request came
          from, the kind of device, and an advertising identifier if you
          allowed one. The game does not send Google anything about what you
          play. Your seasons, your squads and your album are never part of an
          advert request.
        </Section>

        <Section title="The tracking question">
          The first time you open the game your phone asks whether Perfect XI
          may track you across other apps and websites. That question is
          Apple's and the answer is yours. Say yes and the adverts are chosen
          using an identifier your phone gives out. Say no and they are not,
          and nothing else changes: the same number of adverts, the same
          rewards, the same game. You can change your mind at any time in the
          phone's Settings, under Privacy and Security, then Tracking.
        </Section>

        <Section title="What there is not">
          No analytics of our own. No crash reporting. No banners. No account
          and nothing to sign in to. Nothing you do in the game is shared with
          anybody, and nothing about you is sold to anybody, by us or by
          anyone else.
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
          any player. The adverts pay for it being free rather than for
          anything else.
        </Section>

        <View style={{ height: space.s6 }} />
      </ScrollView>
    </ModeScreen>
  );
}

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
  body: { ...text.small, fontSize: 13.5, lineHeight: 21, color: color.text3 },
});
