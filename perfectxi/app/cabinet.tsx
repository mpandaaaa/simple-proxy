import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { ModeScreen, Shine, Trophy } from '../src/ui/components';
import { color, gradient, line, radius, space } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { GRAIN_URI } from '../src/ui/grain';
import {
  ACHIEVEMENTS,
  CATEGORIES,
  type AchCategory,
} from '../src/game/achievements';
import { careerStore } from '../src/save';

/**
 * The trophy cabinet.
 *
 * Two halves. The silverware at the top, which is a count of things you
 * have actually lifted, and the achievements underneath, which is the
 * whole catalogue with the ones you have earned lit up.
 *
 * The locked ones are shown rather than hidden, with the condition
 * spelled out. A cabinet that only shows what you have done gives you
 * nothing to go after.
 */
export default function Cabinet() {
  const career = useMemo(() => careerStore.read(), []);
  const earned = useMemo(() => new Set(career.earned), [career.earned]);

  const byCategory = useMemo(() => {
    const map = new Map<AchCategory, typeof ACHIEVEMENTS>();
    for (const cat of CATEGORIES) {
      map.set(
        cat,
        ACHIEVEMENTS.filter((a) => a.cat === cat),
      );
    }
    return map;
  }, []);

  const total = ACHIEVEMENTS.length;
  const got = ACHIEVEMENTS.filter((a) => earned.has(a.key)).length;

  return (
    <ModeScreen overline="Everything you have won" title="Trophy cabinet">
      {/* ---- the silverware ---- */}
      <View style={styles.shelf}>
        <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
        <View style={styles.bloom} pointerEvents="none">
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <Defs>
              <RadialGradient id="cabBloom" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={color.gold} stopOpacity={0.28} />
                <Stop offset="1" stopColor={color.gold} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx="50" cy="4" rx="68" ry="46" fill="url(#cabBloom)" />
          </Svg>
        </View>
        <View style={styles.grain} pointerEvents="none">
          <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.fill} />
        </View>

        <Trophy size={72} tint={career.titles > 0 ? color.gold : '#4A4F48'} />
        <Text style={styles.shelfTitle}>
          {career.titles === 0
            ? 'No silverware yet'
            : career.titles === 1
              ? 'One league title'
              : `${career.titles} league titles`}
        </Text>
        <Text style={styles.shelfSub}>
          {career.seasons} season{career.seasons === 1 ? '' : 's'} played
        </Text>

        <View style={styles.cups}>
          <Cup mark="🏆" label="National Cup" count={career.nationalCups} tint={color.gold} />
          <Cup mark="🌍" label="Continental" count={career.continentalCups} tint={color.blue} />
          <Cup mark="🏅" label="Doubles" count={career.doubles} tint={color.accent} />
          <Cup mark="💎" label="Trebles" count={career.trebles} tint={color.purple} />
        </View>
      </View>

      {/* ---- how far through the catalogue ---- */}
      <View style={styles.progress}>
        <View style={styles.progressHead}>
          <Text style={styles.progressKey}>Achievements</Text>
          <Text style={styles.progressCount} allowFontScaling={false}>
            {got} of {total}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${Math.round((got / total) * 100)}%` }]}
          />
        </View>
      </View>

      {CATEGORIES.map((cat) => {
        const list = byCategory.get(cat) ?? [];
        const done = list.filter((a) => earned.has(a.key)).length;
        return (
          <View key={cat}>
            <View style={styles.catHead}>
              <Text style={[text.label, styles.catTitle]}>{cat}</Text>
              <Text style={styles.catCount} allowFontScaling={false}>
                {done}/{list.length}
              </Text>
            </View>
            <View style={styles.grid}>
              {list.map((a) => {
                const has = earned.has(a.key);
                return (
                  <View key={a.key} style={[styles.ach, has ? styles.achOn : null]}>
                    <Text
                      style={[styles.achMark, has ? null : styles.achMarkOff]}
                      allowFontScaling={false}
                    >
                      {a.mark}
                    </Text>
                    <View style={styles.achBody}>
                      <Text
                        style={[styles.achName, has ? { color: color.gold } : null]}
                        numberOfLines={1}
                      >
                        {a.name}
                      </Text>
                      <Text style={styles.achDesc} numberOfLines={2}>
                        {has ? a.desc : a.hint}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}

      <View style={{ height: space.s6 }} />
    </ModeScreen>
  );
}

function Cup({
  mark,
  label,
  count,
  tint,
}: {
  mark: string;
  label: string;
  count: number;
  tint: string;
}) {
  const won = count > 0;
  return (
    <View style={[styles.cup, won ? { borderColor: tint + '66' } : null]}>
      <Text style={[styles.cupMark, won ? null : styles.cupMarkOff]} allowFontScaling={false}>
        {mark}
      </Text>
      <Text
        style={[styles.cupCount, won ? { color: tint } : null]}
        allowFontScaling={false}
      >
        {count}
      </Text>
      <Text style={styles.cupLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  grain: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05 },

  shelf: {
    alignItems: 'center',
    paddingTop: space.s5,
    paddingHorizontal: space.s4,
    paddingBottom: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: '#141207',
    experimental_backgroundImage:
      'linear-gradient(180deg, #221D0D 0%, #14120A 62%, #0C0B06 100%)',
    boxShadow: '0px 14px 34px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
  bloom: { position: 'absolute', top: -34, left: -34, right: -34, height: 190 },
  shelfTitle: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: 0.3,
    color: color.text1,
    marginTop: space.s3,
    textAlign: 'center',
  },
  shelfSub: { ...text.small, marginTop: 2 },

  cups: { flexDirection: 'row', gap: space.s2, marginTop: space.s4, alignSelf: 'stretch' },
  cup: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 1,
  },
  cupMark: { fontSize: 17, lineHeight: 22 },
  cupMarkOff: { opacity: 0.28 },
  cupCount: {
    fontFamily: font.displayBlack,
    fontSize: 19,
    lineHeight: 23,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  cupLabel: { ...text.key, fontSize: 7.5, color: color.text3 },

  progress: {
    marginTop: space.s5,
    padding: space.s4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow:
      'inset 0px 1px 0px rgba(255,255,255,0.06), inset 0px 0px 0px 1px rgba(255,255,255,0.035)',
  },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.s3,
  },
  progressKey: { ...text.key, fontSize: 10, color: color.text3 },
  progressCount: {
    fontFamily: font.displayBold,
    fontSize: 16,
    lineHeight: 20,
    color: color.gold,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: color.gold,
    experimental_backgroundImage: 'linear-gradient(90deg, #A98436 0%, #E7C87A 100%)',
    boxShadow: `0px 0px 10px ${color.gold}88`,
  },

  catHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: space.s6,
    marginBottom: space.s3,
  },
  catTitle: { marginBottom: 0 },
  catCount: {
    fontFamily: font.displayBold,
    fontSize: 12,
    lineHeight: 15,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },

  grid: { gap: space.s2 },
  ach: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#0E1712',
    opacity: 0.62,
  },
  achOn: {
    opacity: 1,
    borderColor: 'rgba(214,178,94,0.38)',
    backgroundColor: '#151308',
    experimental_backgroundImage:
      'linear-gradient(180deg, #221D0D 0%, #14120A 100%)',
  },
  achMark: { fontSize: 21, lineHeight: 27, width: 28, textAlign: 'center' },
  achMarkOff: { opacity: 0.32 },
  achBody: { flex: 1, minWidth: 0 },
  achName: {
    fontFamily: font.displayBold,
    fontSize: 16,
    lineHeight: 20,
    color: color.text2,
  },
  achDesc: { ...text.small, fontSize: 12, lineHeight: 16 },
});
