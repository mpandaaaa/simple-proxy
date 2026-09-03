import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router, useFocusEffect } from 'expo-router';
import { ModeScreen, Press, Shine, ClubDisc } from '../src/ui/components';
import { color, space, radius, line, hue, alpha, positionColor } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { haptic } from '../src/ui/feel';
import {
  RARITY_ORDER,
  allSets,
  cardById,
  collectionCounts,
  cosmeticById,
  milestoneState,
  totals,
  MILESTONES,
  type Card,
  type Rarity,
} from '../src/engine';
import { collectionStore, looksStore, owned } from '../src/save';

/**
 * The collection.
 *
 * Eleven thousand footballers, at the club and in the season they
 * actually played, and the ones you have are the ones you have used. The
 * page is built around that: what you own comes first, in full colour,
 * and what you do not is still listed, because a collection that hides
 * what is missing is not a collection.
 */

type Tab = 'have' | 'sets' | 'goals';

export default function CollectionScreen() {
  const [coll, setColl] = useState(() => collectionStore.read());
  const [tab, setTab] = useState<Tab>('have');
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');

  useFocusEffect(
    useCallback(() => {
      setColl(collectionStore.read());
    }, []),
  );

  const have = useMemo(() => owned(coll), [coll]);
  const counts = collectionCounts(have);
  const all = totals();
  const frame = cosmeticById(looksStore.read().frame);

  const mine = useMemo(() => {
    const out: Card[] = [];
    for (const id of coll.cards) {
      const c = cardOf(id);
      if (c && (rarity === 'all' || c.rarity === rarity)) out.push(c);
    }
    return out.sort((a, b) => b.rtg - a.rtg || a.n.localeCompare(b.n));
  }, [coll.cards, rarity]);

  const sets = useMemo(() => allSets(have), [have]);

  return (
    <ModeScreen
      overline="Your game"
      title="Collection"
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
      {/* ---- how much of it there is ---- */}
      <View style={styles.head}>
        <Shine radius={radius.lg} group="panel" />
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

      <View style={styles.tabs}>
        {(['have', 'sets', 'goals'] as Tab[]).map((t) => (
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
              {t === 'have' ? 'Cards' : t === 'sets' ? 'Squads' : 'Goals'}
            </Text>
          </Press>
        ))}
      </View>

      {tab === 'have' ? (
        <>
          <View style={styles.filters}>
            {(['all', ...RARITY_ORDER] as (Rarity | 'all')[]).map((r) => (
              <Press
                key={r}
                onPress={() => {
                  haptic('light');
                  setRarity(r);
                }}
                feel="none"
                scaleTo={0.96}
                style={[
                  styles.filter,
                  rarity === r
                    ? { borderColor: r === 'all' ? color.text2 : rarityColour(r as Rarity) }
                    : null,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    rarity === r
                      ? { color: r === 'all' ? color.text1 : rarityColour(r as Rarity) }
                      : null,
                  ]}
                >
                  {r === 'all' ? 'All' : r}
                </Text>
              </Press>
            ))}
          </View>

          {mine.length === 0 ? (
            <Text style={styles.empty}>
              {coll.cards.length === 0
                ? 'Nothing yet. Finish a season and the eleven you picked are yours to keep.'
                : 'None of that rarity yet.'}
            </Text>
          ) : (
            <View style={styles.listBox}>
              <FlashList
                data={mine}
                keyExtractor={(c) => c.id}
                renderItem={({ item }) => (
                  <CardRow card={item} edge={frame?.a ?? line.card} wash={frame?.b ?? 'transparent'} />
                )}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}
        </>
      ) : null}

      {tab === 'sets' ? (
        <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
          <Text style={styles.note}>
            Collect a whole squad from one season. Finishing one pays coins,
            and the last man can always be bought by name in the shop.
          </Text>
          {sets.map((s) => (
            <View
              key={s.set.id}
              style={[styles.set, s.done ? { borderColor: alpha(hue.emerald, 0.5) } : null]}
            >
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
              <View style={styles.setBar}>
                <View
                  style={[
                    styles.setFill,
                    {
                      width: `${s.total ? Math.round((s.owned / s.total) * 100) : 0}%`,
                      backgroundColor: s.done ? hue.emerald : hue.violet,
                    },
                  ]}
                />
              </View>
              <View style={styles.setNames}>
                {s.cards.map((c) => (
                  <Text
                    key={c.id}
                    style={[
                      styles.setPlayer,
                      have.has(c.id) ? { color: color.text1 } : null,
                    ]}
                    numberOfLines={1}
                  >
                    {c.n}
                  </Text>
                ))}
              </View>
              <Text style={styles.setPay}>
                {s.done ? 'Finished' : `Worth ${s.set.coins} coins`}
              </Text>
            </View>
          ))}
          <View style={{ height: space.s6 }} />
        </ScrollView>
      ) : null}

      {tab === 'goals' ? (
        <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
          <Text style={styles.note}>
            The long ones. Nothing here has to be bought: every card you draft
            into a finished XI counts towards all of it.
          </Text>
          {MILESTONES.map((m) => {
            const st = milestoneState(m, have);
            return (
              <View
                key={m.id}
                style={[styles.goal, st.done ? { borderColor: alpha(hue.emerald, 0.5) } : null]}
              >
                <View style={styles.goalTop}>
                  <View style={styles.goalBody}>
                    <Text style={styles.goalName}>{m.name}</Text>
                    <Text style={styles.goalBlurb}>{m.blurb}</Text>
                  </View>
                  <Text
                    style={[styles.goalCount, st.done ? { color: hue.emerald } : null]}
                    allowFontScaling={false}
                  >
                    {st.owned}
                    <Text style={styles.setOf}> / {m.need}</Text>
                  </Text>
                </View>
                <View style={styles.setBar}>
                  <View
                    style={[
                      styles.setFill,
                      {
                        width: `${Math.round((st.owned / m.need) * 100)}%`,
                        backgroundColor: st.done ? hue.emerald : hue.amber,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.setPay}>{st.done ? 'Finished' : `Worth ${m.coins} coins`}</Text>
              </View>
            );
          })}
          <View style={{ height: space.s6 }} />
        </ScrollView>
      ) : null}
    </ModeScreen>
  );
}

/* The lookup is a map built once inside the engine, so calling it for
   every card in a long list costs nothing. */
function cardOf(id: string): Card | null {
  return cardById(id);
}

function rarityColour(r: Rarity): string {
  return r === 'icon' ? hue.violet : r === 'gold' ? hue.gold : r === 'silver' ? '#B9C6CE' : '#B87333';
}

function CardRow({ card, edge, wash }: { card: Card; edge: string; wash: string }) {
  const pos = (Array.isArray(card.pos) ? card.pos[0] : card.pos) as string;
  return (
    <View style={[styles.card, { borderColor: edge, backgroundColor: wash }]}>
      <View style={[styles.cardRarity, { backgroundColor: rarityColour(card.rarity) }]} />
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>
          {card.n}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          <Text style={{ color: positionColor[pos as 'GK'] ?? color.text3 }}>{pos}</Text>
          {`  ${card.club} · ${card.season}`}
        </Text>
      </View>
      <Text style={[styles.cardRtg, { color: rarityColour(card.rarity) }]} allowFontScaling={false}>
        {card.rtg}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  countChip: {
    minWidth: 46,
    height: 34,
    paddingHorizontal: space.s2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  countChipText: {
    fontFamily: font.displayBlack,
    fontSize: 15,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },

  head: {
    flexDirection: 'row',
    paddingVertical: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#0D1610',
    overflow: 'hidden',
  },
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
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tabOn: { borderColor: alpha(hue.emerald, 0.5), backgroundColor: alpha(hue.emerald, 0.12) },
  tabText: { ...text.key, fontSize: 9, color: color.text3 },
  tabTextOn: { color: hue.emerald },

  filters: { flexDirection: 'row', gap: 5, marginBottom: space.s3 },
  filter: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterText: { ...text.key, fontSize: 7.5, color: color.text3 },

  listBox: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 58,
    marginBottom: 5,
    paddingRight: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardRarity: { width: 4, alignSelf: 'stretch' },
  cardBody: { flex: 1, minWidth: 0, paddingVertical: space.s2 },
  cardName: { fontFamily: font.displayBold, fontSize: 15, lineHeight: 20, color: color.text1 },
  cardMeta: { ...text.small, fontSize: 11, lineHeight: 16, color: color.text3 },
  cardRtg: {
    fontFamily: font.displayBlack,
    fontSize: 20,
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
  },

  empty: { ...text.small, fontSize: 13, lineHeight: 19, color: color.text3, paddingTop: space.s4 },
  note: { ...text.small, fontSize: 12, lineHeight: 18, color: color.text3, marginBottom: space.s3 },

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
  setBar: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  setFill: { height: 5, borderRadius: 3 },
  setNames: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  setPlayer: { ...text.small, fontSize: 11, lineHeight: 16, color: 'rgba(110,126,116,0.7)' },
  setPay: { ...text.key, fontSize: 8, color: color.text3 },

  goal: {
    marginBottom: space.s3,
    padding: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: space.s2,
  },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  goalBody: { flex: 1, minWidth: 0 },
  goalName: { fontFamily: font.displayBold, fontSize: 15, lineHeight: 20, color: color.text1 },
  goalBlurb: { ...text.small, fontSize: 11.5, lineHeight: 16, color: color.text3 },
  goalCount: {
    fontFamily: font.displayBlack,
    fontSize: 19,
    lineHeight: 25,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
});
