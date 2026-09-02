import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  View,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { radius, space } from '../tokens';
import { font } from '../type';
import { haptic, useReduceMotion } from '../feel';
import { sfx } from '../sound';
import { Shine } from './Shine';
import {
  clubColour,
  clubCode,
  faceStats,
  initials,
  lastName,
  tierFor,
  tierLabel,
  type CardTier,
  type Pick,
  type Position,
} from '../../engine';

const CARD_W = 300;
/** near enough the drawn height; only used to size the flight, not to lay out */
const CARD_H = 372;

export type Anchor = { x: number; y: number; w: number; h: number };

/**
 * How long the card holds, by who it is.
 *
 * A squad filler and a legend were getting the identical two seconds, which
 * is what made signing Bergkamp feel like signing nobody. The ceremony
 * scales with the signing, exactly as the report's rule says it should, and
 * every one of them can still be tapped straight through.
 */
const HOLD: Record<CardTier, number> = {
  bronze: 1100,
  silver: 1250,
  gold: 1750,
  icon: 2400,
};

const TIERS = {
  bronze: { m1: '#5E3A1C', m2: '#C88A4A', ink: '#2B1A08', edge: '#E0A868' },
  silver: { m1: '#5E6970', m2: '#CBD6DE', ink: '#1E262B', edge: '#E3ECF2' },
  gold: { m1: '#7A5F18', m2: '#E8CE7B', ink: '#2A2007', edge: '#F5DE97' },
  icon: { m1: '#100E0A', m2: '#2A2419', ink: '#F2E2B0', edge: '#D6B25E' },
} as const;

/**
 * The signing reveal.
 *
 * The card is not a dialog that appears over the game. It grows out of the
 * row you tapped, and when it is done it flies into the slot it filled on
 * the pitch, which then takes the hit. The web build cuts between those
 * states because a browser cannot carry an element across them.
 *
 * The rating counts up rather than being printed, the foil sweeps on the
 * cards worth sweeping, and the haptic gets heavier with the player.
 */
