import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { ModeScreen, Press, Rise, Shine, Confirm } from '../../src/ui/components';
import { back, go, swap } from '../../src/game/nav';
import { color, space, radius, line, hue, alpha } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import { STAGE_NAME, groupOf, wcExpected, wcNations, wcSquad, wcTeam } from '../../src/engine';
import { WC_GROUPS } from '../../src/data/worldcup';
import { getWorldCup, startWorldCup, useWorldCup } from '../../src/game/worldcup';

/**
 * Choosing who to take.
 *
 * The draw is the thing worth showing, because a World Cup is not a list
 * of forty eight nations, it is twelve groups and the one you happen to
 * be in. So the groups come first, laid out as they were drawn, with the
 * favourite of each one named.
 *
 * Two things the group view cannot answer, so there is a second one: who
 * is actually any good, and how far a nation of that quality is meant to
 * get. Ranked answers the first and the line on every tile answers the
 * second, because "Morocco, 82" means nothing on its own and "expected
 * to reach the last sixteen" is the bet you are being asked to make.
 */

type View_ = 'groups' | 'ranked';

export default function WorldCupPick() {
  const run = useWorldCup();
  const [q, setQ] = useState('');
  const [view, setView] = useState<View_>('groups');
  const [taking, setTaking] = useState<string | null>(null);

  useFocusEffect(useCallback(() => setQ(''), []));

  const term = q.trim().toLowerCase();
  const ranked = useMemo(() => {
    const all = wcNations();
    return term ? all.filter((n) => n.name.toLowerCase().includes(term)) : all;
  }, [term]);

  const begin = useCallback((code: string) => {
    haptic('success');
    sfx('pick');
    startWorldCup(code);
    swap('/worldcup/hub');
  }, []);

  const tap = useCallback(
    (code: string) => {
      haptic('light');
      const on = getWorldCup();
      if (on && !on.over) setTaking(code);
      else begin(code);
    },
    [begin],
  );

  const resume = run && !run.over ? wcTeam(run.you) : null;

  return (
    <>
      <ModeScreen overline="Tournament" title="World Cup" scroll={false} onBack={() => back()}>
        <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
          {/* ================= the brand ================= */}
          <View style={styles.hero}>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="wcband" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#0E3B2A" stopOpacity={0.9} />
                    <Stop offset="0.5" stopColor="#12233A" stopOpacity={0.9} />
                    <Stop offset="1" stopColor="#2A1E0A" stopOpacity={0.9} />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#wcband)" />
              </Svg>
            </View>
            <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />

            <View style={styles.badge}>
              <Text style={styles.badgeText} allowFontScaling={false}>
                {'\u{1F3C6}'} 2026 FIFA WORLD CUP
              </Text>
            </View>
            <Text style={styles.big} allowFontScaling={false}>
              WORLD
            </Text>
            <Text style={[styles.big, styles.bigGold]} allowFontScaling={false}>
              CUP
            </Text>
            <Text style={styles.hosts}>
              USA {'·'} Canada {'·'} Mexico {'·'} 48 nations
            </Text>
          </View>

          {/* ================= carry on ================= */}
          {resume ? (
            <Rise delay={0}>
              <Press
                onPress={() => {
                  haptic('light');
                  go('/worldcup/hub');
                }}
                feel="none"
                scaleTo={0.98}
                style={styles.resume}
              >
                <Text style={styles.resumeFlag} allowFontScaling={false}>
                  {resume.f}
                </Text>
                <View style={styles.resumeBody}>
                  <Text style={styles.resumeKey}>Carry on</Text>
                  <Text style={styles.resumeName} numberOfLines={1}>
                    {resume.n}
                  </Text>
                  <Text style={styles.resumeNote} numberOfLines={1}>
                    {STAGE_NAME[run!.stage]} {'·'} {run!.played.length} played
                  </Text>
                </View>
                <Text style={styles.chev}>{'›'}</Text>
              </Press>
            </Rise>
          ) : null}

          <Press
            onPress={() => {
              haptic('light');
              go('/worldcup/draft');
            }}
            feel="none"
            scaleTo={0.98}
            style={styles.door}
          >
            <Text style={styles.doorIcon} allowFontScaling={false}>
              {'\u{1F30D}'}
            </Text>
            <View style={styles.doorBody}>
              <Text style={styles.doorKey}>THE OTHER WAY IN</Text>
              <Text style={styles.doorName}>Draft a World XI</Text>
              <Text style={styles.doorNote} numberOfLines={2}>
                Eleven rounds, five players a round, from all forty eight
                squads. Then they play the tournament.
              </Text>
            </View>
            <Text style={styles.chev}>{'›'}</Text>
          </Press>

          <Text style={styles.lead}>
            Or take a nation through the whole thing. Twelve groups of four,
            the top two and the eight best thirds go through, and from the
            round of thirty two it is one match at a time.
          </Text>

          {/* ================= how to look at them ================= */}
          <View style={styles.tabs}>
            {(['groups', 'ranked'] as View_[]).map((v) => (
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
                  {v === 'groups' ? 'The draw' : 'By rating'}
                </Text>
              </Press>
            ))}
          </View>

          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search a nation"
            placeholderTextColor={color.text3}
            autoCorrect={false}
            style={styles.search}
          />

          {/* ================= the draw ================= */}
          {view === 'groups' && !term
            ? WC_GROUPS.map((letter, gi) => {
                const four = groupOf(letter)
                  .map((code) => ({ code, t: wcTeam(code) }))
                  .sort((a, b) => (b.t?.r ?? 0) - (a.t?.r ?? 0));
                const top = four[0];
                return (
                  <Rise key={letter} delay={Math.min(gi, 8)}>
                    <View style={styles.group}>
                      <View style={styles.groupHead}>
                        <Text style={styles.groupName}>Group {letter}</Text>
                        <Text style={styles.groupFav} numberOfLines={1}>
                          {top?.t?.n} favourites
                        </Text>
                      </View>
                      <View style={styles.grid}>
                        {four.map((n) => (
                          <Tile
                            key={n.code}
                            code={n.code}
                            onPress={() => tap(n.code)}
                            best={n.code === top?.code}
                          />
                        ))}
                      </View>
                    </View>
                  </Rise>
                );
              })
            : null}

          {/* ================= or strongest first ================= */}
          {view === 'ranked' || term
            ? ranked.map((n, i) => {
                const expect = wcExpected(n.rating);
                return (
                  <Rise key={n.code} delay={Math.min(i, 8)}>
                    <Press
                      onPress={() => tap(n.code)}
                      feel="none"
                      scaleTo={0.99}
                      style={styles.row}
                    >
                      <Text style={styles.rank} allowFontScaling={false}>
                        {i + 1}
                      </Text>
                      <Text style={styles.rowFlag} allowFontScaling={false}>
                        {n.flag}
                      </Text>
                      <View style={styles.rowBody}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {n.name}
                        </Text>
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          Group {n.group} {'·'} {n.conf} {'·'} {wcSquad(n.code).length} players
                        </Text>
                        <Text style={[styles.rowExpect, { color: tintFor(n.rating) }]}>
                          Expected: {STAGE_NAME[expect]}
                        </Text>
                      </View>
                      <View style={[styles.rating, { borderColor: alpha(tintFor(n.rating), 0.55) }]}>
                        <Text
                          style={[styles.ratingText, { color: tintFor(n.rating) }]}
                          allowFontScaling={false}
                        >
                          {n.rating}
                        </Text>
                      </View>
                    </Press>
                  </Rise>
                );
              })
            : null}

          {term && ranked.length === 0 ? (
            <Text style={styles.none}>No nation by that name.</Text>
          ) : null}

          <View style={{ height: space.s6 }} />
        </ScrollView>
      </ModeScreen>

      <Confirm
        visible={taking !== null}
        title="Start again?"
        body="You have a World Cup on the go. Taking another nation throws it away."
        confirmLabel="Start again"
        cancelLabel="Keep it"
        onCancel={() => setTaking(null)}
        onConfirm={() => {
          const code = taking;
          setTaking(null);
          if (code) begin(code);
        }}
      />
    </>
  );
}

