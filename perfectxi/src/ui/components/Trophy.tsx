import Svg, { Defs, LinearGradient, Path, Stop, Ellipse, Rect } from 'react-native-svg';

/**
 * A trophy, drawn rather than typed.
 *
 * An emoji trophy is whatever the phone's font decides it is, at whatever
 * weight, and it looks like a character in a sentence. Winning the league
 * is the biggest thing that happens in the app and it deserves an object
 * with metal on it.
 */
export function Trophy({ size = 92, tint = '#D6B25E' }: { size?: number; tint?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="tpBowl" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FBEFC9" />
          <Stop offset="0.34" stopColor={tint} />
          <Stop offset="0.72" stopColor="#9A7A32" />
          <Stop offset="1" stopColor="#E4C97F" />
        </LinearGradient>
        <LinearGradient id="tpStem" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#8E6F2C" />
          <Stop offset="0.4" stopColor={tint} />
          <Stop offset="1" stopColor="#7E6227" />
        </LinearGradient>
        <LinearGradient id="tpShine" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* handles */}
      <Path
        d="M28 24 C12 24, 10 46, 30 52"
        fill="none"
        stroke="url(#tpStem)"
        strokeWidth={5.5}
        strokeLinecap="round"
      />
      <Path
        d="M72 24 C88 24, 90 46, 70 52"
        fill="none"
        stroke="url(#tpStem)"
        strokeWidth={5.5}
        strokeLinecap="round"
      />

      {/* the bowl */}
      <Path
        d="M27 20 H73 V40 C73 57, 63 66, 50 66 C37 66, 27 57, 27 40 Z"
        fill="url(#tpBowl)"
      />
      {/* light riding the left of the bowl */}
      <Path
        d="M33 23 H41 V41 C41 52, 38 58, 35 60 C32 55, 33 46, 33 40 Z"
        fill="url(#tpShine)"
      />
      {/* rim */}
      <Rect x="24" y="17" width="52" height="7" rx="3" fill="url(#tpBowl)" />
      <Rect x="24" y="17" width="52" height="2.2" rx="1.1" fill="#FFF6DC" opacity={0.75} />

      {/* stem and base */}
      <Rect x="45" y="66" width="10" height="11" fill="url(#tpStem)" />
      <Path d="M34 77 H66 L69 85 H31 Z" fill="url(#tpBowl)" />
      <Rect x="27" y="85" width="46" height="8" rx="3" fill="url(#tpBowl)" />
      <Rect x="27" y="85" width="46" height="2" rx="1" fill="#FFF6DC" opacity={0.6} />
      <Ellipse cx="50" cy="95" rx="27" ry="3" fill="#000000" opacity={0.28} />
    </Svg>
  );
}
