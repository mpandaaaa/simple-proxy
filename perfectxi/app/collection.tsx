import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ModeScreen, Press, Rise, Shine, ClubDisc } from '../src/ui/components';
import { color, space, radius, line, hue, alpha } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { haptic } from '../src/ui/feel';
import {
  RARITY_ORDER,
  allSets,
  bestOwned,
  clubRows,
  collectionCounts,
  milestoneState,
  totals,
  MILESTONES,
  type Card,
  type Rarity,
} from '../src/engine';
import { collectionStore, owned } from '../src/save';

/**
 * The album.
 *
 * A sticker book, not a spreadsheet. Fifty one clubs, each one a page,
 * every season of them on it, and the gaps left in. A collection that
 * hides what is missing is a list of things you happen to have, and the
 * gaps are the entire reason anybody opens it again.
 *
 * Two taps deep and no further. Clubs here, one club's whole history on
 * the next screen, and nothing below that.
 */

type Tab = 'album' | 'squads' | 'goals';

export function rarityColour(r: Rarity): string {
  return r === 'icon' ? hue.violet : r === 'gold' ? hue.gold : r === 'silver' ? '#B9C6CE' : '#B87333';
}

export default function CollectionScreen() {
  const [coll, setColl] = useState(() => collectionStore.read());
  const [tab, setTab] = useState<Tab>('album');

  useFocusEffect(
    useCallback(() => {
      setColl(collectionStore.read());
    }, []),
  );

  const have = useMemo(() => owned(coll), [coll]);
  const counts = collectionCounts(have);
  const all = totals();
  const clubs = useMemo(() => clubRows(have), [have]);
  const best = useMemo(() => bestOwned(have, 12), [have]);
  const sets = useMemo(() => allSets(have), [have]);

  const startedClubs = clubs.filter((c) => c.owned > 0).length;

  return (
    <ModeScreen
      overline="Your game"
      title="The album"
      scroll={false}
      onBack={() => router.back()}
      right={
        <View style={styles.countChip}>
          <Text style={styles.countChipText} allowFontScaling={false}>
            {counts.all}
          </Text>
        </View>
      }
    >
      {/* ---- the spine ---- */}
      <View style={styles.head}>
        <Shine radius={radius.lg} group="panel" />
        <View style={styles.headBar}>
          {RARITY_ORDER.map((r) =>
            counts[r] > 0 ? (
              <View
                key={r}
                style={{ flex: counts[r], height: 6, backgroundColor: rarityColour(r) }}
              />
            ) : null,
          )}
          {counts.all === 0 ? <View style={styles.headEmpty} /> : null}
        </View>
        <View style={styles.headRow}>
          {RARITY_ORDER.map((r) => (
            <View key={r} style={styles.headCell}>
              <Text style={[styles.headValue, { color: rarityColour(r) }]} allowFontScaling={false}>
                {counts[r]}
              </Text>
              <Text style={styles.headLabel}>
                {r} {'·'} {all[r]}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.tabs}>
        {(['album', 'squads', 'goals'] as Tab[]).map((t) => (
          <Press
            key={t}
            onPress={() => {
              haptic('light');
              setTab(t);
            }}
            feel="none"
            scaleTo={0.98}
            style={[styles.tab, tab === t ? styles.tabOn : null]}
          >
            <Text style={[styles.tabText, tab === t ? styles.tabTextOn : null]}>
              {t === 'album' ? 'Clubs' : t === 'squads' ? 'Squads' : 'Goals'}
            </Text>
          </Press>
        ))}
      </View>

      {/* ================= clubs ================= */}
      {tab === 'album' ? (
        <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
          {best.length ? (
            <>
              <Text style={[text.label, styles.sectFirst]}>Your best</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.shelf}
              >
                {best.map((c) => (
                  <MiniCard key={c.id} card={c} />
                ))}
              </ScrollView>
            </>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyBig}>The album is empty</Text>
              <Text style={styles.emptyText}>
                Finish a season and the eleven footballers you picked are yours
                for good. Packs fill in the rest.
              </Text>
            </View>
          )}

          <Text style={[text.label, styles.sect]}>
            Clubs {'·'} {startedClubs} of {clubs.length} started
          </Text>
          {clubs.map((row, i) => (
            <Rise key={row.club} delay={Math.min(i, 6)}>
              <Press
                onPress={() => {
                  haptic('light');
                  router.push({ pathname: '/album', params: { club: row.club } });
                }}
                feel="none"
                scaleTo={0.99}
                style={[
                  styles.club,
                  row.owned === row.total ? { borderColor: alpha(hue.emerald, 0.5) } : null,
                ]}
              >
                <ClubDisc club={row.club} size={38} />
                <View style={styles.clubBody}>
                  <Text style={styles.clubName} numberOfLines={1}>
                    {row.club}
                  </Text>
                  <Text style={styles.clubMeta} numberOfLines={1}>
                    {row.best
                      ? `Best: ${row.best.n} ${row.best.rtg}`
                      : `${row.seasons} seasons, none of them yet`}
                  </Text>
                  <View style={styles.clubBar}>
                    <View
                      style={[
                        styles.clubFill,
                        {
                          width: `${Math.max(row.owned ? 2 : 0, (row.owned / row.total) * 100)}%`,
                          backgroundColor: row.owned === row.total ? hue.emerald : hue.violet,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={styles.clubCount} allowFontScaling={false}>
                  {row.owned}
                  <Text style={styles.clubOf}> / {row.total}</Text>
                </Text>
              </Press>
            </Rise>
          ))}
          <View style={{ height: space.s6 }} />
        </ScrollView>
      ) : null}

      {/* ================= squads ================= */}
      {tab === 'squads' ? (
        <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
          <Text style={styles.note}>
            Twenty four sides worth collecting whole. Every card comes from
            drafting or from a pack.
          </Text>
          {sets.map((s, i) => (
            <Rise key={s.set.id} delay={Math.min(i, 6)}>
              <View style={[styles.set, s.done ? { borderColor: alpha(hue.emerald, 0.5) } : null]}>
                <View style={styles.setTop}>
                  <ClubDisc club={s.set.club} size={34} />
                  <View style={styles.setBody}>
                    <Text style={styles.setName} numberOfLines={1}>
                      {s.set.name}
                    </Text>
                    <Text style={styles.setBlurb} numberOfLines={2}>
                      {s.set.blurb}
                    </Text>
                  </View>
                  <Text
                    style={[styles.setCount, s.done ? { color: hue.emerald } : null]}
                    allowFontScaling={false}
                  >
                    {s.owned}
                    <Text style={styles.setOf}> / {s.total}</Text>
                  </Text>
                </View>

                {/* one pip a footballer, so a squad reads at a glance */}
                <View style={styles.pips}>
                  {s.cards.map((c) => (
                    <View
                      key={c.id}
                      style={[
                        styles.pip,
                        have.has(c.id)
                          ? { backgroundColor: rarityColour(c.rarity), borderColor: 'transparent' }
                          : null,
                      ]}
                    />
                  ))}
                </View>

                <Text style={styles.setPay}>
                  {s.done ? 'Finished' : `${s.total - s.owned} to go, worth ${s.set.coins} coins`}
                </Text>
              </View>
            </Rise>
          ))}
          <View style={{ height: space.s6 }} />
        </ScrollView>
      ) : null}

      {/* ================= goals ================= */}
      {tab === 'goals' ? (
        <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
          <Text style={styles.note}>
            The long ones. Every footballer you draft into a finished XI counts
            towards all of them.
          </Text>
          {MILESTONES.map((m, i) => {
            const st = milestoneState(m, have);
            return (
              <Rise key={m.id} delay={Math.min(i, 6)}>
                <View
                  style={[styles.set, st.done ? { borderColor: alpha(hue.emerald, 0.5) } : null]}
                >
                  <View style={styles.setTop}>
                    <View style={styles.setBody}>
                      <Text style={styles.setName}>{m.name}</Text>
                      <Text style={styles.setBlurb}>{m.blurb}</Text>
                    </View>
                    <Text
                      style={[styles.setCount, st.done ? { color: hue.emerald } : null]}
                      allowFontScaling={false}
                    >
                      {st.owned}
                      <Text style={styles.setOf}> / {m.need}</Text>
                    </Text>
                  </View>
                  <View style={styles.clubBar}>
                    <View
                      style={[
                        styles.clubFill,
                        {
                          width: `${Math.round((st.owned / m.need) * 100)}%`,
                          backgroundColor: st.done ? hue.emerald : hue.amber,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.setPay}>
                    {st.done ? 'Finished' : `Worth ${m.coins} coins`}
                  </Text>
                </View>
              </Rise>
            );
          })}
          <View style={{ height: space.s6 }} />
        </ScrollView>
      ) : null}
    </ModeScreen>
  );
}

function MiniCard({ card }: { card: Card }) {
  const tint = rarityColour(card.rarity);
  return (
    <View style={[styles.mini, { borderColor: tint, backgroundColor: alpha(tint, 0.1) }]}>
      <Text style={[styles.miniRtg, { color: tint }]} allowFontScaling={false}>
        {card.rtg}
      </Text>
      <Text style={styles.miniName} numberOfLines={2}>
        {card.n}
      </Text>
      <Text style={styles.miniMeta} numberOfLines={1}>
        {card.season}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  countChip: {
    minWidth: 50,
    height: 34,
    paddingHorizontal: space.s2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.violet, 0.4),
    backgroundColor: alpha(hue.violet, 0.1),
  },
  countChipText: {
    fontFamily: font.displayBlack,
    fontSize: 15,
    color: hue.violet,
    fontVariant: ['tabular-nums'],
  },

  head: {
    paddingVertical: space.s3,
    paddingHorizontal: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#0D1610',
    overflow: 'hidden',
    gap: space.s3,
  },
  headBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  headEmpty: { flex: 1, height: 6 },
  headRow: { flexDirection: 'row' },
  headCell: { flex: 1, alignItems: 'center', gap: 1 },
  headValue: {
    fontFamily: font.displayBlack,
    fontSize: 20,
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
  },
  headLabel: { ...text.key, fontSize: 7, color: color.text3 },

  tabs: { flexDirection: 'row', gap: space.s2, marginTop: space.s3, marginBottom: space.s3 },
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
  tabOn: { borderColor: alpha(hue.violet, 0.5), backgroundColor: alpha(hue.violet, 0.12) },
  tabText: { ...text.key, fontSize: 9.5, color: color.text3 },
  tabTextOn: { color: hue.violet },

  sectFirst: { marginBottom: space.s2 },
  sect: { marginTop: space.s5, marginBottom: space.s2 },
  note: { ...text.small, fontSize: 12, lineHeight: 18, color: color.text3, marginBottom: space.s3 },

  shelf: { gap: space.s2, paddingRight: space.s4 },
  mini: {
    width: 92,
    paddingVertical: space.s3,
    paddingHorizontal: space.s2,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 1,
  },
  miniRtg: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 32,
    fontVariant: ['tabular-nums'],
  },
  miniName: {
    fontFamily: font.bodySemi,
    fontSize: 11.5,
    lineHeight: 15,
    color: color.text1,
    textAlign: 'center',
  },
  miniMeta: { ...text.small, fontSize: 10, lineHeight: 14, color: color.text3 },

  empty: {
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.16)',
    gap: space.s2,
  },
  emptyBig: { fontFamily: font.displayBlack, fontSize: 20, lineHeight: 26, color: color.text1 },
  emptyText: { ...text.small, fontSize: 12.5, lineHeight: 18, color: color.text3 },

  club: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 72,
    marginBottom: 6,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  clubBody: { flex: 1, minWidth: 0, gap: 3 },
  clubName: { fontFamily: font.displayBold, fontSize: 15.5, lineHeight: 20, color: color.text1 },
  clubMeta: { ...text.small, fontSize: 11, lineHeight: 15, color: color.text3 },
  clubBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  clubFill: { height: 4, borderRadius: 2 },
  clubCount: {
    fontFamily: font.displayBlack,
    fontSize: 17,
    lineHeight: 22,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  clubOf: { fontSize: 11, color: color.text3 },

  set: {
    marginBottom: space.s3,
    padding: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: space.s2,
  },
  setTop: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  setBody: { flex: 1, minWidth: 0 },
  setName: { fontFamily: font.displayBold, fontSize: 15, lineHeight: 20, color: color.text1 },
  setBlurb: { ...text.small, fontSize: 11.5, lineHeight: 16, color: color.text3 },
  setCount: {
    fontFamily: font.displayBlack,
    fontSize: 19,
    lineHeight: 25,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  setOf: { fontSize: 12, color: color.text3 },
  setPay: { ...text.key, fontSize: 8, color: color.text3 },

  pips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  pip: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'transparent',
  },
});
