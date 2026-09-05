import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { ModeScreen, Press, Rise, Shine, Confirm } from '../../src/ui/components';
import { back, enter, go } from '../../src/game/nav';
import { color, space, radius, alpha } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { ucl as sky } from '../../src/ui/ucl';
import { haptic } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import {
  UCL_STAGE_NAME,
  potOf,
  uclClub,
  uclClubs,
  uclExpected,
} from '../../src/engine';
import { getUcl, startUcl, useUcl } from '../../src/game/ucl';

/**
 * Choosing who to take into Europe.
 *
 * The pots are the thing worth showing. A Champions League is not thirty
 * six clubs in a list, it is four pots, and which pot you are in decides
 * what your eight matchdays look like before a ball is kicked. So the pots
 * come first, laid out as they were seeded.
 *
 * Ranked is the second view, because the pots answer where a club was
 * placed and not whether it is any good. Coefficient and strength are not
 * the same thing, and a club can sit in pot one on five years of history
 * while being the seventh best side in the competition.
 */

const FLAG: Record<string, string> = {
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  Spain: '🇪🇸',
  Germany: '🇩🇪',
  Italy: '🇮🇹',
  France: '🇫🇷',
  Portugal: '🇵🇹',
  Netherlands: '🇳🇱',
  Norway: '🇳🇴',
  Turkiye: '🇹🇷',
  Belgium: '🇧🇪',
  Austria: '🇦🇹',
  Greece: '🇬🇷',
  Azerbaijan: '🇦🇿',
  Ukraine: '🇺🇦',
  Czechia: '🇨🇿',
  Slovakia: '🇸🇰',
};

const POT_NOTE: Record<number, string> = {
  1: 'The champions and the highest coefficients',
  2: 'Strong, and drawn against the seeds',
  3: 'The middle of the competition',
  4: 'Qualifiers and the smaller leagues',
};

type View_ = 'pots' | 'ranked';

