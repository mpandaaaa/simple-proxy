import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ModeScreen, Press, Rise, Shine, Sheet } from '../src/ui/components';
import { color, space, radius, line, hue, alpha } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { haptic } from '../src/ui/feel';
import { sfx } from '../src/ui/sound';
import {
  PACKS,
  allCards,
  cosmeticsOfKind,
  priceOf,
  unlockedByLevel,
  type Card,
  type Cosmetic,
  type CosmeticKind,
  type Rarity,
} from '../src/engine';
import { collectionStore, looksStore, progressStore, owned } from '../src/save';
import { buyCard, buyCosmetic, buyPack, equip, hasCosmetic } from '../src/game/progress';

/**
 * The shop.
 *
 * Coins come from playing and from nowhere else. There is nothing to buy
 * with money, there never will be, and everything in here is either a
 * footballer for the collection or paint. Nothing on this page can win
 * anybody a match, which is the whole reason it is allowed to exist in a
 * game whose Daily has to be the same puzzle for everybody.
 */

type Tab = 'packs' | 'named' | 'looks';

export default function Shop() {
  const [p, setP] = useState(() => progressStore.read());
  const [coll, setColl] = useState(() => collectionStore.read());
  const [looks, setLooks] = useState(() => looksStore.read());
  const [tab, setTab] = useState<Tab>('packs');
  const [pulled, setPulled] = useState<Card[] | null>(null);
  const [find, setFind] = useState('');
  const [said, setSaid] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setP(progressStore.read());
    setColl(collectionStore.read());
    setLooks(looksStore.read());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      setSaid(null);
    }, [refresh]),
  );

  const have = useMemo(() => owned(coll), [coll]);

  const open = useCallback(
    (id: string, free: boolean, price: number) => {
      if (!free && p.coins < price) {
        haptic('warning');
        setSaid('Not enough coins for that one yet.');
        return;
      }
      const got = buyPack(id, free);
      if (!got.ok) {
        haptic('warning');
        setSaid(got.why === 'coins' ? 'Not enough coins for that one yet.' : 'That pack is gone.');
        return;
      }
      haptic('success');
      sfx('pick');
      setPulled(got.cards);
      refresh();
    },
    [p.coins, refresh],
  );

  /* The named market. Searching eleven thousand names on every keystroke
     is fine because the list is built once and the filter is a string
     compare, but the result is capped so a single letter does not try to
     draw four thousand rows. */
  const found = useMemo(() => {
    const q = find.trim().toLowerCase();
    if (q.length < 3) return [];
    const out: Card[] = [];
    for (const c of allCards()) {
      if (out.length >= 40) break;
      if (c.n.toLowerCase().includes(q)) out.push(c);
    }
    return out;
  }, [find]);

  return (
    <>
      <ModeScreen
        overline="Your game"
        title="Shop"
        scroll={false}
        onBack={() => router.back()}
        right={
          <View style={styles.purse}>
            <Text style={styles.purseText} allowFontScaling={false}>
              {p.coins}
            </Text>
          </View>
        }
      >
        <View style={styles.tabs}>
          {(['packs', 'named', 'looks'] as Tab[]).map((t) => (
            <Press
              key={t}
              onPress={() => {
                haptic('light');
                setTab(t);
                setSaid(null);
              }}
              feel="none"
              scaleTo={0.98}
              style={[styles.tab, tab === t ? styles.tabOn : null]}
            >
              <Text style={[styles.tabText, tab === t ? styles.tabTextOn : null]}>
                {t === 'packs' ? 'Packs' : t === 'named' ? 'By name' : 'Looks'}
              </Text>
            </Press>
          ))}
        </View>

        {said ? <Text style={styles.said}>{said}</Text> : null}

        <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
          {tab === 'packs' ? (
            <>
              {coll.owed.length ? (
                <Rise delay={0}>
                  <View style={styles.owed}>
                    <Text style={styles.owedKey}>Waiting for you</Text>
                    <Text style={styles.owedNote}>
                      {coll.owed.length === 1
                        ? 'A pack from a level you reached.'
                        : `${coll.owed.length} packs from levels you reached.`}
                    </Text>
                    {coll.owed.map((id, i) => {
                      const pack = PACKS.find((x) => x.id === id);
                      if (!pack) return null;
                      return (
                        <Press
                          key={`${id}-${i}`}
                          onPress={() => open(id, true, 0)}
                          feel="medium"
                          scaleTo={0.98}
                          style={styles.owedGo}
                        >
                          <Text style={styles.owedGoText}>Open the {pack.name}</Text>
                        </Press>
                      );
                    })}
                  </View>
                </Rise>
              ) : null}

              <Text style={styles.note}>
                A pack goes looking for somebody you have not got before it
                settles for somebody you have.
              </Text>
              {PACKS.map((pack) => {
                const can = p.coins >= pack.price;
                return (
                  <View key={pack.id} style={styles.pack}>
                    <Shine radius={radius.lg} group="panel" />
                    <View style={styles.packTop}>
                      <View style={styles.packBody}>
                        <Text style={styles.packName}>{pack.name}</Text>
                        <Text style={styles.packBlurb}>{pack.blurb}</Text>
                      </View>
                      <Text
                        style={[styles.packPrice, !can ? { color: color.text3 } : null]}
                        allowFontScaling={false}
                      >
                        {pack.price}
                      </Text>
                    </View>
                    <View style={styles.odds}>
                      {(['icon', 'gold', 'silver', 'bronze'] as Rarity[]).map((r) => (
                        <View key={r} style={styles.odd}>
                          <Text style={[styles.oddValue, { color: rarityColour(r) }]}>
                            {Math.round(pack.odds[r] * 1000) / 10}%
                          </Text>
                          <Text style={styles.oddLabel}>{r}</Text>
                        </View>
                      ))}
                    </View>
                    <Press
                      onPress={() => open(pack.id, false, pack.price)}
                      feel={can ? 'medium' : 'warning'}
                      scaleTo={0.98}
                      style={[styles.buy, !can ? styles.buyOff : null]}
                    >
                      <Text style={[styles.buyText, !can ? { color: color.text3 } : null]}>
                        {can ? `Open for ${pack.price}` : `${pack.price - p.coins} coins short`}
                      </Text>
                    </Press>
                  </View>
                );
              })}
            </>
          ) : null}

          {tab === 'named' ? (
            <>
              <Text style={styles.note}>
                For the squad that is one man short. Buying by name always
                costs more than a pack would, so a pack is the value and this
                is the certainty.
              </Text>
              <TextInput
                value={find}
                onChangeText={setFind}
                placeholder="Search a footballer"
                placeholderTextColor={color.text3}
                autoCorrect={false}
                style={styles.search}
              />
              {find.trim().length > 0 && find.trim().length < 3 ? (
                <Text style={styles.note}>Three letters or more.</Text>
              ) : null}
              {found.map((c) => {
                const mine = have.has(c.id);
                const price = priceOf(c);
                const can = p.coins >= price;
                return (
                  <View key={c.id} style={styles.namedRow}>
                    <View style={[styles.cardRarity, { backgroundColor: rarityColour(c.rarity) }]} />
                    <View style={styles.namedBody}>
                      <Text style={styles.namedName} numberOfLines={1}>
                        {c.n}
                      </Text>
                      <Text style={styles.namedMeta} numberOfLines={1}>
                        {c.club} {'·'} {c.season} {'·'} rated {c.rtg}
                      </Text>
                    </View>
                    {mine ? (
                      <Text style={styles.namedHave}>yours</Text>
                    ) : (
                      <Press
                        onPress={() => {
                          const got = buyCard(c.id);
                          if (!got.ok) {
                            haptic('warning');
                            setSaid(
                              got.why === 'coins'
                                ? 'Not enough coins for him yet.'
                                : 'He is already yours.',
                            );
                            return;
                          }
                          haptic('success');
                          sfx('pick');
                          setPulled(got.cards);
                          refresh();
                        }}
                        feel={can ? 'medium' : 'warning'}
                        scaleTo={0.97}
                        style={[styles.namedBuy, !can ? styles.buyOff : null]}
                      >
                        <Text
                          style={[styles.namedBuyText, !can ? { color: color.text3 } : null]}
                          allowFontScaling={false}
                        >
                          {price}
                        </Text>
                      </Press>
                    )}
                  </View>
                );
              })}
              {find.trim().length >= 3 && found.length === 0 ? (
                <Text style={styles.note}>Nobody by that name.</Text>
              ) : null}
            </>
          ) : null}

          {tab === 'looks' ? (
            <>
              <Text style={styles.note}>
                Paint, and nothing else. A frame changes how a card is drawn,
                a pitch changes what the draft is played on, and a title is
                the only one anybody else ever sees.
              </Text>
              {(['frame', 'pitch', 'title'] as CosmeticKind[]).map((kind) => (
                <View key={kind}>
                  <Text style={[text.label, styles.sect]}>
                    {kind === 'frame' ? 'Card frames' : kind === 'pitch' ? 'Pitches' : 'Titles'}
                  </Text>
                  {cosmeticsOfKind(kind).map((c) => (
                    <LookRow
                      key={c.id}
                      item={c}
                      level={p.lvl}
                      on={looks[kind] === c.id}
                      coins={p.coins}
                      onPress={() => {
                        if (hasCosmetic(c.id)) {
                          haptic('light');
                          equip(c.id);
                          refresh();
                          return;
                        }
                        if (c.price <= 0) {
                          haptic('warning');
                          setSaid(`That one arrives at level ${c.level}.`);
                          return;
                        }
                        const got = buyCosmetic(c.id);
                        if (!got.ok) {
                          haptic('warning');
                          setSaid('Not enough coins for that yet.');
                          return;
                        }
                        haptic('success');
                        sfx('pick');
                        equip(c.id);
                        refresh();
                      }}
                    />
                  ))}
                </View>
              ))}
            </>
          ) : null}

          <View style={{ height: space.s6 }} />
        </ScrollView>
      </ModeScreen>

      {/* what came out of it */}
      <Sheet visible={pulled !== null} onClose={() => setPulled(null)}>
        <View style={styles.pull}>
          <Text style={styles.pullTitle}>
            {pulled && pulled.length === 1 ? 'Signed' : 'What was in it'}
          </Text>
          {(pulled ?? []).map((c) => (
            <View key={c.id} style={[styles.pullRow, { borderColor: rarityColour(c.rarity) }]}>
              <View style={[styles.cardRarity, { backgroundColor: rarityColour(c.rarity) }]} />
              <View style={styles.namedBody}>
                <Text style={styles.namedName} numberOfLines={1}>
                  {c.n}
                </Text>
                <Text style={styles.namedMeta} numberOfLines={1}>
                  {c.club} {'·'} {c.season}
                </Text>
              </View>
              <Text
                style={[styles.pullRtg, { color: rarityColour(c.rarity) }]}
                allowFontScaling={false}
              >
                {c.rtg}
              </Text>
            </View>
          ))}
          <Press
            onPress={() => setPulled(null)}
            feel="light"
            scaleTo={0.98}
            style={styles.pullDone}
          >
            <Text style={styles.pullDoneText}>Into the collection</Text>
          </Press>
        </View>
      </Sheet>
    </>
  );
}

