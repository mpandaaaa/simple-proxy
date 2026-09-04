import { useCallback, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { ModeScreen, Press, Rise, Shine, Trophy } from '../src/ui/components';
import { alpha, color, hue, line, radius, space } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { GRAIN_URI } from '../src/ui/grain';
import { haptic } from '../src/ui/feel';
import {
  ACHIEVEMENTS,
  CATEGORIES,
  CATEGORY_NOTE,
  nextUp,
  recent,
  type AchCategory,
  type Achievement,
} from '../src/game/achievements';
import { awardSweep } from '../src/game/award';
import { careerStore } from '../src/save';

/**
 * The trophy cabinet.
 *
 * A hundred and twenty six of these across ten shelves is a wall if it is
 * printed as one list, so it is not. The silverware is at the top, the
 * shelves are collapsed underneath, and each one says how far through it
 * you are before you open it. Everything you are closest to earning is
 * pulled out and put where you will see it, because a cabinet should give
 * you something to go after rather than only a record of what is done.
 *
 * The locked ones are shown rather than hidden, with the condition spelled
 * out. Hiding them would make the shelves look finished when they are not.
 */

/** Each shelf its own colour, so the page is not a hundred gold rows. */
const TINT: Record<AchCategory, string> = {
  'First Steps': hue.emerald,
  Records: hue.amber,
  Challenges: hue.crimson,
  Milestones: hue.gold,
  Cups: hue.gold,
  'World Cup': hue.sky,
  'Champions League': '#4FC3FF',
  Dynasty: hue.violet,
  'Play Today': hue.mint,
  Collection: hue.rose,
};

type Filter = 'all' | 'earned' | 'locked';

export default function Cabinet() {
  const [career, setCareer] = useState(() => careerStore.read());
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<AchCategory | null>(null);

  /* Cards, levels and streaks move outside this screen, so what can be
     re-read is checked on the way in rather than trusted to a hook. */
  useFocusEffect(
    useCallback(() => {
      awardSweep();
      setCareer(careerStore.read());
    }, []),
  );

  const earned = useMemo(() => new Set(career.earned), [career.earned]);
  const total = ACHIEVEMENTS.length;
  const got = useMemo(() => ACHIEVEMENTS.filter((a) => earned.has(a.key)).length, [earned]);
  const pct = Math.round((got / total) * 100);

  const shelves = useMemo(
    () =>
      CATEGORIES.map((cat) => {
        const list = ACHIEVEMENTS.filter((a) => a.cat === cat);
        return { cat, list, done: list.filter((a) => earned.has(a.key)).length };
      }),
    [earned],
  );

  const targets = useMemo(() => nextUp(career, 3), [career]);
  const latest = useMemo(() => recent(career, 5), [career]);

  const toggle = useCallback((cat: AchCategory) => {
    haptic('light');
    setOpen((was) => (was === cat ? null : cat));
  }, []);

  return (
    <ModeScreen overline="Everything you have won" title="Trophy cabinet">
      {/* ================= the silverware ================= */}
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
          <Cup mark="🏆" label="National" count={career.nationalCups} tint={color.gold} />
          <Cup mark="🌍" label="Continental" count={career.continentalCups} tint={color.blue} />
          <Cup mark="🏅" label="Doubles" count={career.doubles} tint={color.accent} />
          <Cup mark="💎" label="Trebles" count={career.trebles} tint={color.purple} />
        </View>
        <View style={styles.cups}>
          <Cup mark="🌐" label="World Cups" count={career.wcTitles} tint={hue.sky} />
          <Cup mark="⭐" label="Europe" count={career.uclTitles} tint="#4FC3FF" />
          <Cup mark="📋" label="Dynasty" count={career.dynTitles} tint={hue.violet} />
          <Cup mark="⚡" label="Invincible" count={career.unbeaten} tint={hue.mint} />
        </View>
      </View>

      {/* ================= how far through ================= */}
      <View style={styles.progress}>
        <View style={styles.progressHead}>
          <Text style={styles.progressKey}>Achievements</Text>
          <Text style={styles.progressCount} allowFontScaling={false}>
            {got} of {total} {'·'} {pct}%
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(1, pct)}%` }]} />
        </View>
      </View>

      {/* ================= what you are closest to ================= */}
      {targets.length ? (
        <>
          <Text style={[text.label, styles.sect]}>Closest to earning</Text>
          <View style={styles.card}>
            {targets.map((t, i) => (
              <Rise key={t.achievement.key} delay={Math.min(i, 4)}>
                <View style={styles.target}>
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
                          {
                            width: `${Math.max(3, Math.round((t.have / t.need) * 100))}%`,
                            backgroundColor: TINT[t.achievement.cat],
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={styles.targetNum} allowFontScaling={false}>
                    {t.have}/{t.need}
                  </Text>
                </View>
              </Rise>
            ))}
          </View>
        </>
      ) : null}

      {/* ================= the last few ================= */}
      {latest.length ? (
        <>
          <Text style={[text.label, styles.sect]}>Most recent</Text>
          <View style={styles.recent}>
            {latest.map((a) => (
              <View key={a.key} style={[styles.chip, { borderColor: alpha(TINT[a.cat], 0.5) }]}>
                <Text style={styles.chipMark} allowFontScaling={false}>
                  {a.mark}
                </Text>
                <Text style={[styles.chipText, { color: TINT[a.cat] }]} numberOfLines={1}>
                  {a.name}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* ================= the shelves ================= */}
      <View style={styles.filters}>
        {(['all', 'earned', 'locked'] as Filter[]).map((f) => (
          <Press
            key={f}
            onPress={() => {
              haptic('light');
              setFilter(f);
            }}
            feel="none"
            scaleTo={0.98}
            style={[styles.filter, filter === f ? styles.filterOn : null]}
          >
            <Text style={[styles.filterText, filter === f ? styles.filterTextOn : null]}>
              {f === 'all' ? 'Everything' : f === 'earned' ? 'Earned' : 'Still to do'}
            </Text>
          </Press>
        ))}
      </View>

      {shelves.map((shelf, i) => {
        const tint = TINT[shelf.cat];
        const showing = shelf.list.filter((a) =>
          filter === 'all' ? true : filter === 'earned' ? earned.has(a.key) : !earned.has(a.key),
        );
        const expanded = open === shelf.cat;
        const frac = shelf.list.length ? shelf.done / shelf.list.length : 0;
        const finished = shelf.done === shelf.list.length;

        return (
          <Rise key={shelf.cat} delay={Math.min(i, 6)}>
            <Press
              onPress={() => toggle(shelf.cat)}
              feel="none"
              scaleTo={0.99}
              style={[
                styles.catCard,
                expanded ? { borderColor: alpha(tint, 0.5) } : null,
              ]}
            >
              <View style={styles.catTop}>
                <View style={styles.catBody}>
                  <Text style={[styles.catName, finished ? { color: tint } : null]}>
                    {shelf.cat}
                  </Text>
                  <Text style={styles.catNote} numberOfLines={1}>
                    {CATEGORY_NOTE[shelf.cat]}
                  </Text>
                </View>
                <Text style={[styles.catCount, { color: tint }]} allowFontScaling={false}>
                  {shelf.done}/{shelf.list.length}
                </Text>
                <Text style={[styles.catChev, expanded ? { color: tint } : null]}>
                  {expanded ? '−' : '+'}
                </Text>
              </View>
              <View style={styles.catTrack}>
                <View
                  style={[
                    styles.catFill,
                    { width: `${Math.max(2, Math.round(frac * 100))}%`, backgroundColor: tint },
                  ]}
                />
              </View>
            </Press>

            {expanded ? (
              <View style={styles.list}>
                {showing.length ? (
                  showing.map((a) => (
                    <Row key={a.key} ach={a} has={earned.has(a.key)} tint={tint} />
                  ))
                ) : (
                  <Text style={styles.empty}>
                    {filter === 'earned' ? 'None of these yet.' : 'All of them done.'}
                  </Text>
                )}
              </View>
            ) : null}
          </Rise>
        );
      })}

      <View style={{ height: space.s6 }} />
    </ModeScreen>
  );
}

/** One achievement, earned or not. */
function Row({ ach, has, tint }: { ach: Achievement; has: boolean; tint: string }) {
  return (
    <View style={[styles.ach, has ? { borderColor: alpha(tint, 0.42) } : null]}>
      <Text style={[styles.achMark, has ? null : styles.achMarkOff]} allowFontScaling={false}>
        {ach.mark}
      </Text>
      <View style={styles.achBody}>
        <Text style={[styles.achName, has ? { color: tint } : null]} numberOfLines={1}>
          {ach.name}
        </Text>
        <Text style={styles.achDesc} numberOfLines={2}>
          {has ? ach.desc : ach.hint}
        </Text>
      </View>
      {has ? (
        <Text style={[styles.tick, { color: tint }]} allowFontScaling={false}>
          ✓
        </Text>
      ) : null}
    </View>
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
    <View style={[styles.cup, won ? { borderColor: alpha(tint, 0.4) } : null]}>
      <Text style={[styles.cupMark, won ? null : styles.cupMarkOff]} allowFontScaling={false}>
        {mark}
      </Text>
      <Text style={[styles.cupCount, won ? { color: tint } : null]} allowFontScaling={false}>
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
    paddingVertical: space.s5,
    paddingHorizontal: space.s3,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: '#141D15',
    overflow: 'hidden',
    gap: 2,
  },
  bloom: { position: 'absolute', top: -30, left: -20, right: -20, height: 170 },
  shelfTitle: {
    fontFamily: font.displayBlack,
    fontSize: 22,
    lineHeight: 29,
    color: color.text1,
    marginTop: space.s2,
  },
  shelfSub: { ...text.key, fontSize: 8, color: color.text3 },
  cups: {
    flexDirection: 'row',
    gap: space.s2,
    marginTop: space.s3,
    alignSelf: 'stretch',
  },
  cup: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.s2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(0,0,0,0.24)',
    gap: 1,
  },
  cupMark: { fontSize: 15, lineHeight: 20 },
  cupMarkOff: { opacity: 0.3 },
  cupCount: {
    fontFamily: font.displayBlack,
    fontSize: 17,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  cupLabel: { ...text.key, fontSize: 6.5, color: color.text3 },

  progress: {
    marginTop: space.s4,
    padding: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: space.s2,
  },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  progressKey: { ...text.key, fontSize: 9, color: color.text3 },
  progressCount: {
    fontFamily: font.displayBold,
    fontSize: 14,
    color: color.gold,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: color.gold },

  sect: { marginTop: space.s5, marginBottom: space.s2 },
  card: {
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  target: { flexDirection: 'row', alignItems: 'center', gap: space.s3, minHeight: 52 },
  targetMark: { fontSize: 18, lineHeight: 24, width: 24, textAlign: 'center' },
  targetBody: { flex: 1, minWidth: 0, gap: 5 },
  targetName: { fontFamily: font.displayBold, fontSize: 14, lineHeight: 19, color: color.text1 },
  targetTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  targetFill: { height: 4, borderRadius: 2 },
  targetNum: {
    fontFamily: font.displayBold,
    fontSize: 12,
    color: color.text3,
    fontVariant: ['tabular-nums'],
    minWidth: 40,
    textAlign: 'right',
  },

  recent: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.s3,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    maxWidth: '100%',
  },
  chipMark: { fontSize: 12 },
  chipText: { ...text.key, fontSize: 8, flexShrink: 1 },

  filters: { flexDirection: 'row', gap: space.s2, marginTop: space.s5, marginBottom: space.s3 },
  filter: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  filterOn: { borderColor: line.gold, backgroundColor: alpha(color.gold, 0.13) },
  filterText: { ...text.key, fontSize: 9, color: color.text3 },
  filterTextOn: { color: color.gold },

  catCard: {
    marginBottom: space.s2,
    paddingHorizontal: space.s3,
    paddingVertical: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: space.s2,
  },
  catTop: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  catBody: { flex: 1, minWidth: 0, gap: 1 },
  catName: { fontFamily: font.displayBold, fontSize: 16, lineHeight: 21, color: color.text1 },
  catNote: { ...text.small, fontSize: 11, lineHeight: 15, color: color.text3 },
  catCount: {
    fontFamily: font.displayBold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  catChev: { fontFamily: font.displayBold, fontSize: 18, color: color.text3, width: 14, textAlign: 'center' },
  catTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  catFill: { height: 4, borderRadius: 2 },

  list: { marginBottom: space.s3, gap: 6 },
  ach: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 58,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  achMark: { fontSize: 18, lineHeight: 24, width: 26, textAlign: 'center' },
  achMarkOff: { opacity: 0.32 },
  achBody: { flex: 1, minWidth: 0, gap: 1 },
  achName: { fontFamily: font.displayBold, fontSize: 14, lineHeight: 19, color: color.text2 },
  achDesc: { ...text.small, fontSize: 11.5, lineHeight: 16, color: color.text3 },
  tick: { fontFamily: font.displayBlack, fontSize: 14 },
  empty: { ...text.small, fontSize: 12.5, color: color.text3, paddingVertical: space.s3 },
});
