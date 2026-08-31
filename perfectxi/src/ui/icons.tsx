import type { ColorValue } from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

/**
 * Hand drawn tab icons rather than a generic icon set.
 *
 * A crest, a shirt and a pitch say football before a single word is read,
 * and they keep the app from looking like every other tab bar.
 */
type IconProps = { color: ColorValue; size?: number };

const S = 26;

export function IconToday({ color, size = S }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      {/* a match day square: fixture card with today marked */}
      <Rect x={3.5} y={5} width={19} height={17} rx={3.2} stroke={color} strokeWidth={1.8} />
      <Line x1={3.5} y1={10} x2={22.5} y2={10} stroke={color} strokeWidth={1.8} />
      <Line x1={8.5} y1={2.8} x2={8.5} y2={6.5} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={17.5} y1={2.8} x2={17.5} y2={6.5} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={13} cy={16.2} r={2.6} fill={color} />
    </Svg>
  );
}

export function IconPlay({ color, size = S }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      {/* a pitch seen from above */}
      <Rect x={2.5} y={4.5} width={21} height={17} rx={2.4} stroke={color} strokeWidth={1.8} />
      <Line x1={13} y1={4.5} x2={13} y2={21.5} stroke={color} strokeWidth={1.6} />
      <Circle cx={13} cy={13} r={3.4} stroke={color} strokeWidth={1.6} />
      <Path d="M2.5 9.6h3.2v6.8H2.5M23.5 9.6h-3.2v6.8h3.2" stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

export function IconCareer({ color, size = S }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      {/* a club crest */}
      <Path
        d="M13 2.6 4 5.4v7.2c0 5 3.7 8.6 9 10.8 5.3-2.2 9-5.8 9-10.8V5.4L13 2.6Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M9.6 12.6l2.4 2.5 4.6-5" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconYou({ color, size = S }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      {/* a shirt */}
      <Path
        d="M9.4 3.6 4 6.4l2 4.6 2.1-.9v11.3h9.8V10.1l2.1.9 2-4.6-5.4-2.8a3.2 3.2 0 0 1-7.2 0Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconChevron({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Path d="M6.8 4.2 11.6 9l-4.8 4.8" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
