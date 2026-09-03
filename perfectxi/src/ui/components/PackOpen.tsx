import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { color, hue, radius, space, alpha } from '../tokens';
import { font, text } from '../type';
import { haptic, useReduceMotion } from '../feel';
import { sfx } from '../sound';
import { RARITY_ORDER, type Card, type Rarity } from '../../engine';

/**
 * Opening a pack.
 *
 * The one moment in the whole of Your Game that has to feel like
 * something, because everything else in it is a list. A pack that simply
 * prints five names has told you what you got; a pack that hands them
 * over one at a time, worst first, has made you wait for the last one.
 *
 * So the cards are sorted with the best at the end and revealed on a tap.
 * Each one comes up out of the floor, the glow behind it is the colour of
 * what it turned out to be, and the rating counts rather than appears. An
 * Icon gets a longer wind up and a heavier knock than a Bronze, which is
 * the difference between a reward and a receipt.
 *
 * Under Reduce Motion the whole thing still works and simply does not
 * move: every card is there, in the same order, on the same taps.
 */

const RARITY_TINT: Record<Rarity, string> = {
  icon: hue.violet,
  gold: hue.gold,
  silver: '#B9C6CE',
  bronze: '#B87333',
};

const RARITY_WORD: Record<Rarity, string> = {
  icon: 'ICON',
  gold: 'GOLD',
  silver: 'SILVER',
  bronze: 'BRONZE',
};

export function PackOpen({
  cards,
  title,
  onDone,
}: {
  /** what came out, in any order: this sorts them */
  cards: Card[] | null;
  /** what was opened, for the line at the top */
  title: string;
  onDone: () => void;
}) {
  const reduce = useReduceMotion();
  /* Worst first, so the pack builds. Two cards of the same rarity are
     ordered by rating, so the very last card is always the best thing in
     it and there is never an anticlimax. */
  const ordered = useMemo(() => {
    if (!cards) return [];
    const rank = (r: Rarity) => RARITY_ORDER.length - RARITY_ORDER.indexOf(r);
    return [...cards].sort((a, b) => rank(a.rarity) - rank(b.rarity) || a.rtg - b.rtg);
  }, [cards]);

  const [shown, setShown] = useState(0);
  const open = cards !== null;

  useEffect(() => {
    if (open) setShown(0);
  }, [open, cards]);

  const next = useCallback(() => {
    if (!ordered.length) return;
    if (shown >= ordered.length) {
      onDone();
      return;
    }
    const card = ordered[shown];
    haptic(card.rarity === 'icon' ? 'success' : card.rarity === 'gold' ? 'medium' : 'light');
    sfx(card.rarity === 'icon' || card.rarity === 'gold' ? 'pick' : 'tick');
    setShown((n) => n + 1);
  }, [ordered, shown, onDone]);

  if (!open) return null;

  const done = shown >= ordered.length;
  const current = ordered[Math.max(0, shown - 1)] ?? null;
  const best = ordered[ordered.length - 1] ?? null;
  const tint = current ? RARITY_TINT[current.rarity] : hue.emerald;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDone} statusBarTranslucent>
      <Pressable style={styles.fill} onPress={next}>
        {/* the light behind everything, in the colour of the last card */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="glow" cx="50%" cy="42%" r="70%">
                <Stop offset="0" stopColor={tint} stopOpacity={current ? 0.3 : 0.12} />
                <Stop offset="1" stopColor="#050706" stopOpacity={1} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
          </Svg>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.counter} allowFontScaling={false}>
            {Math.min(shown, ordered.length)} / {ordered.length}
          </Text>

          <View style={styles.stage}>
            {ordered.map((c, i) =>
              i < shown ? (
                <Reveal
                  key={c.id}
                  card={c}
                  front={i === shown - 1}
                  reduce={reduce}
                  best={done && c.id === best?.id}
                />
              ) : null,
            )}
            {shown === 0 ? (
              <View style={styles.wrapper}>
                <Text style={styles.wrapperText}>Tap to open</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.hint}>
            {done ? 'Tap to put them in the collection' : 'Tap for the next one'}
          </Text>
        </View>
      </Pressable>
    </Modal>
  );
}

