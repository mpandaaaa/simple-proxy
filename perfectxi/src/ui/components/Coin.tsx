import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { hue } from '../tokens';
import { font } from '../type';

/**
 * The coin.
 *
 * Every number in Your Game was a bare figure with the word "coins"
 * somewhere near it, and a currency without a mark is a currency people
 * have to read twice. This is the mark: a struck disc with a rim, lit
 * from the top left like the club badges are, with a P on it.
 *
 * Drawn rather than an emoji, so it sits on the baseline where it is put,
 * takes the size it is given, and looks like the same object at twelve
 * points and at forty.
 */
export function Coin({ size = 16 }: { size?: number }) {
  const id = `coin${Math.round(size)}`;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={`${id}f`} cx="34%" cy="28%" r="80%">
            <Stop offset="0" stopColor="#F6E3AC" />
            <Stop offset="0.5" stopColor={hue.gold} />
            <Stop offset="1" stopColor="#8C6B22" />
          </RadialGradient>
          <LinearGradient id={`${id}r`} x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor="#FBF0CE" />
            <Stop offset="1" stopColor="#7A5C1B" />
          </LinearGradient>
        </Defs>
        {/* the rim, then the face sunk inside it */}
        <Circle cx="50" cy="50" r="48" fill={`url(#${id}r)`} />
        <Circle cx="50" cy="50" r="41" fill={`url(#${id}f)`} />
        {/* the light sitting on the upper curve */}
        <Path
          d="M 22 38 A 34 34 0 0 1 68 20"
          stroke="#FFF6DA"
          strokeOpacity={0.55}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <View style={styles.letter} pointerEvents="none">
        <Text
          style={[styles.letterText, { fontSize: size * 0.52, lineHeight: size * 0.72 }]}
          allowFontScaling={false}
        >
          P
        </Text>
      </View>
    </View>
  );
}

/**
 * A number with its thousands separated.
 *
 * Twenty thousand and forty three read as 20043, which is a number
 * nobody can take in at a glance. Everything that shows coins, cards or
 * experience goes through here.
 */
export function commas(n: number): string {
  return Math.round(n).toLocaleString('en-GB');
}

const styles = StyleSheet.create({
  letter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: {
    fontFamily: font.displayBlack,
    color: '#5E4413',
    textAlign: 'center',
  },
});
