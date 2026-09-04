import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { go, back } from '../src/game/nav';
import { ModeScreen, Press, Rise, Shine, Collapse, Coin, commas } from '../src/ui/components';
import { color, space, radius, line, hue, alpha } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { haptic, useReduceMotion } from '../src/ui/feel';
import { sfx } from '../src/ui/sound';
import {
  MAX_LEVEL,
  allKeepsakes,
  coinsForLevel,
  collectionCounts,
  cosmeticById,
  levelProgress,
  nextKeepsake,
  totals,
  type RewardKind,
} from '../src/engine';
import { progressStore, collectionStore, owned } from '../src/save';
import { claimAll, claimable, type Claim } from '../src/game/progress';

/**
 * Your game.
 *
 * What you have done, what it has been worth, and what is next. The one
 * rule the whole thing is built on is written on the page rather than
 * hidden in it: a level never changes how the game plays, only how it
 * looks. Somebody who has played four hundred seasons and somebody who
 * opened the app this morning get the identical Daily, and that is worth
 * saying out loud on the screen that hands out rewards.
 */
export default function ProgressScreen() {
  const [p, setP] = useState(() => progressStore.read());
  const [coll, setColl] = useState(() => collectionStore.read());
  const [claims, setClaims] = useState<Claim[]>(() => claimable());
  const [took, setTook] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      setP(progressStore.read());
      setColl(collectionStore.read());
      setClaims(claimable());
      setTook(null);
    }, []),
  );

  const lvl = levelProgress(p.xp);
  const reduce = useReduceMotion();

  /* The bar fills and the level lands, once, when the page opens.
     A progress bar that is simply already full has told you nothing;
     watching it arrive is most of why anybody looks at this page. */
  const fill = useSharedValue(reduce ? lvl.frac : 0);
  const pop = useSharedValue(reduce ? 1 : 0.82);
  const coinPop = useSharedValue(reduce ? 1 : 0.86);

  useEffect(() => {
    if (reduce) {
      fill.value = lvl.frac;
      pop.value = 1;
      coinPop.value = 1;
      return;
    }
    fill.value = withDelay(160, withTiming(lvl.frac, { duration: 780 }));
    pop.value = withSequence(
      withSpring(1.08, { stiffness: 300, damping: 12 }),
      withSpring(1, { stiffness: 240, damping: 18 }),
    );
    coinPop.value = withDelay(90, withSpring(1, { stiffness: 260, damping: 16 }));
  }, [lvl.frac, reduce, fill, pop, coinPop]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(100, fill.value * 100))}%`,
  }));
  const levelStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const coinStyle = useAnimatedStyle(() => ({ transform: [{ scale: coinPop.value }] }));
  const next = nextKeepsake(lvl.level);
  const have = owned(coll);
  const counts = collectionCounts(have);
  const all = totals();

  const take = useCallback(() => {
    const got = claimAll();
    if (!got.length) return;
    haptic('success');
    sfx('pick');
    setTook(got.reduce((a, g) => a + g.coins, 0));
    setP(progressStore.read());
    setColl(collectionStore.read());
    setClaims([]);
  }, []);

  const owedPacks = coll.owed.length;

  return (
    <ModeScreen overline="Your game" title="Progress" scroll={false} onBack={() => back()}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- the level ---- */}
        <View style={styles.hero}>
          <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroKey}>Level</Text>
              <Animated.Text style={[styles.heroLevel, levelStyle]} allowFontScaling={false}>
                {lvl.level}
              </Animated.Text>
              <Text style={styles.heroOf}>of {MAX_LEVEL}</Text>
            </View>
            <View style={styles.heroRight}>
              <Text style={styles.heroKey}>Coins</Text>
              <View style={styles.heroCoinRow}>
                <Coin size={22} />
                <Animated.Text style={[styles.heroCoins, coinStyle]} allowFontScaling={false}>
                  {commas(p.coins)}
                </Animated.Text>
              </View>
              <Text style={styles.heroOf}>to spend</Text>
            </View>
          </View>

          <View style={styles.bar}>
            <Animated.View style={[styles.barFill, barStyle]} />
          </View>
          <Text style={styles.heroNote}>
            {lvl.maxed
              ? 'Level fifty. There is nothing after it.'
              : `${commas(lvl.into)} of ${commas(lvl.span)} experience to level ${lvl.level + 1}`}
          </Text>
          {next ? (
            <Text style={styles.heroNext}>
              <Text style={styles.heroNextWord}>Next: </Text>
              {next.name} at level {next.level}
            </Text>
          ) : null}
        </View>

        {/* ---- what is waiting ---- */}
        {claims.length ? (
          <Rise delay={0}>
            <Press onPress={take} feel="medium" scaleTo={0.98} style={styles.claim}>
              <Text style={styles.claimKey}>
                {claims.length === 1 ? 'One thing finished' : `${claims.length} things finished`}
              </Text>
              <Text style={styles.claimNames} numberOfLines={2}>
                {claims.map((c) => c.name).join(', ')}
              </Text>
              <View style={styles.claimRow}>
                <Coin size={15} />
                <Text style={styles.claimTake}>
                  Take {commas(claims.reduce((a, c) => a + c.coins, 0))}
                </Text>
              </View>
            </Press>
          </Rise>
        ) : null}
        {took !== null ? (
          <Text style={styles.tookText}>{commas(took)} coins banked.</Text>
        ) : null}

        {owedPacks ? (
          <Press
            onPress={() => {
              haptic('light');
              go('/shop');
            }}
            feel="none"
            scaleTo={0.98}
            style={styles.owed}
          >
            <Text style={styles.owedText}>
              {owedPacks === 1 ? 'A pack is waiting to be opened' : `${owedPacks} packs are waiting`}
            </Text>
          </Press>
        ) : null}

        {/* ---- the numbers ---- */}
        <View style={styles.stats}>
          <Stat value={String(p.seasons)} label="seasons" />
          <Stat value={String(p.titles)} label="titles" tint={hue.gold} />
          <Stat value={String(p.best)} label="best points" tint={hue.emerald} />
        </View>

        {/* ---- the collection, in a line ---- */}
        <Press
          onPress={() => {
            haptic('light');
            go('/collection');
          }}
          feel="none"
          scaleTo={0.99}
          style={styles.coll}
        >
          <View style={styles.collTop}>
            <Text style={styles.collKey}>The album</Text>
            <Text style={styles.collCount} allowFontScaling={false}>
              {commas(counts.all)}
              <Text style={styles.collOf}> / {commas(all.all)}</Text>
            </Text>
          </View>
          <View style={styles.collBar}>
            <View
              style={[
                styles.collFill,
                { width: `${Math.max(0.6, Math.min(100, (counts.all / all.all) * 100))}%` },
              ]}
            />
          </View>
          <Text style={styles.collLine}>
            {counts.icon} Icons {'·'} {counts.gold} Gold {'·'} {counts.silver} Silver {'·'}{' '}
            {counts.bronze} Bronze
          </Text>
        </Press>

        <Press
          onPress={() => {
            haptic('light');
            go('/shop');
          }}
          feel="medium"
          scaleTo={0.98}
          style={styles.shop}
        >
          <Coin size={18} />
          <Text style={styles.shopText}>Spend your coins</Text>
        </Press>

        {/* ---- what there is to reach ---- */}
        <Text style={[text.label, styles.sect]}>The road to fifty</Text>
        <Text style={styles.sectNote}>
          Every level pays coins. Nothing on this list changes how the game
          plays, on purpose: the Daily and a duel are the same puzzle for
          everybody, whatever level they are.
        </Text>
        <Collapse label="Every reward" count={allKeepsakes().length}>
          <View style={styles.track}>
            {allKeepsakes().map((k, i) => {
              const done = lvl.level >= k.level;
              const item = k.kind === 'pack' ? null : cosmeticById(k.id);
              return (
                <View key={`${k.id}-${i}`} style={styles.trackRow}>
                  <View
                    style={[
                      styles.pip,
                      done ? { backgroundColor: hue.emerald, borderColor: hue.emerald } : null,
                    ]}
                  />
                  <Text
                    style={[styles.trackLevel, done ? { color: hue.emerald } : null]}
                    allowFontScaling={false}
                  >
                    {k.level}
                  </Text>
                  <View style={styles.trackBody}>
                    <Text
                      style={[styles.trackName, done ? { color: color.text1 } : null]}
                      numberOfLines={1}
                    >
                      {k.name}
                    </Text>
                    <Text style={styles.trackKind}>
                      {kindWord(k.kind)}
                      {item ? ` · ${item.blurb}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.trackCoins} allowFontScaling={false}>
                    +{commas(coinsForLevel(k.level))}
                  </Text>
                </View>
              );
            })}
          </View>
        </Collapse>

        <Text style={styles.foot}>
          Coins come from playing. Nothing here can be bought with money.
        </Text>
        <View style={{ height: space.s6 }} />
      </ScrollView>
    </ModeScreen>
  );
}

