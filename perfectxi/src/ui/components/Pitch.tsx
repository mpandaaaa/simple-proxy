import { useCallback, useEffect, useRef } from 'react';
import { Text, View, StyleSheet } from 'react-native';
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
import Svg, { Rect, Line as SvgLine, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { color, radius, space, positionColor } from '../tokens';
import { font, text } from '../type';
import { useReduceMotion } from '../feel';
import { FORMATIONS, clubColour, lastName } from '../../engine';
import type { Position, Slot } from '../../engine';

export { lastName as surname } from '../../engine';

const LEGEND: Position[] = ['GK', 'DEF', 'MID', 'ATT'];

/**
 * The XI as a shape on an actual pitch.
 *
 * Same anatomy as the web build: turf with real markings, the formation in
 * a pill top left, the colour key top right. What the web could not do is
 * make it a team sheet rather than a diagram, so a filled slot here is a
 * small player card. The rating sits in the hero face, the surname under
 * it, and a bar of the club's own colour runs along the bottom, so eleven
 * players from eleven clubs read as eleven different signings.
 *
 * Empty slots wear the accent, not their position colour. They are all
 * equally "not filled yet", and colouring them by position makes an empty
 * pitch look like a finished one. The colour arrives when a player does.
 */
export type SlotRect = { x: number; y: number; w: number; h: number };

export function Pitch({
  squad,
  formation,
  highlight,
  preview,
  onSlotRect,
  flash,
  measureTick,
}: {
  squad: Slot[];
  formation: string;
  /** slot indexes a player being placed could go into */
  highlight?: number[];
  /** the shorter, label only version used on the setup screen */
  preview?: boolean;
  /** where each slot sits on screen, so a signing can be flown into it */
  onSlotRect?: (index: number, rect: SlotRect) => void;
  /** the slot a signing has just landed in, which lights up */
  flash?: number | null;
  /** bump to make every slot measure itself again after a scroll */
  measureTick?: number;
}) {
  const fm = FORMATIONS[formation];
  if (!fm) return null;

  const rows: number[][] = [];
  let i = 0;
  for (const row of fm.rows) {
    const indexes: number[] = [];
    for (let c = 0; c < row.length; c++) indexes.push(i++);
    rows.push(indexes);
  }

  return (
    <View style={[styles.pitch, preview && styles.pitchPreview]}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 76" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="turf" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#31824A" />
            <Stop offset="1" stopColor="#194F2C" />
          </LinearGradient>
          <LinearGradient id="turfShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.34} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="76" fill="url(#turf)" />

        {/* mowing bands: the thing that stops flat green reading as felt */}
        {[0, 2, 4, 6].map((n) => (
          <Rect key={n} x="0" y={n * 9.5} width="100" height="9.5" fill="#FFFFFF" opacity={0.032} />
        ))}

        <Rect x="1.5" y="1.5" width="97" height="73" stroke="#FFFFFF" strokeOpacity={0.22} strokeWidth={0.5} fill="none" />
        <SvgLine x1="1.5" y1="38" x2="98.5" y2="38" stroke="#FFFFFF" strokeOpacity={0.22} strokeWidth={0.5} />
        <Circle cx="50" cy="38" r="11" stroke="#FFFFFF" strokeOpacity={0.18} strokeWidth={0.5} fill="none" />
        <Circle cx="50" cy="38" r="0.9" fill="#FFFFFF" fillOpacity={0.3} />
        <Rect x="28" y="1.5" width="44" height="12" stroke="#FFFFFF" strokeOpacity={0.2} strokeWidth={0.5} fill="none" />
        <Rect x="39" y="1.5" width="22" height="5" stroke="#FFFFFF" strokeOpacity={0.2} strokeWidth={0.5} fill="none" />
        <Rect x="28" y="62.5" width="44" height="12" stroke="#FFFFFF" strokeOpacity={0.2} strokeWidth={0.5} fill="none" />
        <Rect x="39" y="69.5" width="22" height="5" stroke="#FFFFFF" strokeOpacity={0.2} strokeWidth={0.5} fill="none" />
        {/* the far end falls into shade, so the pitch has a horizon */}
        <Rect x="0" y="0" width="100" height="76" fill="url(#turfShade)" />
      </Svg>

      <View style={styles.formationPill}>
        <Text style={styles.formationText}>{formation}</Text>
      </View>

      <View style={styles.legend} pointerEvents="none">
        {LEGEND.map((p) => (
          <View key={p} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: positionColor[p] }]} />
            <Text style={styles.legendText}>{p}</Text>
          </View>
        ))}
      </View>

      <View style={styles.rows}>
        {rows
          .slice()
          .reverse()
          .map((indexes, r) => (
            <View key={r} style={styles.row}>
              {indexes.map((si) => (
                <PitchSlot
                  key={si}
                  index={si}
                  slot={squad[si]}
                  lit={!!highlight?.includes(si)}
                  preview={!!preview}
                  onRect={onSlotRect}
                  flash={flash === si}
                  measureTick={measureTick}
                />
              ))}
            </View>
          ))}
      </View>
    </View>
  );
}

