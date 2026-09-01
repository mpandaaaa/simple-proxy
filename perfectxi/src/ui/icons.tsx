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

/* ---------------------------------------------------------------------- *
 * Mode icons for the home rows. Same hand drawn language as the four
 * above: a 26 unit box, 1.8 stroke, round joins, no fills except where a
 * solid shape reads better at 20px than an outline does.
 * ---------------------------------------------------------------------- */

export function IconBack({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Path
        d="M13.4 4.6 7 11l6.4 6.4"
        stroke={color}
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconTrophy({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Path
        d="M8 3.5h10v6.2a5 5 0 0 1-10 0V3.5Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M8 5.2H4.8v2.1a3.6 3.6 0 0 0 3.2 3.6M18 5.2h3.2v2.1a3.6 3.6 0 0 1-3.2 3.6" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M13 14.7v4.1M9 22.5h8M10.4 18.8h5.2l.7 3.7h-6.6l.7-3.7Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconBank({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Path d="M3.2 9.4 13 4.2l9.8 5.2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={4.4} y1={21.4} x2={21.6} y2={21.4} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={6.8} y1={11.6} x2={6.8} y2={18.6} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={13} y1={11.6} x2={13} y2={18.6} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={19.2} y1={11.6} x2={19.2} y2={18.6} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function IconCpu({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Rect x={7} y={7} width={12} height={12} rx={2.4} stroke={color} strokeWidth={1.8} />
      <Rect x={11.2} y={11.2} width={3.6} height={3.6} rx={1} fill={color} />
      <Path
        d="M10.2 7V3.8M15.8 7V3.8M10.2 22.2V19M15.8 22.2V19M7 10.2H3.8M7 15.8H3.8M22.2 10.2H19M22.2 15.8H19"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconMedal({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Path d="M8.4 3.4 11.6 10M17.6 3.4 14.4 10" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={13} cy={16} r={6.2} stroke={color} strokeWidth={1.8} />
      <Path d="m13 12.6 1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3 1-2.1Z" fill={color} />
    </Svg>
  );
}

export function IconStar({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Path
        d="m13 3.4 3 6.1 6.7 1-4.85 4.7 1.15 6.7L13 18.75 6.99 21.9l1.15-6.7L3.3 10.5l6.7-1 3-6.1Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconCalendar({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Rect x={3.5} y={5} width={19} height={17} rx={3.2} stroke={color} strokeWidth={1.8} />
      <Line x1={3.5} y1={10} x2={22.5} y2={10} stroke={color} strokeWidth={1.8} />
      <Line x1={8.5} y1={2.8} x2={8.5} y2={6.5} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={17.5} y1={2.8} x2={17.5} y2={6.5} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={13} cy={16.2} r={2.4} fill={color} />
    </Svg>
  );
}

export function IconSpark({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Path
        d="M14.6 2.8 6.4 14.2h5.4l-1.4 9 8.2-11.4h-5.4l1.4-9Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconSwords({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Path d="M3.6 3.6h4l11 11-2.6 2.6-11-11v-2.6Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M22.4 3.6h-4l-11 11 2.6 2.6 11-11V3.6Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M5.6 18.6 8.2 21M20.4 18.6 17.8 21" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function IconKeypad({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Rect x={4.5} y={2.8} width={17} height={20.4} rx={3} stroke={color} strokeWidth={1.8} />
      <Circle cx={9.6} cy={9} r={1.5} fill={color} />
      <Circle cx={16.4} cy={9} r={1.5} fill={color} />
      <Circle cx={9.6} cy={14.2} r={1.5} fill={color} />
      <Circle cx={16.4} cy={14.2} r={1.5} fill={color} />
      <Circle cx={13} cy={19.4} r={1.5} fill={color} />
    </Svg>
  );
}
