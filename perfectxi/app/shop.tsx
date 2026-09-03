import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ModeScreen, Press, Rise, Shine, PackOpen } from '../src/ui/components';
import { color, space, radius, line, hue, alpha } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { haptic } from '../src/ui/feel';
import { sfx } from '../src/ui/sound';
import {
  PACKS,
  cosmeticsOfKind,
  packById,
  type Card,
  type Cosmetic,
  type CosmeticKind,
  type Rarity,
} from '../src/engine';
import { collectionStore, looksStore, progressStore } from '../src/save';
import { buyCosmetic, buyPack, equip, hasCosmetic } from '../src/game/progress';

/**
 * The shop.
 *
 * Coins come from playing and from nowhere else. There is nothing to buy
 * with money, there never will be, and everything in here is either a
 * pack of footballers or paint. Nothing on this page can win anybody a
 * match, which is the whole reason it is allowed to exist in a game
 * whose Daily has to be the same puzzle for everybody.
 *
 * Two tabs. Buying a named footballer used to be a third and is gone:
 * paying to put an exact name straight into the album turns collecting
 * into shopping, and the whole point of the thing is that the album
 * fills up because of who you picked.
 */

type Tab = 'packs' | 'looks';

export default function Shop() {
  const [p, setP] = useState(() => progressStore.read());
  const [coll, setColl] = useState(() => collectionStore.read());
  const [looks, setLooks] = useState(() => looksStore.read());
  const [tab, setTab] = useState<Tab>('packs');
  const [pulled, setPulled] = useState<{ cards: Card[]; title: string } | null>(null);
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

  const open = useCallback(
    (id: string, free: boolean) => {
      const pack = packById(id);
      if (!pack) return;
      const got = buyPack(id, free);
      if (!got.ok) {
        haptic('warning');
        setSaid(
          got.why === 'coins'
            ? `${pack.price - p.coins} coins short of that one.`
            : 'That pack has gone.',
        );
        return;
      }
      haptic('medium');
      sfx('tick');
      setSaid(null);
      setPulled({ cards: got.cards, title: pack.name });
      refresh();
    },
    [p.coins, refresh],
  );

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
          {(['packs', 'looks'] as Tab[]).map((t) => (
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
                {t === 'packs' ? 'Packs' : 'Looks'}
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
                    {coll.owed.map((id, i) => {
                      const pack = packById(id);
                      if (!pack) return null;
                      return (
                        <Press
                          key={`${id}-${i}`}
                          onPress={() => open(id, true)}
                          feel="medium"
                          scaleTo={0.98}
                          style={styles.owedGo}
                        >
                          <Text style={styles.owedGoText}>Open the {pack.name}</Text>
                          <Text style={styles.owedGoSub}>Free. You reached a level for it.</Text>
                        </Press>
                      );
                    })}
                  </View>
                </Rise>
              ) : null}

              <Text style={styles.note}>
                A pack looks for somebody you have not got before it settles for
                somebody you have. The best card in it always comes out last.
              </Text>

              {PACKS.map((pack, i) => {
                const can = p.coins >= pack.price;
                const tint = PACK_TINT[i] ?? hue.gold;
                return (
                  <Rise key={pack.id} delay={i}>
                    <View style={[styles.pack, { borderColor: alpha(tint, 0.4) }]}>
                      <Shine radius={radius.lg} group="panel" />
                      <View style={styles.packTop}>
                        <View style={[styles.wrap, { borderColor: tint, backgroundColor: alpha(tint, 0.14) }]}>
                          <Text style={[styles.wrapCount, { color: tint }]} allowFontScaling={false}>
                            {pack.size}
                          </Text>
                          <Text style={styles.wrapWord}>cards</Text>
                        </View>
                        <View style={styles.packBody}>
                          <Text style={styles.packName}>{pack.name}</Text>
                          <Text style={styles.packBlurb}>{pack.blurb}</Text>
                          <Text style={[styles.packFloor, { color: tint }]}>
                            Guaranteed {pack.floor} or better
                          </Text>
                        </View>
                      </View>

                      {/* the odds as a bar rather than four numbers */}
                      <View style={styles.oddsBar}>
                        {(['icon', 'gold', 'silver', 'bronze'] as Rarity[]).map((r) => (
                          <View
                            key={r}
                            style={{
                              flex: Math.max(0.02, pack.odds[r]),
                              backgroundColor: rarityColour(r),
                            }}
                          />
                        ))}
                      </View>
                      <View style={styles.oddsKey}>
                        {(['icon', 'gold', 'silver', 'bronze'] as Rarity[]).map((r) => (
                          <Text key={r} style={[styles.oddsText, { color: rarityColour(r) }]}>
                            {Math.round(pack.odds[r] * 1000) / 10}% {r}
                          </Text>
                        ))}
                      </View>

                      <Press
                        onPress={() => open(pack.id, false)}
                        feel={can ? 'medium' : 'warning'}
                        scaleTo={0.98}
                        style={[
                          styles.buy,
                          can
                            ? { borderColor: alpha(tint, 0.6), backgroundColor: alpha(tint, 0.16) }
                            : styles.buyOff,
                        ]}
                      >
                        <Text style={[styles.buyText, can ? { color: tint } : null]}>
                          {can ? `Open for ${pack.price}` : `${pack.price - p.coins} coins short`}
                        </Text>
                      </Press>
                    </View>
                  </Rise>
                );
              })}
            </>
          ) : null}

          {tab === 'looks' ? (
            <>
              <Text style={styles.note}>
                Paint, and nothing else. A frame changes how a card is drawn in
                the album, a pitch changes the turf your draft is played on, and
                a title is the only one anybody else ever sees.
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
                      on={looks[kind] === c.id}
                      coins={p.coins}
                      onPress={() => {
                        if (hasCosmetic(c.id)) {
                          haptic('light');
                          sfx('tick');
                          equip(c.id);
                          refresh();
                          setSaid(null);
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
                          setSaid(`${c.price - p.coins} coins short of that one.`);
                          return;
                        }
                        haptic('success');
                        sfx('pick');
                        equip(c.id);
                        refresh();
                        setSaid(null);
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

      <PackOpen
        cards={pulled?.cards ?? null}
        title={pulled?.title ?? ''}
        onDone={() => setPulled(null)}
      />
    </>
  );
}

const PACK_TINT = ['#B87333', '#B9C6CE', hue.gold, hue.violet];

function LookRow({
  item,
  on,
  coins,
  onPress,
}: {
  item: Cosmetic;
  on: boolean;
  coins: number;
  onPress: () => void;
}) {
  const mine = hasCosmetic(item.id);
  const locked = !mine && item.price <= 0;
  const canBuy = !mine && item.price > 0 && coins >= item.price;

  return (
    <Press
      onPress={onPress}
      feel="none"
      scaleTo={0.99}
      style={[
        styles.look,
        on ? { borderColor: hue.emerald, backgroundColor: alpha(hue.emerald, 0.08) } : null,
        locked ? styles.lookLocked : null,
      ]}
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
        {on ? 'ON' : mine ? 'WEAR' : locked ? `LVL ${item.level}` : String(item.price)}
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
    minWidth: 60,
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
  owedGo: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.sky, 0.6),
    backgroundColor: alpha(hue.sky, 0.16),
    gap: 1,
  },
  owedGoText: { ...text.button, fontSize: 14.5, color: hue.sky },
  owedGoSub: { ...text.small, fontSize: 11, color: color.text3 },

  pack: {
    marginBottom: space.s3,
    padding: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.035)',
    overflow: 'hidden',
    gap: space.s3,
  },
  packTop: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  wrap: {
    width: 56,
    height: 68,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapCount: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 32,
    fontVariant: ['tabular-nums'],
  },
  wrapWord: { ...text.key, fontSize: 6.5, color: color.text3 },
  packBody: { flex: 1, minWidth: 0, gap: 1 },
  packName: { fontFamily: font.displayBold, fontSize: 17, lineHeight: 22, color: color.text1 },
  packBlurb: { ...text.small, fontSize: 11.5, lineHeight: 16, color: color.text3 },
  packFloor: { ...text.key, fontSize: 7.5, marginTop: 2 },

  oddsBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  oddsKey: { flexDirection: 'row', justifyContent: 'space-between' },
  oddsText: { ...text.key, fontSize: 7 },

  buy: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  buyOff: { borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
  buyText: { ...text.button, fontSize: 14.5, color: color.text3 },

  look: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 58,
    marginBottom: 5,
    paddingHorizontal: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  lookLocked: { opacity: 0.55 },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchLetter: { fontFamily: font.displayBlack, fontSize: 14 },
  lookBody: { flex: 1, minWidth: 0 },
  lookName: { fontFamily: font.displayBold, fontSize: 15, lineHeight: 20, color: color.text1 },
  lookBlurb: { ...text.small, fontSize: 11, lineHeight: 15, color: color.text3 },
  lookState: { ...text.key, fontSize: 8.5, fontVariant: ['tabular-nums'] },
});
