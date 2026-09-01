import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { color, radius, space, positionColor } from '../tokens';
import { font, text } from '../type';
import { FORMATIONS, lastName } from '../../engine';
import type { Slot } from '../../engine';

export { lastName as surname } from '../../engine';

/**
 * The XI as a shape on an actual pitch.
 *
 * The web build draws a real green pitch with markings and colour coded
 * position tokens, and it is most of why its draft screen looks like a
 * game. A grid of grey boxes on a black background does not.
 *
 * Markings are one SVG behind the tokens: mowing stripes, a halfway line, a
 * centre circle and both boxes. The tokens are laid out with flexbox on
 * top, so the shape stays correct at any width without hand placing
 * anything.
 */
export function Pitch({
  squad,
  formation,
  highlight,
  preview,
  compact,
}: {
  squad: Slot[];
  formation: string;
  /** slot indexes a player being placed could go into */
  highlight?: number[];
  /** the smaller, label only version used on the setup screen */
  preview?: boolean;
  /** shorter still, for when the pitch is a progress readout beside the
   *  thing you are actually doing */
  compact?: boolean;
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
    <View style={[styles.pitch, preview && styles.pitchPreview, compact && styles.pitchCompact]}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 118" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="turf" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2F7A45" />
            <Stop offset="1" stopColor="#1B5730" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="118" fill="url(#turf)" />

        {/* mowing stripes, the thing that stops flat green reading as felt */}
        {[0, 2, 4, 6].map((n) => (
          <Rect
            key={n}
            x="0"
            y={n * 14.75}
            width="100"
            height="14.75"
            fill="#FFFFFF"
            opacity={0.035}
          />
        ))}

        <Rect x="2" y="2" width="96" height="114" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={0.7} fill="none" />
        <Line x1="2" y1="59" x2="98" y2="59" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={0.7} />
        <Circle cx="50" cy="59" r="13" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={0.7} fill="none" />
        <Circle cx="50" cy="59" r="1.1" fill="#FFFFFF" fillOpacity={0.35} />
        {/* both penalty areas and six yard boxes */}
        <Rect x="24" y="2" width="52" height="18" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={0.7} fill="none" />
        <Rect x="38" y="2" width="24" height="7" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={0.7} fill="none" />
        <Rect x="24" y="98" width="52" height="18" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={0.7} fill="none" />
        <Rect x="38" y="109" width="24" height="7" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={0.7} fill="none" />
      </Svg>

      <View style={styles.rows}>
        {rows
          .slice()
          .reverse()
          .map((indexes, r) => (
            <View key={r} style={styles.row}>
              {indexes.map((si) => {
                const slot = squad[si];
                const tint = positionColor[slot.pos];
                const filled = !!slot.player;
                const lit = highlight?.includes(si);
                return (
                  <View
                    key={si}
                    style={[
                      styles.token,
                      preview && styles.tokenPreview,
                      compact && styles.tokenCompact,
                      {
                        backgroundColor: filled ? shade(tint) : 'rgba(8,20,12,0.42)',
                        borderColor: tint,
                        boxShadow: lit
                          ? `0px 0px 14px ${tint}`
                          : '0px 3px 8px rgba(0,0,0,0.40)',
                      },
                      lit && styles.tokenLit,
                    ]}
                  >
                    {filled ? (
                      <>
                        <Text style={[styles.rating, { color: tint }]}>
                          {slot.player!.rtg}
                        </Text>
                        <Text style={styles.name} numberOfLines={1}>
                          {lastName(slot.player!.n)}
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.empty, { color: tint }]}>{slot.pos}</Text>
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

/** A filled token sits on its own position colour, darkened to stay legible. */
function shade(hex: string): string {
  return hex + '2E';
}

const styles = StyleSheet.create({
  pitch: {
    aspectRatio: 0.98,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#1F5A32',
    boxShadow: '0px 10px 24px rgba(0,0,0,0.45)',
    overflow: 'hidden',
  },
  pitchPreview: { aspectRatio: 1.12 },
  pitchCompact: { aspectRatio: 1.72 },
  rows: {
    flex: 1,
    justifyContent: 'space-evenly',
    paddingVertical: space.s3,
    paddingHorizontal: space.s2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.s2,
  },
  token: {
    flex: 1,
    maxWidth: 78,
    minHeight: 46,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  tokenPreview: { minHeight: 34, maxWidth: 62 },
  tokenCompact: { minHeight: 32, maxWidth: 64 },
  tokenLit: { borderWidth: 2.5 },
  rating: {
    fontFamily: font.displayBlack,
    fontSize: 18,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  name: {
    fontFamily: font.bodySemi,
    fontSize: 9.5,
    lineHeight: 12,
    color: '#EAF3EC',
  },
  empty: {
    ...text.key,
    fontSize: 11,
    letterSpacing: 1.1,
  },
});