/**
 * One slot.
 *
 * A player springs into it rather than appearing in it, and an empty slot
 * that could take the player you are holding breathes, so the pitch answers
 * "where can he go" without anyone having to read anything.
 */
function PitchSlot({
  index,
  slot,
  lit,
  preview,
  onRect,
  flash,
  measureTick,
}: {
  index: number;
  slot: Slot;
  lit: boolean;
  preview: boolean;
  onRect?: (index: number, rect: SlotRect) => void;
  flash?: boolean;
  measureTick?: number;
}) {
  const reduce = useReduceMotion();
  const filled = !!slot.player;
  const tint = filled ? positionColor[slot.pos] : color.accent;

  const land = useSharedValue(filled ? 1 : 0);
  const pulse = useSharedValue(0);
  const hit = useSharedValue(0);
  const box = useRef<View>(null);

  /**
   * Where this slot is on screen. Measured after layout has settled, so a
   * signing card can be flown into the exact box it belongs in rather than
   * fading out over the middle of the pitch.
   */
  const measure = useCallback(() => {
    if (!onRect) return;
    requestAnimationFrame(() => {
      box.current?.measureInWindow((x, y, w, h) => {
        if (w > 0) onRect(index, { x, y, w, h });
      });
    });
  }, [index, onRect]);

  // Asked to re-measure: the page has scrolled since layout.
  useEffect(() => {
    measure();
  }, [measureTick, measure]);

  // The card arriving in the slot.
  useEffect(() => {
    if (!flash || reduce) return;
    hit.value = withSequence(
      withSpring(1, { stiffness: 380, damping: 10, mass: 1 }),
      withSpring(0, { stiffness: 200, damping: 16, mass: 1 }),
    );
  }, [flash, hit, reduce]);

  // The signing arriving in its slot.
  useEffect(() => {
    if (!filled) {
      land.value = 0;
      return;
    }
    if (reduce) {
      land.value = 1;
      return;
    }
    land.value = 0;
    land.value = withDelay(
      60,
      withSpring(1, { stiffness: 200, damping: 13, mass: 1 }),
    );
  }, [filled, slot.player?.n, land, reduce]);

  // An open slot the held player could fill.
  useEffect(() => {
    if (!lit || reduce) {
      pulse.value = withTiming(0, { duration: 160 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 620, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 620, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [lit, pulse, reduce]);

  const style = useAnimatedStyle(() => ({
    transform: [
      {
        scale:
          (filled ? 0.86 + land.value * 0.14 : 1 + pulse.value * 0.05) *
          (1 + hit.value * 0.16),
      },
    ],
    opacity: filled ? 0.35 + land.value * 0.65 : 1,
  }));

  return (
    <Animated.View
      ref={box}
      onLayout={measure}
      style={[
        styles.slot,
        preview && styles.slotPreview,
        style,
        {
          borderColor: tint,
          backgroundColor: filled ? tint + '26' : 'rgba(8,26,14,0.36)',
          boxShadow: flash
            ? `0px 0px 26px ${tint}, 0px 0px 10px ${tint}`
            : lit
              ? `0px 0px 18px ${tint}`
              : filled
                ? `0px 3px 10px rgba(0,0,0,0.45), 0px 0px 10px ${tint}44`
                : `0px 0px 8px ${tint}44`,
        },
        lit && styles.slotLit,
      ]}
    >
      {filled ? (
        <>
          <Text style={[styles.rating, { color: tint }]} allowFontScaling={false}>
            {slot.player!.rtg}
          </Text>
          <Text style={styles.name} numberOfLines={1}>
            {lastName(slot.player!.n)}
          </Text>
          {/* the club's own colour, so eleven signings read as eleven clubs */}
          <View
            style={[styles.clubBar, { backgroundColor: clubColour(slot.player!.club) }]}
          />
        </>
      ) : (
        <Text style={styles.empty}>{slot.pos}</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pitch: {
    aspectRatio: 1.32,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    backgroundColor: '#1F5A32',
    boxShadow: '0px 12px 26px rgba(0,0,0,0.45)',
    overflow: 'hidden',
  },
  pitchPreview: { aspectRatio: 1.55 },

  formationPill: {
    position: 'absolute',
    top: space.s3,
    left: space.s3,
    paddingHorizontal: space.s3,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(6,14,9,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  formationText: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 17,
    letterSpacing: 0.6,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },

  legend: { position: 'absolute', top: space.s3, right: space.s3, gap: 3 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { ...text.key, fontSize: 8.5, color: 'rgba(255,255,255,0.66)' },

  rows: {
    flex: 1,
    justifyContent: 'space-evenly',
    paddingVertical: space.s4,
    paddingHorizontal: space.s2,
  },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  slot: {
    width: 64,
    height: 52,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingTop: 2,
    overflow: 'hidden',
  },
  slotPreview: { width: 54, height: 38 },
  slotLit: { borderWidth: 2.5 },

  rating: {
    fontFamily: font.hero,
    fontSize: 21,
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
  },
  name: {
    fontFamily: font.bodyBold,
    fontSize: 9.5,
    lineHeight: 12,
    color: '#F2F8F3',
    marginTop: -1,
  },
  clubBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
  },
  empty: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 17,
    letterSpacing: 0.8,
    color: '#FFFFFF',
  },
});