/**
 * One nation in the draw.
 *
 * The flag, the name, the rating and a bar showing where that rating
 * sits between the worst nation here and the best. A number on its own
 * says nothing next to another number; a bar next to three other bars
 * says which of the four is going through.
 */
function Tile({ code, onPress, best }: { code: string; onPress: () => void; best: boolean }) {
  const t = wcTeam(code);
  if (!t) return null;
  const tint = tintFor(t.r);
  /* Sixty five to eighty eight is the real spread of this field. */
  const frac = Math.max(0.06, Math.min(1, (t.r - 62) / 28));
  return (
    <Press
      onPress={onPress}
      feel="none"
      scaleTo={0.97}
      style={[styles.tile, best ? { borderColor: alpha(tint, 0.5) } : null]}
    >
      <View style={styles.tileTop}>
        <Text style={styles.tileFlag} allowFontScaling={false}>
          {t.f}
        </Text>
        <View style={styles.tileBody}>
          <Text style={styles.tileName} numberOfLines={1}>
            {t.n}
          </Text>
          <Text style={[styles.tileRate, { color: tint }]}>Rated {t.r}</Text>
        </View>
      </View>
      <View style={styles.tileBar}>
        <View style={[styles.tileFill, { width: `${frac * 100}%`, backgroundColor: tint }]} />
      </View>
    </Press>
  );
}