export function PlayerCard({
  player,
  slotPos,
  from,
  to,
  onDone,
  onLanded,
}: {
  player: Pick | null;
  slotPos: Position | null;
  /** the row that was tapped, so the card can grow out of it */
  from?: Anchor | null;
  /** the pitch slot it filled, so the card can fly into it */
  to?: Anchor | null;
  onDone: () => void;
  /** fired as the card reaches the slot, so the slot can light up */
  onLanded?: () => void;
}) {
  const reduce = useReduceMotion();
  const { width: winW, height: winH } = useWindowDimensions();

  /** 0 at the anchor, 1 at rest in the middle of the screen */
  const p = useSharedValue(0);
  /** where 0 means: the row on the way in, the slot on the way out */
  const ax = useSharedValue(0);
  const ay = useSharedValue(0);
  const as = useSharedValue(0.15);
  /** the light travelling across the foil */
  const foil = useSharedValue(0);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Where this card is going, captured while it is still being told.
   *
   * The board clears the reveal to close the card, which also clears the
   * slot it was flying to, so reading the prop on the way out finds
   * nothing and the card fades where it stands. It is remembered on the
   * way in instead.
   */
  const target = useRef<Anchor | null>(null);
  const [card, setCard] = useState<Pick | null>(null);
  const [rating, setRating] = useState(0);
  const frame = useRef<number | null>(null);

  const drop = useCallback(() => setCard(null), []);
  const land = useCallback(() => onLanded?.(), [onLanded]);

  /** Put the flight's zero point on a rect, in screen coordinates. */
  const anchorTo = useCallback(
    (rect: Anchor | null | undefined) => {
      if (!rect || rect.w <= 0) {
        // No rect to work from: fall back to growing out of the centre.
        ax.value = 0;
        ay.value = 0;
        as.value = 0.86;
        return;
      }
      ax.value = rect.x + rect.w / 2 - winW / 2;
      ay.value = rect.y + rect.h / 2 - winH / 2;
      // Matched on height. A list row is wider than the card but a fraction
      // of its height, so width would start the card larger than it ends.
      as.value = Math.min(0.5, Math.max(0.12, rect.h / CARD_H));
    },
    [ax, ay, as, winW, winH],
  );

  useEffect(() => {
    if (player) {
      const tier = tierFor(player.rtg);
      setCard(player);
      target.current = to ?? null;
      anchorTo(from);

      // The haptic gets heavier with the signing.
      haptic(tier === 'icon' ? 'heavy' : tier === 'gold' ? 'medium' : 'light');
      sfx('pick');
      if (tier === 'icon' || tier === 'gold') {
        timer.current = setTimeout(() => haptic('success'), 140);
      }

      p.value = 0;
      p.value = reduce
        ? withTiming(1, { duration: 120 })
        : withSpring(1, { stiffness: 190, damping: 15, mass: 1 });

      // Foil only on the cards worth sweeping, and twice for an icon.
      foil.value = 0;
      if (!reduce && (tier === 'gold' || tier === 'icon')) {
        foil.value = withDelay(
          220,
          withRepeat(
            withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
            tier === 'icon' ? 2 : 1,
            false,
          ),
        );
      }

      // The rating arrives rather than being printed.
      if (reduce) {
        setRating(player.rtg);
      } else {
        const start = Date.now();
        const run = () => {
          const q = Math.min(1, (Date.now() - start) / 620);
          setRating(Math.round(player.rtg * (1 - Math.pow(1 - q, 3))));
          if (q < 1) frame.current = requestAnimationFrame(run);
        };
        setRating(0);
        frame.current = requestAnimationFrame(run);
      }

      const hold = setTimeout(onDone, HOLD[tier]);
      return () => {
        clearTimeout(hold);
        if (timer.current) clearTimeout(timer.current);
        if (frame.current !== null) cancelAnimationFrame(frame.current);
      };
    }

    if (!card) return;
    // Done: fly into the slot it filled, and knock on the way in.
    anchorTo(target.current);
    p.value = withTiming(
      0,
      { duration: reduce ? 100 : 340, easing: Easing.in(Easing.cubic) },
      (f) => {
        'worklet';
        if (!f) return;
        runOnJS(land)();
        runOnJS(drop)();
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value * 1.6),
    transform: [
      { translateX: ax.value * (1 - p.value) },
      { translateY: ay.value * (1 - p.value) },
      { scale: as.value + (1 - as.value) * p.value },
    ],
  }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  const foilStyle = useAnimatedStyle(() => ({
    opacity: foil.value > 0 && foil.value < 1 ? 1 : 0,
    transform: [{ translateX: -CARD_W + foil.value * (CARD_W * 2.4) }],
  }));

  if (!card) return null;

  const tierKey = tierFor(card.rtg);
  const tier = TIERS[tierKey];
  const pos = slotPos ?? (card.pos[0] as Position);
  const stats = faceStats(card.rtg, pos === 'GK');
  const sur = lastName(card.n);
  const club = clubColour(card.club);
  const grand = tierKey === 'gold' || tierKey === 'icon';

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDone}>
      <Animated.View style={[styles.dim, dimStyle]} pointerEvents="none" />
      <Pressable style={styles.backdrop} onPress={onDone}>
        <Animated.View
          style={[
            styles.card,
            cardStyle,
            {
              backgroundColor: tier.m2,
              experimental_backgroundImage: `linear-gradient(160deg, ${tier.m1} 0%, ${tier.m2} 52%, ${tier.m1} 100%)`,
              borderColor: tier.edge,
              boxShadow: grand
                ? `0px 26px 60px rgba(0,0,0,0.6), 0px 0px 40px ${tier.edge}55`
                : '0px 26px 60px rgba(0,0,0,0.6)',
            },
          ]}
        >
          <Shine radius={22} group="card" rating={card.rtg} reveal bevel={false} clip={false} />

          <View style={[styles.topEdge, { backgroundColor: tier.edge }]} />

          {/* the initials fill the space a player photo would take */}
          <Text style={[styles.watermark, { color: tier.ink }]} numberOfLines={1}>
            {initials(card.n)}
          </Text>

          <View style={styles.top}>
            <View style={styles.spine}>
              <Text style={[styles.ovr, { color: tier.ink }]} allowFontScaling={false}>
                {rating || card.rtg}
              </Text>
              <Text style={[styles.pos, { color: tier.ink }]}>{pos}</Text>
              <View style={[styles.spineRule, { backgroundColor: tier.ink }]} />
            </View>
            <Text style={[styles.kicker, { color: tier.ink }]}>
              {tierLabel(card.rtg)}
            </Text>
          </View>

          <View style={styles.body}>
            <Text
              style={[styles.name, { color: tier.ink }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {sur.toUpperCase()}
            </Text>
            {card.n !== sur ? (
              <Text style={[styles.full, { color: tier.ink }]} numberOfLines={1}>
                {card.n}
              </Text>
            ) : null}
          </View>

          <View style={[styles.rule, { backgroundColor: tier.ink }]} />

          <View style={styles.stats}>
            <View style={styles.statCol}>
              {stats.slice(0, 3).map(([k, v]) => (
                <View key={k} style={styles.stat}>
                  <Text style={[styles.statValue, { color: tier.ink }]}>{v}</Text>
                  <Text style={[styles.statKey, { color: tier.ink }]}>{k}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.statSep, { backgroundColor: tier.ink }]} />
            <View style={styles.statCol}>
              {stats.slice(3).map(([k, v]) => (
                <View key={k} style={styles.stat}>
                  <Text style={[styles.statValue, { color: tier.ink }]}>{v}</Text>
                  <Text style={[styles.statKey, { color: tier.ink }]}>{k}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.foot, { borderTopColor: tier.ink }]}>
            <View
              style={[
                styles.disc,
                {
                  backgroundColor: club,
                  experimental_backgroundImage: `linear-gradient(145deg, ${club} 0%, rgba(0,0,0,0.55) 100%)`,
                },
              ]}
            >
              <Text style={styles.discText}>{clubCode(card.club)}</Text>
            </View>
            <View style={styles.footBody}>
              <Text style={[styles.club, { color: tier.ink }]} numberOfLines={1}>
                {card.club}
              </Text>
              <Text style={[styles.season, { color: tier.ink }]}>{card.season}</Text>
            </View>
            <Text style={[styles.signed, { color: tier.ink }]}>SIGNED</Text>
          </View>

          {/* the light crossing the foil, on the cards that earn it */}
          {grand ? (
            <Animated.View style={[styles.foil, foilStyle]} pointerEvents="none" />
          ) : null}
        </Animated.View>

        <Animated.Text style={[styles.tap, dimStyle]}>Tap to continue</Animated.Text>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4,8,6,0.88)',
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.s5,
  },
  card: {
    width: CARD_W,
    maxWidth: '92%',
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: space.s2,
  },
  topEdge: { position: 'absolute', left: 0, right: 0, top: 0, height: 3, opacity: 0.9 },
  foil: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 90,
    experimental_backgroundImage:
      'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.42) 50%, rgba(255,255,255,0) 100%)',
  },
  watermark: {
    position: 'absolute',
    right: -6,
    top: 40,
    fontFamily: font.hero,
    fontSize: 118,
    lineHeight: 154,
    opacity: 0.09,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.s3,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  spine: { alignItems: 'center' },
  ovr: {
    fontFamily: font.hero,
    fontSize: 48,
    lineHeight: 62,
    fontVariant: ['tabular-nums'],
  },
  pos: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 2,
    marginTop: 2,
    opacity: 0.85,
  },
  spineRule: { width: 30, height: 1, opacity: 0.35, marginTop: 9 },
  kicker: {
    marginLeft: 'auto',
    fontFamily: font.displayBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 2.6,
    opacity: 0.7,
    paddingTop: 6,
  },
  body: { paddingHorizontal: 18, paddingTop: 12, alignItems: 'center' },
  name: {
    fontFamily: font.hero,
    fontSize: 32,
    lineHeight: 42,
    letterSpacing: 0.4,
  },
  full: {
    fontFamily: font.bodySemi,
    fontSize: 11.5,
    opacity: 0.7,
    marginTop: 5,
  },
  rule: { height: 1, opacity: 0.22, marginHorizontal: 18, marginTop: 14 },
  stats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  statCol: { flex: 1, gap: 7 },
  statSep: { width: 1, opacity: 0.2 },
  stat: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  statValue: {
    fontFamily: font.displayBlack,
    fontSize: 16,
    lineHeight: 20,
    minWidth: 26,
    fontVariant: ['tabular-nums'],
  },
  statKey: {
    fontFamily: font.bodyMed,
    fontSize: 12,
    opacity: 0.72,
    letterSpacing: 0.4,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  disc: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discText: {
    fontFamily: font.displayBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.4,
    color: '#FFFFFF',
  },
  footBody: { flex: 1, minWidth: 0 },
  club: { fontFamily: font.displayBold, fontSize: 15, lineHeight: 18, letterSpacing: 0.3 },
  season: { fontFamily: font.bodySemi, fontSize: 11, opacity: 0.68, marginTop: 1 },
  signed: {
    fontFamily: font.displayBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 2.2,
    opacity: 0.8,
  },
  tap: {
    marginTop: space.s5,
    fontFamily: font.bodyMed,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
  },
});
