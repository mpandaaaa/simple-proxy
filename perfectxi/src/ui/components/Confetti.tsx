import { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { color } from '../tokens';
import { useReduceMotion } from '../feel';

/**
 * Confetti, once, for winning the thing.
 *
 * The site throws this on a title and it is right to. A league win has to
 * arrive differently from a fourth place finish or the whole season has no
 * top end to it.
 *
 * One shared value drives every piece. Each piece derives its own fall,
 * drift and spin from that single clock and a set of constants fixed at
 * mount, so sixty pieces cost one animation rather than sixty. Nothing
 * here runs under Reduce Motion.
 */

const COLOURS = [
  color.gold,
  '#F0D89A',
  color.accent,
  color.accentHi,
  '#FFFFFF',
  color.blue,
];

const COUNT = 64;
const FALL_MS = 3200;

type Piece = {
  x: number;
  delay: number;
  size: number;
  tall: boolean;
  spin: number;
  drift: number;
  freq: number;
  tint: string;
};

export function Confetti({ fire }: { fire: boolean }) {
  const reduce = useReduceMotion();
  const { width, height } = useWindowDimensions();
  const p = useSharedValue(0);

  // Fixed at mount so the burst is the same shape for its whole life and
  // nothing has to be recalculated per frame.
  const pieces = useMemo<Piece[]>(() => {
    const out: Piece[] = [];
    for (let i = 0; i < COUNT; i++) {
      const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
      out.push({
        x: r(1) * width,
        delay: r(2) * 900,
        size: 5 + r(3) * 6,
        tall: r(4) > 0.45,
        spin: 2 + r(5) * 5,
        drift: (r(6) - 0.5) * 120,
        freq: 1.5 + r(7) * 2.5,
        tint: COLOURS[Math.floor(r(8) * COLOURS.length)],
      });
    }
    return out;
  }, [width]);

  useEffect(() => {
    if (!fire || reduce) return;
    p.value = 0;
    p.value = withDelay(
      260,
      withTiming(1, { duration: FALL_MS, easing: Easing.linear }),
    );
  }, [fire, reduce, p]);

  if (!fire || reduce) return null;

  return (
    <View style={styles.root} pointerEvents="none">
      {pieces.map((piece, i) => (
        <Flake key={i} piece={piece} clock={p} height={height} />
      ))}
    </View>
  );
}

function Flake({
  piece,
  clock,
  height,
}: {
  piece: Piece;
  clock: { value: number };
  height: number;
}) {
  const style = useAnimatedStyle(() => {
    // Each piece runs its own window inside the one clock, so they do not
    // all leave the top of the screen together.
    const t = Math.max(0, Math.min(1, (clock.value * FALL_MS - piece.delay) / FALL_MS));
    if (t <= 0) return { opacity: 0 };
    const y = -30 + t * (height + 120);
    const x = piece.x + Math.sin(t * Math.PI * 2 * piece.freq) * piece.drift;
    return {
      opacity: t > 0.86 ? (1 - t) / 0.14 : 1,
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${t * piece.spin * 360}deg` },
        { scaleX: Math.cos(t * Math.PI * 2 * piece.freq * 1.4) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: piece.size,
          height: piece.tall ? piece.size * 2.1 : piece.size,
          borderRadius: piece.tall ? 1.5 : piece.size / 2,
          backgroundColor: piece.tint,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },
});