/** Contender, useful, hopeful, in a colour. */
function tintFor(rating: number): string {
  return rating >= 84 ? hue.gold : rating >= 78 ? hue.emerald : rating >= 72 ? hue.sky : color.text3;
}

const styles = StyleSheet.create({
  page: { flex: 1 },

  hero: {
    alignItems: 'center',
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: alpha(hue.gold, 0.28),
    backgroundColor: '#0C1210',
    overflow: 'hidden',
  },
  badge: {
    paddingHorizontal: space.s4,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha(hue.gold, 0.5),
    backgroundColor: alpha(hue.gold, 0.1),
    marginBottom: space.s3,
  },
  badgeText: { ...text.key, fontSize: 9, color: hue.gold },
  big: {
    fontFamily: font.displayBlack,
    fontSize: 52,
    lineHeight: 62,
    color: color.text1,
    letterSpacing: 1,
  },
  bigGold: { color: hue.gold },
  hosts: { ...text.small, fontSize: 13, lineHeight: 19, color: color.text2, marginTop: space.s2 },

  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    marginTop: space.s3,
    padding: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(hue.gold, 0.45),
    backgroundColor: alpha(hue.gold, 0.1),
  },
  resumeFlag: { fontSize: 34, lineHeight: 42 },
  resumeBody: { flex: 1, minWidth: 0 },
  resumeKey: { ...text.key, fontSize: 8, color: hue.gold },
  resumeName: { fontFamily: font.displayBold, fontSize: 18, lineHeight: 24, color: color.text1 },
  resumeNote: { ...text.small, fontSize: 11.5, lineHeight: 16, color: color.text2 },
  chev: { fontFamily: font.displayBold, fontSize: 22, color: hue.gold },

  door: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    marginTop: space.s4,
    padding: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(hue.emerald, 0.42),
    backgroundColor: alpha(hue.emerald, 0.1),
  },
  doorIcon: { fontSize: 30, lineHeight: 38 },
  doorBody: { flex: 1, minWidth: 0, gap: 1 },
  doorKey: { ...text.key, fontSize: 8, color: hue.emerald },
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

  tabs: { flexDirection: 'row', gap: space.s2, marginBottom: space.s3 },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tabOn: { borderColor: alpha(hue.gold, 0.5), backgroundColor: alpha(hue.gold, 0.12) },
  tabText: { ...text.key, fontSize: 9.5, color: color.text3 },
  tabTextOn: { color: hue.gold },

  search: {
    minHeight: 50,
    paddingHorizontal: space.s3,
    marginBottom: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: color.text1,
    fontFamily: font.bodySemi,
    fontSize: 16,
  },

  group: {
    marginBottom: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.025)',
    overflow: 'hidden',
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.s3,
    paddingHorizontal: space.s3,
    paddingVertical: space.s3,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    backgroundColor: alpha(hue.gold, 0.06),
  },
  groupName: { ...text.key, fontSize: 9.5, color: hue.gold, flex: 1 },
  groupFav: { ...text.small, fontSize: 11, lineHeight: 15, color: color.text3 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: space.s2,
    gap: '2%',
    rowGap: space.s2,
  },
  tile: {
    width: '49%',
    padding: space.s2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: space.s2,
  },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  tileFlag: { fontSize: 24, lineHeight: 30 },
  tileBody: { flex: 1, minWidth: 0 },
  tileName: { fontFamily: font.displayBold, fontSize: 14, lineHeight: 19, color: color.text1 },
  tileRate: { ...text.key, fontSize: 7.5 },
  tileBar: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  tileFill: { height: 3, borderRadius: 2 },

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
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  rank: {
    width: 22,
    fontFamily: font.displayBold,
    fontSize: 13,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  rowFlag: { fontSize: 28, lineHeight: 36 },
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