function LookRow({
  item,
  level,
  on,
  coins,
  onPress,
}: {
  item: Cosmetic;
  level: number;
  on: boolean;
  coins: number;
  onPress: () => void;
}) {
  const byLevel = unlockedByLevel(item, level);
  const mine = hasCosmetic(item.id);
  const locked = !mine && item.price <= 0;
  const canBuy = !mine && item.price > 0 && coins >= item.price;

  return (
    <Press
      onPress={onPress}
      feel="none"
      scaleTo={0.99}
      style={[styles.look, on ? { borderColor: hue.emerald } : null]}
    >
      <View
        style={[
          styles.swatch,
          item.kind === 'title'
            ? { backgroundColor: 'transparent', borderColor: item.a }
            : { backgroundColor: item.a, borderColor: item.a },
        ]}
      >
        {item.kind === 'title' ? (
          <Text style={[styles.swatchLetter, { color: item.a }]}>T</Text>
        ) : null}
      </View>
      <View style={styles.lookBody}>
        <Text style={styles.lookName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.lookBlurb} numberOfLines={1}>
          {item.blurb}
        </Text>
      </View>
      <Text
        style={[
          styles.lookState,
          on
            ? { color: hue.emerald }
            : mine
              ? { color: color.text2 }
              : canBuy
                ? { color: hue.gold }
                : { color: color.text3 },
        ]}
        allowFontScaling={false}
      >
        {on
          ? 'ON'
          : mine
            ? 'WEAR'
            : locked
              ? `LVL ${item.level}`
              : String(item.price)}
      </Text>
    </Press>
  );
}