function kindWord(kind: RewardKind): string {
  return kind === 'frame'
    ? 'Card frame'
    : kind === 'pitch'
      ? 'Pitch'
      : kind === 'title'
        ? 'Title'
        : kind === 'pack'
          ? 'A pack of cards'
          : 'Coins';
}

function Stat({ value, label, tint }: { value: string; label: string; tint?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tint ? { color: tint } : null]} allowFontScaling={false}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  pageContent: { paddingBottom: space.s4 },

  hero: {
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: alpha(hue.emerald, 0.3),
    backgroundColor: '#0C1611',
    experimental_backgroundImage:
      'radial-gradient(120% 100% at 50% 0%, rgba(31,197,126,0.16) 0%, rgba(12,22,17,0.7) 52%, #080D0A 100%)',
    overflow: 'hidden',
    gap: space.s3,
  },
  /*
   * Both labels on one line at the top, both numbers hanging under them.
   * The level used to be a sixty two point glyph in a seventy four point
   * box, which a display face overflows upwards, so the word LEVEL had a
   * two sat on top of it. It has room now, and the two columns line up
   * rather than one of them floating at the bottom of the other.
   */
  heroTop: { flexDirection: 'row', alignItems: 'flex-start' },
  heroLeft: { flex: 1 },
  heroRight: { alignItems: 'flex-end', paddingBottom: 2 },
  heroKey: { ...text.key, fontSize: 9, color: color.text3, marginBottom: 4 },
  heroLevel: {
    fontFamily: font.hero,
    fontSize: 56,
    lineHeight: 68,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  heroOf: { ...text.small, fontSize: 11, lineHeight: 15, color: color.text3, marginTop: -4 },
  heroCoinRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroCoins: {
    fontFamily: font.displayBlack,
    fontSize: 30,
    lineHeight: 38,
    color: hue.gold,
    fontVariant: ['tabular-nums'],
  },
  bar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 4, backgroundColor: hue.emerald, minWidth: 8 },
  heroNote: { ...text.small, fontSize: 12.5, lineHeight: 18, color: color.text2 },
  heroNext: { ...text.small, fontSize: 12, lineHeight: 17, color: color.text2 },
  heroNextWord: { ...text.key, fontSize: 8.5, color: hue.emerald },

  claim: {
    marginTop: space.s4,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(hue.gold, 0.5),
    backgroundColor: alpha(hue.gold, 0.1),
    gap: 3,
  },
  claimKey: { ...text.key, fontSize: 9, color: hue.gold },
  claimNames: { ...text.small, fontSize: 12.5, lineHeight: 18, color: color.text2 },
  claimRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.s2 },
  claimTake: { ...text.button, fontSize: 15, color: hue.gold },
  tookText: {
    ...text.small,
    fontSize: 12.5,
    color: hue.emerald,
    marginTop: space.s2,
    textAlign: 'center',
  },

  owed: {
    marginTop: space.s3,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.sky, 0.45),
    backgroundColor: alpha(hue.sky, 0.1),
  },
  owedText: { ...text.button, fontSize: 13.5, color: hue.sky },

  stats: {
    flexDirection: 'row',
    marginTop: space.s4,
    paddingVertical: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#0D1610',
  },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statValue: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 30,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { ...text.key, fontSize: 8, color: color.text3 },

  coll: {
    marginTop: space.s4,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.035)',
    gap: space.s2,
  },
  collTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  collKey: { ...text.key, fontSize: 9, color: color.text3 },
  collCount: {
    fontFamily: font.displayBlack,
    fontSize: 22,
    lineHeight: 28,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  collOf: { fontSize: 13, color: color.text3 },
  collBar: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  collFill: { height: 5, borderRadius: 3, backgroundColor: hue.violet, minWidth: 5 },
  collLine: { ...text.small, fontSize: 11.5, lineHeight: 16, color: color.text3 },

  shop: {
    flexDirection: 'row',
    gap: space.s2,
    marginTop: space.s3,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: hue.gold,
    experimental_backgroundImage: 'linear-gradient(140deg, #E8C878 0%, #B98F35 100%)',
    boxShadow: '0px 10px 26px rgba(214,178,94,0.24), inset 0px 1px 0px rgba(255,255,255,0.26)',
  },
  shopText: { ...text.button, fontSize: 16, color: '#1A1408' },

  sect: { marginTop: space.s6, marginBottom: space.s2 },
  sectNote: {
    ...text.small,
    fontSize: 12,
    lineHeight: 18,
    color: color.text3,
    marginBottom: space.s3,
  },

  track: { gap: 2, paddingTop: space.s2 },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  pip: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'transparent',
  },
  trackLevel: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 18,
    color: color.text3,
    width: 24,
    fontVariant: ['tabular-nums'],
  },
  trackBody: { flex: 1, minWidth: 0 },
  trackName: { fontFamily: font.bodySemi, fontSize: 13, lineHeight: 18, color: color.text2 },
  trackKind: { ...text.small, fontSize: 10.5, lineHeight: 15, color: color.text3 },
  trackCoins: {
    fontFamily: font.displayBold,
    fontSize: 12,
    lineHeight: 17,
    color: hue.gold,
    fontVariant: ['tabular-nums'],
  },

  foot: {
    ...text.small,
    fontSize: 11.5,
    color: color.text3,
    textAlign: 'center',
    marginTop: space.s5,
  },
});
