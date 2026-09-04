import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { ModeScreen, Rise, Shine } from '../src/ui/components';
import { alpha, color, hue, line, radius, space } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { ACHIEVEMENTS } from '../src/game/achievements';
import { standing } from '../src/game/award';
import { STAGE_NAME, UCL_STAGE_NAME, levelProgress } from '../src/engine';
import { careerStore, historyStore, progressStore, ranked } from '../src/save';

/**
 * Everything you have ever done, in one place.
 *
 * Six modes each count their own things and none of them were ever shown
 * together. The career record already holds most of it and the rest is
 * read straight off the other saves, so nothing here is a new number: it
 * is the numbers that already existed, finally next to each other.
 *
 * Nothing is invented. A figure that is not tracked is not shown, rather
 * than shown as a nought that looks like a fact.
 */

const WC_ORDER = ['group', 'r32', 'r16', 'qf', 'sf', 'final'] as const;
const UCL_ORDER = ['league', 'po', 'r16', 'qf', 'sf', 'final'] as const;

export default function Stats() {
  const [snap, setSnap] = useState(() => read());

  useFocusEffect(useCallback(() => setSnap(read()), []));

  const { career, prog, best, now } = snap;
  const lvl = levelProgress(prog.xp);

  const trophies =
    career.titles +
    career.nationalCups +
    career.continentalCups +
    career.wcTitles +
    career.uclTitles +
    career.dynTitles;

  const earned = ACHIEVEMENTS.filter((a) => career.earned.includes(a.key)).length;

  return (
    <ModeScreen overline="Everything, added up" title="Your record">
      {/* ================= the three that matter ================= */}
      <View style={styles.hero}>
        <View style={styles.bloom} pointerEvents="none">
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <Defs>
              <RadialGradient id="statsBloom" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={color.gold} stopOpacity={0.26} />
                <Stop offset="1" stopColor={color.gold} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx="50" cy="6" rx="70" ry="48" fill="url(#statsBloom)" />
          </Svg>
        </View>
        <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />

        <View style={styles.heroRow}>
          <Big value={String(trophies)} label="Trophies" tint={color.gold} />
          <Big value={String(career.seasons + career.dynSeasons)} label="Seasons" tint={hue.emerald} />
          <Big value={`${earned}`} label={`of ${ACHIEVEMENTS.length}`} tint={hue.sky} />
        </View>
        <Text style={styles.heroNote}>
          Level {lvl.level} {'·'} {prog.coins.toLocaleString('en-GB')} coins
        </Text>
      </View>

      {/* ================= the draft ================= */}
      <Rise delay={0}>
        <Section title="The draft" tint={hue.emerald}>
          <Row label="Seasons played" value={String(career.seasons)} />
          <Row label="League titles" value={String(career.titles)} />
          <Row label="Games won" value={career.wins.toLocaleString('en-GB')} />
          <Row label="Unbeaten seasons" value={String(career.unbeaten)} />
          <Row label="Relegations" value={String(career.relegations)} />
          <Row label="Best points total" value={best ? String(best.pts) : 'none yet'} />
          <Row
            label="Best season"
            value={best ? `${ordinal(best.position)}, grade ${best.grade}` : 'none yet'}
          />
          <Row
            label="Formations won with"
            value={career.titleFormations.length ? career.titleFormations.join(', ') : 'none yet'}
          />
        </Section>
      </Rise>

      {/* ================= the cups ================= */}
      <Rise delay={1}>
        <Section title="The cups" tint={color.gold}>
          <Row label="National Cups" value={String(career.nationalCups)} />
          <Row label="Continental Cups" value={String(career.continentalCups)} />
          <Row label="Doubles" value={String(career.doubles)} />
          <Row label="Trebles" value={String(career.trebles)} />
        </Section>
      </Rise>

      {/* ================= the tournaments ================= */}
      <Rise delay={2}>
        <Section title="The World Cup" tint={hue.sky}>
          <Row label="Tournaments played" value={String(career.wcRuns)} />
          <Row label="Won" value={String(career.wcTitles)} />
          <Row
            label="Furthest reached"
            value={career.wcRuns ? STAGE_NAME[WC_ORDER[Math.min(5, career.wcBest)]] : 'none yet'}
          />
        </Section>
      </Rise>

      <Rise delay={3}>
        <Section title="The Champions League" tint="#4FC3FF">
          <Row label="Campaigns played" value={String(career.uclRuns)} />
          <Row label="Won" value={String(career.uclTitles)} />
          <Row
            label="Furthest reached"
            value={
              career.uclRuns ? UCL_STAGE_NAME[UCL_ORDER[Math.min(5, career.uclBest)]] : 'none yet'
            }
          />
        </Section>
      </Rise>

      {/* ================= the career ================= */}
      <Rise delay={4}>
        <Section title="Dynasty" tint={hue.violet}>
          <Row label="Seasons in the dugout" value={String(career.dynSeasons)} />
          <Row label="Titles" value={String(career.dynTitles)} />
          <Row
            label="Best points total"
            value={career.dynBestPts ? String(career.dynBestPts) : 'none yet'}
          />
        </Section>
      </Rise>

      {/* ================= today ================= */}
      <Rise delay={5}>
        <Section title="Play today" tint={hue.mint}>
          <Row label="Dailies played" value={String(now.daily.played)} />
          <Row label="Dailies won" value={String(now.daily.won)} />
          <Row label="Daily streak" value={`${now.daily.streak} day${now.daily.streak === 1 ? '' : 's'}`} />
          <Row label="Weekly events" value={String(now.weekly.played)} />
          <Row label="Duels played" value={String(now.duels.played)} />
          <Row label="Duels won" value={String(now.duels.won)} />
        </Section>
      </Rise>

      {/* ================= the album ================= */}
      <Rise delay={6}>
        <Section title="The collection" tint={hue.rose}>
          <Row label="Cards owned" value={now.cards.all.toLocaleString('en-GB')} />
          <Row label="Icons" value={String(now.cards.icon)} />
          <Row label="Best card" value={now.bestCard ? String(now.bestCard) : 'none yet'} />
          <Row label="Sets completed" value={`${now.sets} of ${now.setsTotal}`} />
          <Row label="Level" value={`${lvl.level} of 50`} />
        </Section>
      </Rise>

      <View style={{ height: space.s6 }} />
    </ModeScreen>
  );
}