function rarityColour(r: Rarity): string {
  return r === 'icon' ? hue.violet : r === 'gold' ? hue.gold : r === 'silver' ? '#B9C6CE' : '#B87333';
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  purse: {
    minWidth: 56,
    height: 34,
    paddingHorizontal: space.s2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.gold, 0.4),
    backgroundColor: alpha(hue.gold, 0.1),
  },
  purseText: {
    fontFamily: font.displayBlack,
    fontSize: 15,
    color: hue.gold,
    fontVariant: ['tabular-nums'],
  },

  tabs: { flexDirection: 'row', gap: space.s2, marginBottom: space.s3 },
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
  tabOn: { borderColor: alpha(hue.gold, 0.5), backgroundColor: alpha(hue.gold, 0.12) },
  tabText: { ...text.key, fontSize: 9, color: color.text3 },
  tabTextOn: { color: hue.gold },
  said: { ...text.small, fontSize: 12.5, color: hue.amber, marginBottom: space.s2 },
  note: { ...text.small, fontSize: 12, lineHeight: 18, color: color.text3, marginBottom: space.s3 },
  sect: { marginTop: space.s4, marginBottom: space.s2 },

  owed: {
    padding: space.s3,
    marginBottom: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(hue.sky, 0.45),
    backgroundColor: alpha(hue.sky, 0.09),
    gap: space.s2,
  },
  owedKey: { ...text.key, fontSize: 9, color: hue.sky },
  owedNote: { ...text.small, fontSize: 12, lineHeight: 17, color: color.text2 },
  owedGo: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.sky, 0.6),
    backgroundColor: alpha(hue.sky, 0.16),
  },
  owedGoText: { ...text.button, fontSize: 14, color: hue.sky },

  pack: {
    marginBottom: space.s3,
    padding: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.035)',
    overflow: 'hidden',
    gap: space.s2,
  },
  packTop: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  packBody: { flex: 1, minWidth: 0 },
  packName: { fontFamily: font.displayBold, fontSize: 16, lineHeight: 21, color: color.text1 },
  packBlurb: { ...text.small, fontSize: 11.5, lineHeight: 16, color: color.text3 },
  packPrice: {
    fontFamily: font.displayBlack,
    fontSize: 22,
    lineHeight: 28,
    color: hue.gold,
    fontVariant: ['tabular-nums'],
  },
  odds: { flexDirection: 'row' },
  odd: { flex: 1, alignItems: 'center' },
  oddValue: {
    fontFamily: font.displayBold,
    fontSize: 12,
    lineHeight: 17,
    fontVariant: ['tabular-nums'],
  },
  oddLabel: { ...text.key, fontSize: 7, color: color.text3 },
  buy: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.gold, 0.5),
    backgroundColor: alpha(hue.gold, 0.14),
  },
  buyOff: { borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
  buyText: { ...text.button, fontSize: 14, color: hue.gold },

  search: {
    minHeight: 52,
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
  namedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 58,
    marginBottom: 5,
    paddingRight: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  cardRarity: { width: 4, alignSelf: 'stretch' },
  namedBody: { flex: 1, minWidth: 0, paddingVertical: space.s2 },
  namedName: { fontFamily: font.displayBold, fontSize: 15, lineHeight: 20, color: color.text1 },
  namedMeta: { ...text.small, fontSize: 11, lineHeight: 16, color: color.text3 },
  namedHave: { ...text.key, fontSize: 8, color: hue.emerald },
  namedBuy: {
    minWidth: 62,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: alpha(hue.gold, 0.5),
    backgroundColor: alpha(hue.gold, 0.12),
  },
  namedBuyText: {
    fontFamily: font.displayBold,
    fontSize: 13,
    color: hue.gold,
    fontVariant: ['tabular-nums'],
  },

  look: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 56,
    marginBottom: 5,
    paddingHorizontal: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchLetter: { fontFamily: font.displayBlack, fontSize: 13 },
  lookBody: { flex: 1, minWidth: 0 },
  lookName: { fontFamily: font.displayBold, fontSize: 14.5, lineHeight: 19, color: color.text1 },
  lookBlurb: { ...text.small, fontSize: 11, lineHeight: 15, color: color.text3 },
  lookState: { ...text.key, fontSize: 8.5, fontVariant: ['tabular-nums'] },

  pull: { paddingHorizontal: space.s4, paddingTop: space.s4, paddingBottom: space.s6, gap: space.s2 },
  pullTitle: {
    fontFamily: font.displayBlack,
    fontSize: 22,
    lineHeight: 29,
    color: color.text1,
    marginBottom: space.s2,
  },
  pullRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 58,
    paddingRight: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  pullRtg: {
    fontFamily: font.displayBlack,
    fontSize: 20,
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
  },
  pullDone: {
    marginTop: space.s3,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pullDoneText: { ...text.button, fontSize: 14, color: color.text2 },
});
