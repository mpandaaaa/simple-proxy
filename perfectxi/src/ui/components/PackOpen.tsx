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
import { RARITY_ORDER, cardValue, type Card, type Rarity } from '../../engine';
import { CardFace, RARITY_TINT } from './CardFace';
import { commas } from './Coin';

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

export function PackOpen({
  cards,
  title,
  dupes,
  onDone,
}: {
  /** what came out, in any order: this sorts them */
  cards: Card[] | null;
  /** what was opened, for the line at the top */
  title: string;
  /** the ids that were already yours, which were sold where they stood */
  dupes?: readonly string[];
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
  const already = useMemo(() => new Set(dupes ?? []), [dupes]);

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

          {/* Kept off the card on purpose. It used to sit inside the foot
              and land on top of the club and the season. */}
          <View style={styles.banner}>
            {shown === 0 && best ? (
              <Text style={[styles.bannerText, { color: RARITY_TINT[best.rarity] }]}>
                {TELL[best.rarity]}
              </Text>
            ) : done && best ? (
              <Text style={[styles.bannerText, { color: RARITY_TINT[best.rarity] }]}>
                Best of the pack {'·'} {best.n}
              </Text>
            ) : current && already.has(current.id) ? (
              <Text style={[styles.bannerText, { color: hue.gold }]}>
                Already yours {'·'} sold for {commas(cardValue(current))} coins
              </Text>
            ) : current ? (
              <Text style={[styles.bannerText, { color: color.text3 }]}>New</Text>
            ) : null}
          </View>

          <View style={styles.stage}>
            {ordered.map((c, i) =>
              i < shown ? (
                <Reveal key={c.id} card={c} front={i === shown - 1} reduce={reduce} />
              ) : null,
            )}
            {shown === 0 ? <Wrapper best={best} reduce={reduce} /> : null}
          </View>

          <Text style={styles.hint}>
            {done
              ? 'Tap to put them in the collection'
              : shown === 0
                ? 'Tap to open'
                : 'Tap for the next one'}
          </Text>
        </View>
      </Pressable>
    </Modal>
  );
}

/*
 * What the wrapper is allowed to say.
 *
 * The single strongest thing in a reveal is knowing something good is
 * coming before you can see what it is. It is also the easiest thing to
 * cheat at, and cheating at it is the difference between a game and a
 * fruit machine: a wrapper that glows gold and hands over a bronze has
 * lied to somebody to make them tap again.
 *
 * So this is read off the best card actually in the pack. It never
 * promises anything the pack does not contain, and it never hides one
 * either. The tension is real because the card is real.
 */
const TELL: Record<Rarity, string> = {
  icon: 'Something in here is rated ninety or more',
  gold: 'There is a Gold in this one',
  silver: 'There is a Silver in this one',
  bronze: 'Three squad players',
};

/**
 * The pack, before it is open.
 *
 * It breathes in the colour of the best thing inside it, and the better
 * that is the harder it breathes. A Bronze pack sits still. An Icon pack
 * will not keep still, and by the time the first card comes out the
 * person holding the phone already knows.
 */
function Wrapper({ best, reduce }: { best: Card | null; reduce: boolean }) {
  const rarity: Rarity = best?.rarity ?? 'bronze';
  const tint = RARITY_TINT[rarity];
  const loud = rarity === 'icon' || rarity === 'gold';

  const pulse = useSharedValue(0);
  const tilt = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: loud ? 620 : 1100, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: loud ? 620 : 1100, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    if (rarity === 'icon') {
      /* An Icon will not sit still. Small, because a wrapper that thrashes
         reads as a bug rather than as a promise. */
      tilt.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 90, easing: Easing.linear }),
          withTiming(-1, { duration: 180, easing: Easing.linear }),
          withTiming(0, { duration: 90, easing: Easing.linear }),
          withTiming(0, { duration: 1400, easing: Easing.linear }),
        ),
        -1,
        false,
      );
    }
  }, [reduce, loud, rarity, pulse, tilt]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + pulse.value * (loud ? 0.05 : 0.02) },
      { rotate: `${tilt.value * 1.4}deg` },
    ],
    boxShadow: `0px 0px ${18 + pulse.value * (loud ? 46 : 16)}px ${alpha(
      tint,
      0.3 + pulse.value * (loud ? 0.45 : 0.2),
    )}`,
  }));

  return (
    <Animated.View style={[styles.wrapper, style, { borderColor: alpha(tint, 0.65) }]}>
      <Text style={[styles.wrapperMark, { color: tint }]} allowFontScaling={false}>
        {rarity === 'icon' ? '\u2605' : rarity === 'gold' ? '\u25c6' : '\u25cf'}
      </Text>
      <Text style={[styles.wrapperText, { color: tint }]}>Tap to open</Text>
    </Animated.View>
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
}: {
  card: Card;
  front: boolean;
  reduce: boolean;
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
        styles.holder,
        behind,
        { boxShadow: `0px 18px 44px ${alpha(tint, big ? 0.44 : 0.22)}` },
      ]}
      pointerEvents="none"
    >
      <CardFace card={card} />
      <Animated.View style={[styles.sweep, sweep]} pointerEvents="none" />
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
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: space.s2,
  },
  wrapperMark: { fontSize: 34, lineHeight: 42 },
  wrapperText: { ...text.key, fontSize: 11, color: color.text2 },

  holder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  sweep: {
    position: 'absolute',
    top: -80,
    bottom: -80,
    width: 70,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  banner: { height: 22, justifyContent: 'center', marginTop: space.s2 },
  bannerText: { ...text.key, fontSize: 8.5 },

  hint: { ...text.small, fontSize: 12.5, color: color.text3 },
});
