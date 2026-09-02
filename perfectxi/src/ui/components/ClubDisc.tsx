import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import { clubCode, clubColour } from '../../engine';
import { font } from '../type';

/**
 * A club badge as an object, not a coloured dot.
 *
 * Four things turn a flat circle into enamel: a radial fill lit from the
 * top left rather than a solid colour, a bright highlight sitting on the
 * upper curve, a dark pool in the lower one, and a thin rim catching light
 * around the whole edge. All four are cheap, and without them the disc
 * reads as a placeholder avatar.
 */
export function ClubDisc({
  club,
  size = 40,
  code,
  square,
}: {
  club: string | null | undefined;
  size?: number;
  /** override the three letters, for anything that is not a club */
  code?: string;
  /** a rounded tile rather than a circle, as the era card uses */
  square?: boolean;
}) {
  const base = clubColour(club);
  const id = `d${Math.abs(hash(base + size + (square ? 's' : 'c')))}`;
  const rr = square ? 26 : 50;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          {/* lit from the upper left, the way a badge sits under a light */}
          <RadialGradient id={`${id}f`} cx="34%" cy="26%" r="82%">
            <Stop offset="0" stopColor={lighten(base, 0.45)} />
            <Stop offset="0.45" stopColor={base} />
            <Stop offset="1" stopColor={darken(base, 0.55)} />
          </RadialGradient>
          {/* the highlight riding the top curve */}
          <RadialGradient id={`${id}h`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.5} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
          {/* and the shadow pooling in the bottom of it */}
          <RadialGradient id={`${id}s`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#000000" stopOpacity={0.42} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect x="1" y="1" width="98" height="98" rx={rr} ry={rr} fill={`url(#${id}f)`} />
        <Ellipse cx="50" cy="26" rx="34" ry="20" fill={`url(#${id}h)`} />
        <Ellipse cx="50" cy="82" rx="40" ry="22" fill={`url(#${id}s)`} />
        {/* rim: bright where the light is, dark where it is not */}
        <Rect
          x="1"
          y="1"
          width="98"
          height="98"
          rx={rr}
          ry={rr}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.34}
          strokeWidth={2}
        />
        <Rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx={Math.max(0, rr - 3)}
          ry={Math.max(0, rr - 3)}
          fill="none"
          stroke="#000000"
          strokeOpacity={0.22}
          strokeWidth={2}
        />
      </Svg>

      <View style={styles.label} pointerEvents="none">
        <Text
          style={[styles.code, { fontSize: size * 0.32 }]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {code ?? clubCode(club)}
        </Text>
      </View>
    </View>
  );
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex(c: number): string {
  return Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0');
}

export function lighten(hex: string, amount: number): string {
  const [r, g, b] = channels(hex);
  return `#${toHex(r + (255 - r) * amount)}${toHex(g + (255 - g) * amount)}${toHex(b + (255 - b) * amount)}`;
}

export function darken(hex: string, amount: number): string {
  const [r, g, b] = channels(hex);
  return `#${toHex(r * (1 - amount))}${toHex(g * (1 - amount))}${toHex(b * (1 - amount))}`;
}

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  code: {
    fontFamily: font.displayBold,
    letterSpacing: 0.4,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