function read() {
  const career = careerStore.read();
  const prog = progressStore.read();
  const history = historyStore.read();
  const top = ranked(history.runs)[0] ?? null;
  return {
    career,
    prog,
    best: top,
    now: standing(),
  };
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function Big({ value, label, tint }: { value: string; label: string; tint: string }) {
  return (
    <View style={styles.big}>
      <Text style={[styles.bigValue, { color: tint }]} allowFontScaling={false}>
        {value}
      </Text>
      <Text style={styles.bigLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Section({
  title,
  tint,
  children,
}: {
  title: string;
  tint: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <View style={styles.sectHead}>
        <View style={[styles.sectBar, { backgroundColor: tint }]} />
        <Text style={[styles.sectTitle, { color: tint }]}>{title}</Text>
      </View>
      <View style={styles.card}>{children}</View>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingVertical: space.s4,
    paddingHorizontal: space.s3,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: '#141D15',
    overflow: 'hidden',
    gap: space.s2,
  },
  bloom: { position: 'absolute', top: -30, left: -20, right: -20, height: 150 },
  heroRow: { flexDirection: 'row' },
  big: { flex: 1, alignItems: 'center', gap: 1 },
  bigValue: {
    fontFamily: font.hero,
    fontSize: 40,
    lineHeight: 50,
    fontVariant: ['tabular-nums'],
  },
  bigLabel: { ...text.key, fontSize: 7.5, color: color.text3 },
  heroNote: { ...text.key, fontSize: 8, color: color.text3, textAlign: 'center' },

  sectHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    marginTop: space.s5,
    marginBottom: space.s2,
  },
  sectBar: { width: 3, height: 14, borderRadius: 2 },
  sectTitle: { ...text.key, fontSize: 9.5 },

  card: {
    paddingHorizontal: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s3,
    minHeight: 42,
    borderBottomWidth: 1,
    borderBottomColor: alpha('#FFFFFF', 0.05),
  },
  rowLabel: { ...text.small, fontSize: 13, lineHeight: 18, color: color.text3, flexShrink: 1 },
  rowValue: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 19,
    color: color.text1,
    fontVariant: ['tabular-nums'],
    maxWidth: '55%',
    textAlign: 'right',
  },
});