export default function UclPick() {
  const run = useUcl();
  const [q, setQ] = useState('');
  const [view, setView] = useState<View_>('pots');
  const [taking, setTaking] = useState<string | null>(null);

  useFocusEffect(useCallback(() => setQ(''), []));

  const term = q.trim().toLowerCase();
  const ranked = useMemo(() => {
    const all = uclClubs();
    return term ? all.filter((c) => c.name.toLowerCase().includes(term)) : all;
  }, [term]);

  const begin = useCallback((name: string) => {
    haptic('success');
    sfx('pick');
    startUcl(name);
    enter('/ucl/hub');
  }, []);

  const tap = useCallback(
    (name: string) => {
      haptic('light');
      const on = getUcl();
      if (on && !on.over) setTaking(name);
      else begin(name);
    },
    [begin],
  );

  const resume = run && !run.over ? run : null;

  return (
    <>
      <ModeScreen
        wide
        overline="Europe"
        title="Champions League"
        scroll={false}
        onBack={() => back()}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled" style={styles.page} showsVerticalScrollIndicator={false}>
          {/* ================= the brand ================= */}
          <View style={styles.hero}>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="uclband" x1="0" y1="0" x2="0.4" y2="1">
                    <Stop offset="0" stopColor="#143A8F" stopOpacity={0.95} />
                    <Stop offset="0.55" stopColor="#0A1E52" stopOpacity={0.95} />
                    <Stop offset="1" stopColor="#040C22" stopOpacity={0.95} />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#uclband)" />
              </Svg>
            </View>
            <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />

            <View style={styles.badge}>
              <Text style={styles.badgeText} allowFontScaling={false}>
                ★ UEFA CHAMPIONS LEAGUE
              </Text>
            </View>
            <Text style={styles.big} allowFontScaling={false}>
              CHAMPIONS
            </Text>
            <Text style={[styles.big, styles.bigBlue]} allowFontScaling={false}>
              LEAGUE
            </Text>
            <Text style={styles.hosts}>36 clubs {'·'} 8 matchdays {'·'} one trophy</Text>
          </View>

          {/* ================= carry on ================= */}
          {resume ? (
            <Rise delay={0}>
              <Press
                onPress={() => {
                  haptic('light');
                  go('/ucl/hub');
                }}
                feel="none"
                scaleTo={0.98}
                style={styles.resume}
              >
                <Text style={styles.resumeStar} allowFontScaling={false}>
                  ★
                </Text>
                <View style={styles.resumeBody}>
                  <Text style={styles.resumeKey}>Carry on</Text>
                  <Text style={styles.resumeName} numberOfLines={1}>
                    {resume.custom ? resume.custom.name : resume.you}
                  </Text>
                  <Text style={styles.resumeNote} numberOfLines={1}>
                    {UCL_STAGE_NAME[resume.stage]} {'·'} {resume.played.length} played
                  </Text>
                </View>
                <Text style={styles.chev}>{'›'}</Text>
              </Press>
            </Rise>
          ) : null}

          <Press
            onPress={() => {
              haptic('light');
              go('/ucl/draft');
            }}
            feel="none"
            scaleTo={0.98}
            style={styles.door}
          >
            <Text style={styles.doorIcon} allowFontScaling={false}>
              ⚡
            </Text>
            <View style={styles.doorBody}>
              <Text style={styles.doorKey}>THE OTHER WAY IN</Text>
              <Text style={styles.doorName}>Draft a Champions XI</Text>
              <Text style={styles.doorNote} numberOfLines={2}>
                Eleven rounds, five players a round, from all thirty six
                squads. Then they enter the competition.
              </Text>
            </View>
            <Text style={styles.chev}>{'›'}</Text>
          </Press>

          <Text style={styles.lead}>
            Or take a club through it. One table of thirty six, eight
            matchdays against eight different opponents, four at home and four
            away. The top eight go straight to the last sixteen, ninth to
            twenty fourth play off for the rest, and below that you are
            finished.
          </Text>

          {/* ================= how to look at them ================= */}
          <View style={styles.tabs}>
            {(['pots', 'ranked'] as View_[]).map((v) => (
              <Press
                key={v}
                onPress={() => {
                  haptic('light');
                  setView(v);
                }}
                feel="none"
                scaleTo={0.98}
                style={[styles.tab, view === v ? styles.tabOn : null]}
              >
                <Text style={[styles.tabText, view === v ? styles.tabTextOn : null]}>
                  {v === 'pots' ? 'The pots' : 'By rating'}
                </Text>
              </Press>
            ))}
          </View>

          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search a club"
            placeholderTextColor={color.text3}
            autoCorrect={false}
            style={styles.search}
          />

          {/* ================= the seeding ================= */}
          {view === 'pots' && !term
            ? [1, 2, 3, 4].map((pot, pi) => (
                <Rise key={pot} delay={Math.min(pi, 6)}>
                  <View style={styles.pot}>
                    <View style={styles.potHead}>
                      <Text style={styles.potName}>Pot {pot}</Text>
                      <Text style={styles.potNote} numberOfLines={1}>
                        {POT_NOTE[pot]}
                      </Text>
                    </View>
                    {potOf(pot)
                      .map((name) => ({ name, c: uclClub(name) }))
                      .sort((a, b) => b.c.tier - a.c.tier)
                      .map((x) => (
                        <ClubRow key={x.name} name={x.name} onPress={() => tap(x.name)} />
                      ))}
                  </View>
                </Rise>
              ))
            : null}

          {/* ================= or strongest first ================= */}
          {view === 'ranked' || term
            ? ranked.map((c, i) => (
                <Rise key={c.name} delay={Math.min(i, 8)}>
                  <Press
                    onPress={() => tap(c.name)}
                    feel="none"
                    scaleTo={0.99}
                    style={styles.row}
                  >
                    <Text style={styles.rank} allowFontScaling={false}>
                      {i + 1}
                    </Text>
                    <Text style={styles.rowFlag} allowFontScaling={false}>
                      {FLAG[c.country] ?? '⚽'}
                    </Text>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {c.name}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        Pot {c.pot} {'·'} {c.country} {'·'} {c.route}
                      </Text>
                      <Text style={[styles.rowExpect, { color: tintFor(c.tier) }]}>
                        Expected: {UCL_STAGE_NAME[uclExpected(c.tier)]}
                      </Text>
                    </View>
                    <View style={[styles.rating, { borderColor: alpha(tintFor(c.tier), 0.55) }]}>
                      <Text
                        style={[styles.ratingText, { color: tintFor(c.tier) }]}
                        allowFontScaling={false}
                      >
                        {c.tier}
                      </Text>
                    </View>
                  </Press>
                </Rise>
              ))
            : null}

          {term && ranked.length === 0 ? (
            <Text style={styles.none}>No club by that name.</Text>
          ) : null}

          <View style={{ height: space.s6 }} />
        </ScrollView>
      </ModeScreen>

      <Confirm
        visible={taking !== null}
        title="Start again?"
        body="You have a campaign on the go. Taking another club throws it away."
        confirmLabel="Start again"
        cancelLabel="Keep it"
        onCancel={() => setTaking(null)}
        onConfirm={() => {
          const name = taking;
          setTaking(null);
          if (name) begin(name);
        }}
      />
    </>
  );
}

/**
 * One club in a pot.
 *
 * The flag, the name and a bar showing where its strength sits across the
 * whole competition, because a rating on its own says nothing and nine
 * bars next to each other say which of the nine you would rather have.
 */
function ClubRow({ name, onPress }: { name: string; onPress: () => void }) {
  const c = uclClub(name);
  if (!c) return null;
  const tint = tintFor(c.tier);
  /* Sixty eight to eighty seven is the real spread of this field. */
  const frac = Math.max(0.06, Math.min(1, (c.tier - 64) / 25));
  return (
    <Press onPress={onPress} feel="none" scaleTo={0.98} style={styles.clubRow}>
      <Text style={styles.clubFlag} allowFontScaling={false}>
        {FLAG[c.country] ?? '⚽'}
      </Text>
      <View style={styles.clubBody}>
        <Text style={styles.clubName} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.clubBar}>
          <View style={[styles.clubFill, { width: `${frac * 100}%`, backgroundColor: tint }]} />
        </View>
      </View>
      <Text style={[styles.clubRate, { color: tint }]} allowFontScaling={false}>
        {Math.round(c.tier)}
      </Text>
    </Press>
  );
}

