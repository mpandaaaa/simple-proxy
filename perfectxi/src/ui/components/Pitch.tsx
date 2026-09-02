import { Text, View, StyleSheet } from 'react-native';
import Svg, { Rect, Line as SvgLine, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { color, radius, space, positionColor } from '../tokens';
import { font, text } from '../type';
import { FORMATIONS, lastName } from '../../engine';
import type { Position, Slot } from '../../engine';

export { lastName as surname } from '../../engine';

const LEGEND: Position[] = ['GK', 'DEF', 'MID', 'ATT'];

/**
 * The XI as a shape on an actual pitch.
 *
 * Built to match the web build: turf with real markings, the formation
 * named in a pill top left, a colour key top right, and slots big enough to
 * read at a glance rather than dots to be decoded.
 *
 * Empty slots wear the accent, not their position colour. They are all
 * equally "not filled yet", and colouring them by position makes an empty
 * pitch look like a finished one. The colour arrives when a player does.
 */
export function Pitch({
  squad,
  formation,
  highlight,
  preview,
}: {
  squad: Slot[];
  formation: string;
  /** slot indexes a player being placed could go into */
  highlight?: number[];
  /** the shorter, label only version used on the setup screen */
  preview?: boolean;
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
            <Stop offset="0" stopColor="#2E7A44" />
            <Stop offset="1" stopColor="#1C5B32" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="76" fill="url(#turf)" />

        {/* mowing bands: the thing that stops flat green reading as felt */}
        {[0, 2, 4, 6].map((n) => (
          <Rect key={n} x="0" y={n * 9.5} width="100" height="9.5" fill="#FFFFFF" opacity={0.03} />
        ))}

        <Rect x="1.5" y="1.5" width="97" height="73" stroke="#FFFFFF" strokeOpacity={0.22} strokeWidth={0.5} fill="none" />
        <SvgLine x1="1.5" y1="38" x2="98.5" y2="38" stroke="#FFFFFF" strokeOpacity={0.22} strokeWidth={0.5} />
        <Circle cx="50" cy="38" r="11" stroke="#FFFFFF" strokeOpacity={0.18} strokeWidth={0.5} fill="none" />
        <Circle cx="50" cy="38" r="0.9" fill="#FFFFFF" fillOpacity={0.3} />
        <Rect x="28" y="1.5" width="44" height="12" stroke="#FFFFFF" strokeOpacity={0.2} strokeWidth={0.5} fill="none" />
        <Rect x="39" y="1.5" width="22" height="5" stroke="#FFFFFF" strokeOpacity={0.2} strokeWidth={0.5} fill="none" />
        <Rect x="28" y="62.5" width="44" height="12" stroke="#FFFFFF" strokeOpacity={0.2} strokeWidth={0.5} fill="none" />
        <Rect x="39" y="69.5" width="22" height="5" stroke="#FFFFFF" strokeOpacity={0.2} strokeWidth={0.5} fill="none" />
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
              {indexes.map((si) => {
                const slot = squad[si];
                const filled = !!slot.player;
                const lit = highlight?.includes(si);
                const tint = filled ? positionColor[slot.pos] : color.accent;
                return (
                  <View
                    key={si}
                    style={[
                      styles.slot,
                      preview && styles.slotPreview,
                      {
                        borderColor: tint,
                        backgroundColor: filled
                          ? tint + '2B'
                          : 'rgba(8,26,14,0.34)',
                        boxShadow: lit
                          ? `0px 0px 16px ${tint}`
                          : `0px 0px 8px ${tint}55`,
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
                      </>
                    ) : (
                      <Text style={styles.empty}>{slot.pos}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pitch: {
    aspectRatio: 1.38,
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
    letterSpacing: 0.6,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },

  legend: { position: 'absolute', top: space.s3, right: space.s3, gap: 3 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: {
    ...text.key,
    fontSize: 8.5,
    color: 'rgba(255,255,255,0.66)',
  },

  rows: {
    flex: 1,
    justifyContent: 'space-evenly',
    paddingVertical: space.s4,
    paddingHorizontal: space.s2,
  },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  slot: {
    width: 62,
    height: 46,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  slotPreview: { width: 54, height: 38 },
  slotLit: { borderWidth: 2.5 },

  rating: {
    fontFamily: font.displayBlack,
    fontSize: 19,
    lineHeight: 21,
    fontVariant: ['tabular-nums'],
  },
  name: {
    fontFamily: font.bodySemi,
    fontSize: 9.5,
    lineHeight: 12,
    color: '#EAF3EC',
  },
  empty: {
    fontFamily: font.displayBold,
    fontSize: 14,
    letterSpacing: 0.8,
    color: '#FFFFFF',
  },
});
