import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { color, line, radius, space } from '../tokens';
import { font, text } from '../type';

/**
 * The season as a line.
 *
 * Thirty eight scores in a grid is a spreadsheet: you can read any one of
 * them and none of them tell you anything. The shape of a season is the
 * interesting part, and the shape is where you were in the table week by
 * week. A run of five wins in October is a cliff on this and nothing at
 * all in a grid.
 *
 * First is at the top, twentieth at the bottom, the top four and the drop
 * shaded behind, and every matchday a dot in the colour of what happened.
 */
export function SeasonCurve({
  positions,
  outcomes,
  tint,
}: {
  /** where the XI stood after each matchday, 1 to 20 */
  positions: number[];
  outcomes: ('win' | 'draw' | 'loss')[];
  tint: string;
}) {
  const [w, setW] = useState(0);
  const H = 168;
  const PAD_T = 14;
  const PAD_B = 20;
  const PAD_L = 30;
  const PAD_R = 10;

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const geo = useMemo(() => {
    if (w <= 0 || !positions.length) return null;
    const innerW = Math.max(1, w - PAD_L - PAD_R);
    const innerH = H - PAD_T - PAD_B;
    const x = (i: number) =>
      PAD_L + (positions.length === 1 ? innerW / 2 : (i / (positions.length - 1)) * innerW);
    // 1st at the top, 20th at the bottom.
    const y = (pos: number) => PAD_T + ((Math.max(1, Math.min(20, pos)) - 1) / 19) * innerH;

    const pts = positions.map((p, i) => ({ x: x(i), y: y(p) }));

    // A rounded path, so a season reads as a curve rather than as a saw.
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const mx = (a.x + b.x) / 2;
      d += ` C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
    }
    const area = `${d} L ${pts[pts.length - 1].x} ${PAD_T} L ${pts[0].x} ${PAD_T} Z`;

    return {
      pts,
      d,
      area,
      innerW,
      top4: y(4.5),
      drop: y(17.5),
      bottom: PAD_T + innerH,
    };
  }, [w, positions]);

  return (
    <View style={styles.root} onLayout={onLayout}>
      {geo ? (
        <Svg width={w} height={H}>
          <Defs>
            <LinearGradient id="scArea" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor={tint} stopOpacity={0} />
              <Stop offset="1" stopColor={tint} stopOpacity={0.22} />
            </LinearGradient>
          </Defs>

          {/* the two bands that matter: Europe at the top, the drop at the foot */}
          <Rect
            x={PAD_L}
            y={PAD_T}
            width={geo.innerW}
            height={geo.top4 - PAD_T}
            fill={color.accent}
            opacity={0.07}
          />
          <Rect
            x={PAD_L}
            y={geo.drop}
            width={geo.innerW}
            height={geo.bottom - geo.drop}
            fill={color.danger}
            opacity={0.08}
          />
          <Path
            d={`M ${PAD_L} ${geo.top4} H ${PAD_L + geo.innerW}`}
            stroke={color.accent}
            strokeOpacity={0.3}
            strokeWidth={1}
            strokeDasharray="3 4"
          />
          <Path
            d={`M ${PAD_L} ${geo.drop} H ${PAD_L + geo.innerW}`}
            stroke={color.danger}
            strokeOpacity={0.3}
            strokeWidth={1}
            strokeDasharray="3 4"
          />

          <Path d={geo.area} fill="url(#scArea)" />
          <Path
            d={geo.d}
            fill="none"
            stroke={tint}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {geo.pts.map((pt, i) => (
            <Circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={i === geo.pts.length - 1 ? 4.6 : 2.2}
              fill={
                outcomes[i] === 'win'
                  ? color.win
                  : outcomes[i] === 'draw'
                    ? color.draw
                    : color.loss
              }
              stroke={i === geo.pts.length - 1 ? '#0A0F0C' : undefined}
              strokeWidth={i === geo.pts.length - 1 ? 2 : undefined}
            />
          ))}
        </Svg>
      ) : (
        <View style={{ height: H }} />
      )}

      {/* the axis, as two words rather than a ruler */}
      <Text style={[styles.axis, { top: PAD_T - 6 }]}>1st</Text>
      <Text style={[styles.axis, { top: H - PAD_B - 12 }]}>20th</Text>
      <View style={styles.foot}>
        <Text style={styles.footText}>Matchday 1</Text>
        <Text style={styles.footText}>38</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#0D1610',
    experimental_backgroundImage: 'linear-gradient(180deg, #14211A 0%, #0B120E 100%)',
    boxShadow:
      'inset 0px 1px 0px rgba(255,255,255,0.06), inset 0px 0px 0px 1px rgba(255,255,255,0.035)',
    overflow: 'hidden',
    paddingBottom: space.s2,
  },
  axis: {
    position: 'absolute',
    left: space.s2,
    fontFamily: font.displaySemi,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 0.6,
    color: color.text3,
  },
  foot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.s3,
    marginTop: -space.s2,
  },
  footText: { ...text.key, fontSize: 8, color: color.text3 },
});
