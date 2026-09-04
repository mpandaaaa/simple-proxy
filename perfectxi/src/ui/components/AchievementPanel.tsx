import { Image, StyleSheet, Text, View } from 'react-native';
import { go } from '../../game/nav';
import { color, line, radius, space } from '../tokens';
import { font, text } from '../type';
import { GRAIN_URI } from '../grain';
import { haptic } from '../feel';
import { ACHIEVEMENTS, nextUp, recent, type Career } from '../../game/achievements';
import { Press } from './Press';
import { Shine } from './Shine';

/**
 * Achievements, on the front door.
 *
 * They were behind a collapsed group at the bottom of Home, which is a
 * good way to build fifty three of something nobody ever sees. This is the
 * opposite: how far through you are, the last few you earned, and the
 * three you are closest to, so there is always a reason to play one more
 * season sitting on the home screen.
 */
export function AchievementPanel({ career }: { career: Career }) {
  const got = career.earned.length;
  const total = ACHIEVEMENTS.length;
  const latest = recent(career, 4);
  const targets = nextUp(career, 3);
  const pct = Math.round((got / total) * 100);

  return (
    <Press
      onPress={() => {
        haptic('light');
        go('/cabinet');
      }}
      feel="none"
      scaleTo={0.99}
      style={styles.card}
    >
      <Shine radius={radius.lg} group="feature" bevel={false} clip={false} />
      <View style={styles.grain} pointerEvents="none">
        <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.fill} />
      </View>

      <View style={styles.head}>
        <Text style={styles.key}>Achievements</Text>
        <Text style={styles.count} allowFontScaling={false}>
          {got} <Text style={styles.countOf}>of {total}</Text>
        </Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fillBar, { width: `${Math.max(2, pct)}%` }]} />
      </View>

      {latest.length ? (
        <View style={styles.recent}>
          <Text style={styles.rowKey}>Latest</Text>
          <View style={styles.marks}>
            {latest.map((a) => (
              <View key={a.key} style={styles.mark}>
                <Text style={styles.markText} allowFontScaling={false}>
                  {a.mark}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.latestName} numberOfLines={1}>
            {latest[0].name}
          </Text>
        </View>
      ) : null}

      {targets.length ? (
        <View style={styles.targets}>
          <Text style={styles.rowKey}>Closest</Text>
          {targets.map((t) => (
            <View key={t.achievement.key} style={styles.target}>
              <Text style={styles.targetMark} allowFontScaling={false}>
                {t.achievement.mark}
              </Text>
              <View style={styles.targetBody}>
                <Text style={styles.targetName} numberOfLines={1}>
                  {t.achievement.name}
                </Text>
                <View style={styles.targetTrack}>
                  <View
                    style={[
                      styles.targetFill,
                      { width: `${Math.max(3, Math.round((t.have / t.need) * 100))}%` },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.targetCount} allowFontScaling={false}>
                {t.have}/{t.need}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Press>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  grain: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05 },

  card: {
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: '#141207',
    experimental_backgroundImage:
      'linear-gradient(180deg, #221D0D 0%, #14120A 62%, #0D0C07 100%)',
    boxShadow: '0px 8px 22px rgba(0,0,0,0.4)',
    overflow: 'hidden',
    gap: space.s3,
  },

  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  key: { ...text.key, fontSize: 10, color: color.gold },
  count: {
    fontFamily: font.displayBlack,
    fontSize: 22,
    lineHeight: 27,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  countOf: { fontFamily: font.displaySemi, fontSize: 13, color: color.text3 },

  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fillBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: color.gold,
    experimental_backgroundImage: 'linear-gradient(90deg, #A98436 0%, #E7C87A 100%)',
    boxShadow: `0px 0px 10px ${color.gold}88`,
  },

  rowKey: { ...text.key, fontSize: 8.5, color: color.text3 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  marks: { flexDirection: 'row', gap: 5 },
  mark: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.4)',
    backgroundColor: 'rgba(214,178,94,0.12)',
  },
  markText: { fontSize: 15, lineHeight: 19 },
  latestName: {
    flex: 1,
    fontFamily: font.displaySemi,
    fontSize: 13,
    lineHeight: 17,
    color: color.text2,
    textAlign: 'right',
  },

  targets: { gap: 7 },
  target: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  targetMark: { fontSize: 15, lineHeight: 19, width: 22, textAlign: 'center' },
  targetBody: { flex: 1, minWidth: 0, gap: 3 },
  targetName: {
    fontFamily: font.bodySemi,
    fontSize: 12.5,
    lineHeight: 16,
    color: color.text2,
  },
  targetTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  targetFill: { height: 3, borderRadius: 2, backgroundColor: 'rgba(214,178,94,0.7)' },
  targetCount: {
    fontFamily: font.displayBold,
    fontSize: 12,
    lineHeight: 16,
    color: color.text3,
    fontVariant: ['tabular-nums'],
    minWidth: 34,
    textAlign: 'right',
  },
});