/** Contender, useful, hopeful, in a colour. */
function tintFor(tier: number): string {
  return tier >= 83 ? sky.gold : tier >= 78 ? sky.blue : tier >= 73 ? sky.play : color.text3;
}

const styles = StyleSheet.create({
  page: { flex: 1 },

  hero: {
    alignItems: 'center',
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: sky.edgeHi,
    backgroundColor: sky.ink,
    overflow: 'hidden',
  },
  badge: {
    paddingHorizontal: space.s4,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: sky.edgeHi,
    backgroundColor: 'rgba(120,166,255,0.12)',
    marginBottom: space.s3,
  },
  badgeText: { ...text.key, fontSize: 9, color: sky.silver },
  big: {
    fontFamily: font.displayBlack,
    fontSize: 40,
    lineHeight: 48,
    color: color.text1,
    letterSpacing: 1,
  },
  bigBlue: { color: sky.blue },
  hosts: { ...text.small, fontSize: 13, lineHeight: 19, color: sky.silver, marginTop: space.s2 },

  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    marginTop: space.s3,
    padding: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: sky.edgeHi,
    backgroundColor: sky.panelOn,
  },
  resumeStar: { fontSize: 26, lineHeight: 34, color: sky.blue },
  resumeBody: { flex: 1, minWidth: 0 },
  resumeKey: { ...text.key, fontSize: 8, color: sky.blue },
  resumeName: { fontFamily: font.displayBold, fontSize: 18, lineHeight: 24, color: color.text1 },
  resumeNote: { ...text.small, fontSize: 11.5, lineHeight: 16, color: color.text2 },
  chev: { fontFamily: font.displayBold, fontSize: 22, color: sky.blue },

  door: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    marginTop: space.s4,
    padding: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: sky.edgeHi,
    backgroundColor: sky.panelOn,
  },
  doorIcon: { fontSize: 26, lineHeight: 34 },
  doorBody: { flex: 1, minWidth: 0, gap: 1 },
  doorKey: { ...text.key, fontSize: 8, color: sky.blue },
  doorName: { fontFamily: font.displayBold, fontSize: 18, lineHeight: 24, color: color.text1 },
  doorNote: { ...text.small, fontSize: 11.5, lineHeight: 16, color: color.text2 },

  lead: {
    ...text.small,
    fontSize: 12.5,
    lineHeight: 18,
    color: color.text3,
    marginTop: space.s4,
    marginBottom: space.s3,
  },

  tabs: { flexDirection: 'row', gap: space.s2, marginTop: space.s3, marginBottom: space.s3 },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: sky.edge,
    backgroundColor: sky.panel,
  },
  tabOn: { borderColor: sky.edgeHi, backgroundColor: sky.panelOn },
  tabText: { ...text.key, fontSize: 9.5, color: color.text3 },
  tabTextOn: { color: sky.blue },

  search: {
    minHeight: 50,
    paddingHorizontal: space.s3,
    marginBottom: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: sky.edge,
    backgroundColor: sky.panel,
    color: color.text1,
    fontFamily: font.bodySemi,
    fontSize: 16,
  },

  pot: {
    marginBottom: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: sky.edge,
    backgroundColor: sky.panel,
    overflow: 'hidden',
  },
  potHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.s3,
    paddingHorizontal: space.s3,
    paddingVertical: space.s3,
    borderBottomWidth: 1,
    borderBottomColor: sky.edge,
    backgroundColor: 'rgba(120,166,255,0.09)',
  },
  potName: { ...text.key, fontSize: 9.5, color: sky.blue },
  potNote: { ...text.small, fontSize: 10.5, lineHeight: 15, color: color.text3, flex: 1 },

  clubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 52,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
  },
  clubFlag: { fontSize: 19, lineHeight: 25, width: 26 },
  clubBody: { flex: 1, minWidth: 0, gap: 5 },
  clubName: { fontFamily: font.displayBold, fontSize: 15, lineHeight: 20, color: color.text1 },
  clubBar: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  clubFill: { height: 3, borderRadius: 2 },
  clubRate: {
    fontFamily: font.displayBlack,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    minWidth: 26,
    textAlign: 'right',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 74,
    marginBottom: 6,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: sky.edge,
    backgroundColor: sky.panel,
  },
  rank: {
    width: 22,
    fontFamily: font.displayBold,
    fontSize: 13,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  rowFlag: { fontSize: 22, lineHeight: 29 },
  rowBody: { flex: 1, minWidth: 0, gap: 1 },
  rowName: { fontFamily: font.displayBold, fontSize: 16, lineHeight: 21, color: color.text1 },
  rowMeta: { ...text.small, fontSize: 11, lineHeight: 15, color: color.text3 },
  rowExpect: { ...text.key, fontSize: 7.5 },
  rating: {
    minWidth: 46,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  ratingText: { fontFamily: font.displayBlack, fontSize: 18, fontVariant: ['tabular-nums'] },

  none: { ...text.small, fontSize: 13, color: color.text3, paddingTop: space.s4 },
});