/**
 * One card arriving.
 *
 * The card behind the front one shrinks back and dims rather than
 * disappearing, so the pack reads as a stack you are working through
 * instead of a slideshow.
 */
function Reveal({
  card,
  front,
  reduce,
  best,
}: {
  card: Card;
  front: boolean;
  reduce: boolean;
  best: boolean;
}) {
  const tint = RARITY_TINT[card.rarity];
  const big = card.rarity === 'icon' || card.rarity === 'gold';

  const y = useSharedValue(reduce ? 0 : 46);
  const s = useSharedValue(reduce ? 1 : 0.86);
  const o = useSharedValue(reduce ? 1 : 0);
  const shine = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      y.value = 0;
      s.value = 1;
      o.value = 1;
      return;
    }
    o.value = withTiming(1, { duration: 180 });
    y.value = withSpring(0, { stiffness: 220, damping: 18, mass: 0.9 });
    s.value = withSequence(
      withSpring(big ? 1.06 : 1.02, { stiffness: 260, damping: 14 }),
      withSpring(1, { stiffness: 240, damping: 20 }),
    );
    if (big) {
      shine.value = withDelay(
        120,
        withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false),
      );
    }
  }, [reduce, big, o, s, y, shine]);

  /* Everything behind the front card settles back into the stack. */
  const behind = useAnimatedStyle(() => ({
    opacity: front ? o.value : 0,
    transform: [{ translateY: y.value }, { scale: s.value }],
  }));

  const sweep = useAnimatedStyle(() => ({
    opacity: big ? 0.4 : 0,
    transform: [{ translateX: -160 + shine.value * 360 }, { rotate: '18deg' }],
  }));

  return (
    <Animated.View
      style={[
        styles.card,
        behind,
        {
          borderColor: tint,
          backgroundColor: alpha(tint, 0.1),
          boxShadow: `0px 18px 44px ${alpha(tint, big ? 0.4 : 0.22)}`,
        },
      ]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.sweep, sweep]} pointerEvents="none" />

      <Text style={[styles.rarity, { color: tint }]}>{RARITY_WORD[card.rarity]}</Text>
      <Text style={[styles.rating, { color: tint }]} allowFontScaling={false}>
        {card.rtg}
      </Text>
      <Text style={styles.name} numberOfLines={2}>
        {card.n}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {card.club} {'·'} {card.season}
      </Text>
      <View style={[styles.rule, { backgroundColor: alpha(tint, 0.5) }]} />
      <Text style={styles.pos}>{Array.isArray(card.pos) ? card.pos.join(' / ') : card.pos}</Text>
      {best ? <Text style={[styles.best, { color: tint }]}>Best of the pack</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#050706' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.s4 },
  title: { ...text.key, fontSize: 10, color: color.text3 },
  counter: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 19,
    color: color.text3,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },

  stage: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 0.72,
    marginTop: space.s5,
    marginBottom: space.s5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  wrapperText: { ...text.key, fontSize: 11, color: color.text2 },

  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 2,
    overflow: 'hidden',
    gap: 2,
  },
  sweep: {
    position: 'absolute',
    top: -80,
    bottom: -80,
    width: 70,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  rarity: { ...text.key, fontSize: 9.5 },
  rating: {
    fontFamily: font.hero,
    fontSize: 74,
    lineHeight: 90,
    fontVariant: ['tabular-nums'],
  },
  name: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 32,
    color: color.text1,
    textAlign: 'center',
  },
  meta: { ...text.small, fontSize: 13, lineHeight: 19, color: color.text2, textAlign: 'center' },
  rule: { height: 1, width: 60, marginVertical: space.s3 },
  pos: { ...text.key, fontSize: 9, color: color.text3 },
  best: { ...text.key, fontSize: 8.5, marginTop: space.s3 },

  hint: { ...text.small, fontSize: 12.5, color: color.text3 },
});
