import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, Text, View, StyleSheet } from 'react-native';
import { radius, space } from '../tokens';
import { font } from '../type';
import { haptic, useReduceMotion } from '../feel';
import {
  clubColour,
  clubCode,
  faceStats,
  initials,
  lastName,
  tierFor,
  tierLabel,
  type Pick,
  type Position,
} from '../../engine';

/** How long the card holds before it gets out of the way on its own. */
const HOLD = 3200;

const TIERS = {
  bronze: { m1: '#5E3A1C', m2: '#C88A4A', ink: '#2B1A08', edge: '#E0A868' },
  silver: { m1: '#5E6970', m2: '#CBD6DE', ink: '#1E262B', edge: '#E3ECF2' },
  gold: { m1: '#7A5F18', m2: '#E8CE7B', ink: '#2A2007', edge: '#F5DE97' },
  icon: { m1: '#100E0A', m2: '#2A2419', ink: '#F2E2B0', edge: '#D6B25E' },
} as const;

/**
 * The signing reveal. Every pick earns one.
 *
 * This is the moment the draft is actually about, and it is the single
 * biggest thing the app was missing against the site: there, landing a 92
 * rated Aguero produces a gold card; here it was a row quietly going grey.
 *
 * The tier, the six face stats and the layout are the web build's. The
 * spring, the haptic and the counting rating are not, because a browser
 * cannot do them properly.
 */
export function PlayerCard({
  player,
  slotPos,
  onDone,
}: {
  player: Pick | null;
  slotPos: Position | null;
  onDone: () => void;
}) {
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!player) return;

    haptic('success');
    t.setValue(reduce ? 1 : 0);
    if (!reduce) {
      Animated.spring(t, {
        toValue: 1,
        useNativeDriver: true,
        speed: 13,
        bounciness: 9,
      }).start();
    }

    timer.current = setTimeout(onDone, HOLD);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [player, t, reduce, onDone]);

  if (!player) return null;

  const tier = TIERS[tierFor(player.rtg)];
  const pos = slotPos ?? (player.pos[0] as Position);
  const isGK = pos === 'GK';
  const stats = faceStats(player.rtg, isGK);
  const sur = lastName(player.n);
  const club = clubColour(player.club);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDone}>
      <Pressable style={styles.backdrop} onPress={onDone}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: tier.m2,
              experimental_backgroundImage: `linear-gradient(160deg, ${tier.m1} 0%, ${tier.m2} 52%, ${tier.m1} 100%)`,
              borderColor: tier.edge,
              opacity: t,
              transform: [
                { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
              ],
            },
          ]}
        >
          <View style={[styles.topEdge, { backgroundColor: tier.edge }]} />

          {/* the initials fill the space a player photo would take */}
          <Text style={[styles.watermark, { color: tier.ink }]} numberOfLines={1}>
            {initials(player.n)}
          </Text>

          <View style={styles.top}>
            <View style={styles.spine}>
              <Text style={[styles.ovr, { color: tier.ink }]}>{player.rtg}</Text>
              <Text style={[styles.pos, { color: tier.ink }]}>{pos}</Text>
              <View style={[styles.spineRule, { backgroundColor: tier.ink }]} />
            </View>
            <Text style={[styles.kicker, { color: tier.ink }]}>
              {tierLabel(player.rtg)}
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
            {player.n !== sur ? (
              <Text style={[styles.full, { color: tier.ink }]} numberOfLines={1}>
                {player.n}
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
              <Text style={styles.discText}>{clubCode(player.club)}</Text>
            </View>
            <View style={styles.footBody}>
              <Text style={[styles.club, { color: tier.ink }]} numberOfLines={1}>
                {player.club}
              </Text>
              <Text style={[styles.season, { color: tier.ink }]}>{player.season}</Text>
            </View>
            <Text style={[styles.signed, { color: tier.ink }]}>SIGNED</Text>
          </View>
        </Animated.View>

        <Text style={styles.tap}>Tap to continue</Text>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.s5,
    backgroundColor: 'rgba(4,8,6,0.86)',
  },
  card: {
    width: 300,
    maxWidth: '92%',
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: space.s2,
    boxShadow: '0px 26px 60px rgba(0,0,0,0.60)',
  },
  topEdge: { position: 'absolute', left: 0, right: 0, top: 0, height: 3, opacity: 0.9 },
  watermark: {
    position: 'absolute',
    right: -6,
    top: 40,
    fontFamily: font.hero,
    fontSize: 118,
    lineHeight: 100,
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
    lineHeight: 50,
    fontVariant: ['tabular-nums'],
  },
  pos: {
    fontFamily: font.displayBold,
    fontSize: 13,
    letterSpacing: 2,
    marginTop: 2,
    opacity: 0.85,
  },
  spineRule: { width: 30, height: 1, opacity: 0.35, marginTop: 9 },
  kicker: {
    marginLeft: 'auto',
    fontFamily: font.displayBold,
    fontSize: 10,
    letterSpacing: 2.6,
    opacity: 0.7,
    paddingTop: 6,
  },
  body: { paddingHorizontal: 18, paddingTop: 12, alignItems: 'center' },
  name: {
    fontFamily: font.hero,
    fontSize: 32,
    lineHeight: 34,
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
    letterSpacing: 0.4,
    color: '#FFFFFF',
  },
  footBody: { flex: 1, minWidth: 0 },
  club: { fontFamily: font.displayBold, fontSize: 15, letterSpacing: 0.3 },
  season: { fontFamily: font.bodySemi, fontSize: 11, opacity: 0.68, marginTop: 1 },
  signed: {
    fontFamily: font.displayBold,
    fontSize: 10,
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
