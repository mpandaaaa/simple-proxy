import { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { color, positionColor, radius, space } from '../tokens';
import { font, text } from '../type';
import { GRAIN_URI } from '../grain';
import { ClubDisc } from './ClubDisc';
import { Trophy } from './Trophy';
import { lastName, type Slot } from '../../engine';

/**
 * The picture you send to someone.
 *
 * Rendered at a fixed 360 by 450 and captured at three times that, which
 * is 1080 by 1350, the tallest thing Instagram and X will show without
 * cropping. Fixed rather than responsive on purpose: this is not a screen,
 * it is a print, and it has to look the same coming off every phone.
 *
 * It lives off screen with a fixed size rather than being a screenshot of
 * the results page, because a screenshot carries the header, the scroll
 * position and the notch, and none of those belong in a picture.
 */
export const CARD_W = 360;
export const CARD_H = 450;

export const ShareCard = forwardRef<View, {
  squad: Slot[];
  formation: string;
  position: number;
  points: number;
  grade: string;
  title: string;
  tint: string;
  honours: string[];
}>(function ShareCard(
  { squad, formation, position, points, grade, title, tint, honours },
  ref,
) {
  const filled = squad.filter((s) => s.player);
  const champion = position === 1;

  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.bloom} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="shareBloom" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={tint} stopOpacity={0.34} />
              <Stop offset="1" stopColor={tint} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50" cy="4" rx="70" ry="46" fill="url(#shareBloom)" />
        </Svg>
      </View>
      <View style={styles.grain} pointerEvents="none">
        <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.fill} />
      </View>
      <View style={[styles.edge, { backgroundColor: tint + '99' }]} pointerEvents="none" />

      <View style={styles.head}>
        <View style={styles.headLeft}>
          <Text style={styles.kicker}>Perfect XI</Text>
          <Text style={[styles.title, { color: tint }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.meta}>
            {formation} {'·'} {points} points {'·'} grade {grade}
          </Text>
        </View>
        {champion ? (
          <Trophy size={56} tint={tint} />
        ) : (
          <View style={[styles.pos, { borderColor: tint }]}>
            <Text style={[styles.posNum, { color: tint }]} allowFontScaling={false}>
              {position}
            </Text>
          </View>
        )}
      </View>

      {honours.length ? (
        <View style={styles.honours}>
          {honours.slice(0, 3).map((h) => (
            <View key={h} style={styles.honour}>
              <Text style={styles.honourText}>{h}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.list}>
        {filled.map((s) => (
          <View key={s.player!.n} style={styles.row}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: positionColor[s.pos] + '26',
                  borderColor: positionColor[s.pos] + '66',
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: positionColor[s.pos] }]}>
                {s.pos}
              </Text>
            </View>
            <ClubDisc club={s.player!.club} size={18} />
            <Text style={styles.name} numberOfLines={1}>
              {lastName(s.player!.n)}
            </Text>
            <Text style={styles.club} numberOfLines={1}>
              {s.player!.club} {s.player!.season}
            </Text>
            <Text style={styles.rtg} allowFontScaling={false}>
              {s.player!.rtg}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.foot}>perfectxi.app</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    padding: 18,
    backgroundColor: '#0A0F0C',
    experimental_backgroundImage:
      'linear-gradient(180deg, #12201A 0%, #0B120E 55%, #070B08 100%)',
    overflow: 'hidden',
  },
  fill: { width: '100%', height: '100%' },
  grain: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.06 },
  bloom: { position: 'absolute', top: -30, left: -30, right: -30, height: 180 },
  edge: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },

  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headLeft: { flex: 1, minWidth: 0 },
  kicker: { ...text.key, fontSize: 9, color: color.text3 },
  title: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: 0.3,
    marginTop: 1,
  },
  meta: { fontFamily: font.body, fontSize: 11, lineHeight: 15, color: color.text3 },
  pos: {
    width: 54,
    height: 54,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posNum: { fontFamily: font.hero, fontSize: 27, lineHeight: 35 },

  honours: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  honour: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.5)',
    backgroundColor: 'rgba(214,178,94,0.14)',
  },
  honourText: { ...text.key, fontSize: 7.5, color: color.gold },

  list: { flex: 1, marginTop: 10, justifyContent: 'space-evenly' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  badge: {
    width: 28,
    height: 17,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...text.key, fontSize: 7 },
  name: {
    fontFamily: font.bodyBold,
    fontSize: 13,
    lineHeight: 17,
    color: color.text1,
    maxWidth: 118,
  },
  club: { flex: 1, fontFamily: font.body, fontSize: 9.5, lineHeight: 13, color: color.text3 },
  rtg: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 18,
    color: color.accentHi,
    fontVariant: ['tabular-nums'],
    width: 22,
    textAlign: 'right',
  },

  foot: {
    ...text.key,
    fontSize: 8.5,
    color: color.text3,
    textAlign: 'center',
    marginTop: space.s2,
  },
});
