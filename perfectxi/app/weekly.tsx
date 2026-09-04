import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { go, back } from '../src/game/nav';
import { ModeScreen, Press, Rise, Shine, Collapse } from '../src/ui/components';
import { color, hue, line, radius, space, alpha, gradient } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { haptic } from '../src/ui/feel';
import { sfx } from '../src/ui/sound';
import {
  weekNumber,
  thisWeek,
  nextTwist,
  untilNextWeek,
  bestThisWeek,
  weeklyStreak,
  twistName,
  ordinal,
  type WeeklyBest,
  type WeeklyRecord,
} from '../src/engine';
import { weeklyStore } from '../src/save';
import { startRun } from '../src/game/run';

/**
 * The Weekly Event.
 *
 * One rule for seven days and as many goes as you like, which is what
 * makes it a different thing from the Daily rather than a second copy of
 * it. The Daily is the crossword; this is the practice net. Somebody who
 * has used their one attempt at today's puzzle still has a reason to be
 * here.
 *
 * Only your best of the week is kept, so a bad run costs nothing and
 * there is always a reason to have another go.
 */
export default function Weekly() {
  const [record, setRecord] = useState<WeeklyRecord>(() => weeklyStore.read());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setRecord(weeklyStore.read());
      setNow(Date.now());
    }, []),
  );

  const n = weekNumber(now);
  const week = thisWeek(now);
  const best = bestThisWeek(record, n);
  const streak = weeklyStreak(record, n);
  const next = nextTwist(now);

  const play = useCallback(() => {
    haptic('medium');
    sfx('pick');
    startRun(week.config, undefined, { weekly: week.n });
    go('/draft/board');
  }, [week]);

  return (
    <ModeScreen overline="Play today" title={week.twist.name} onBack={() => back()}>
      {/* ---- the rule ---- */}
      <View style={styles.rule}>
        <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
        <Text style={styles.ruleKey}>Week {n} {'·'} the rule</Text>
        <Text style={styles.ruleText}>{week.twist.rule}</Text>
        <Text style={styles.ruleNote}>{week.twist.note}</Text>
        <View style={styles.ruleFoot}>
          <Text style={styles.ruleFootText}>
            As many goes as you like. Only your best counts.
          </Text>
        </View>
      </View>

      {/* ---- your best, or the way in ---- */}
      {best ? (
        <Rise delay={0}>
          <View style={styles.best}>
            <Text style={styles.bestKey}>Your best this week</Text>
            <View style={styles.bestRow}>
              <Text style={styles.bestPts} allowFontScaling={false}>
                {best.pts}
              </Text>
              <View style={styles.bestBody}>
                <Text style={styles.bestLine}>points</Text>
                <Text style={styles.bestNote}>
                  {ordinal(best.position)} {'·'} rated {best.rating} {'·'}{' '}
                  {best.attempts} {best.attempts === 1 ? 'go' : 'goes'}
                </Text>
              </View>
            </View>
          </View>
        </Rise>
      ) : null}

      <Press onPress={play} feel="medium" scaleTo={0.98} style={styles.play}>
        <Text style={styles.playText}>{best ? 'Have another go' : 'Play this week'}</Text>
      </Press>

      {/* ---- the streak and the clock ---- */}
      <View style={styles.stats}>
        <Stat value={String(streak)} label="week streak" tint={streak >= 2 ? hue.amber : undefined} />
        <Stat value={String(record.past.length + (best ? 1 : 0))} label="weeks played" />
        <Stat
          value={best ? String(best.attempts) : '0'}
          label="goes this week"
          tint={hue.sky}
        />
      </View>

      <View style={styles.next}>
        <Text style={styles.nextKey}>This week ends in</Text>
        <Text style={styles.nextTime} allowFontScaling={false}>
          {clock(untilNextWeek(now))}
        </Text>
        <Text style={styles.nextThen}>Then it is {next.name}. {next.rule}</Text>
      </View>

      {/* ---- the weeks before ---- */}
      {record.past.length ? (
        <>
          <Text style={[text.label, styles.sect]}>Weeks before this one</Text>
          <Collapse label="Every week you have played" count={record.past.length}>
            <View style={styles.past}>
              {record.past.map((w) => (
                <PastWeek key={`${w.n}-${w.twistId}`} best={w} />
              ))}
            </View>
          </Collapse>
        </>
      ) : null}

      <View style={{ height: space.s6 }} />
    </ModeScreen>
  );
}

function clock(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function Stat({ value, label, tint }: { value: string; label: string; tint?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tint ? { color: tint } : null]} allowFontScaling={false}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PastWeek({ best }: { best: WeeklyBest }) {
  return (
    <View style={styles.pastRow}>
      <Text style={styles.pastN} allowFontScaling={false}>
        wk {best.n}
      </Text>
      <Text style={styles.pastTwist} numberOfLines={1}>
        {twistName(best.twistId)}
      </Text>
      <Text style={styles.pastPts} allowFontScaling={false}>
        {best.pts} pts
      </Text>
      <Text style={styles.pastPos} allowFontScaling={false}>
        {ordinal(best.position)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rule: {
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: alpha(hue.amber, 0.32),
    backgroundColor: '#171208',
    experimental_backgroundImage:
      'linear-gradient(180deg, #2B2210 0%, #16120A 62%, #0B0A07 100%)',
    overflow: 'hidden',
    gap: space.s2,
  },
  ruleKey: { ...text.key, fontSize: 9, color: hue.amber },
  ruleText: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 33,
    color: color.text1,
  },
  ruleNote: { ...text.small, fontSize: 13, lineHeight: 19 },
  ruleFoot: {
    marginTop: space.s2,
    paddingTop: space.s3,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  ruleFootText: { ...text.small, fontSize: 11.5, lineHeight: 16, color: color.text3 },

  best: {
    marginTop: space.s4,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    gap: space.s2,
  },
  bestKey: { ...text.key, fontSize: 9, color: color.text3 },
  bestRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  bestPts: {
    fontFamily: font.hero,
    fontSize: 46,
    lineHeight: 58,
    color: hue.emerald,
    fontVariant: ['tabular-nums'],
  },
  bestBody: { flex: 1, minWidth: 0 },
  bestLine: { ...text.key, fontSize: 9, color: color.text3 },
  bestNote: { ...text.small, fontSize: 12.5, lineHeight: 18 },

  play: {
    marginTop: space.s4,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: hue.amber,
    experimental_backgroundImage: 'linear-gradient(140deg, #F7B93F 0%, #D08A10 100%)',
    boxShadow: '0px 10px 26px rgba(245,165,36,0.28), inset 0px 1px 0px rgba(255,255,255,0.24)',
  },
  playText: { ...text.button, fontSize: 17, color: '#1A1204' },

  stats: {
    flexDirection: 'row',
    marginTop: space.s4,
    paddingVertical: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#0D1610',
  },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statValue: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 30,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { ...text.key, fontSize: 8, color: color.text3 },

  next: {
    alignItems: 'center',
    marginTop: space.s4,
    paddingVertical: space.s4,
    paddingHorizontal: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 2,
  },
  nextKey: { ...text.key, fontSize: 9, color: color.text3 },
  nextTime: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 33,
    color: color.text1,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.6,
  },
  nextThen: { ...text.small, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 4 },

  sect: { marginTop: space.s6, marginBottom: space.s3 },
  past: { gap: 5, paddingTop: space.s2 },
  pastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  pastN: {
    fontFamily: font.body,
    fontSize: 11.5,
    lineHeight: 16,
    color: color.text3,
    width: 44,
    fontVariant: ['tabular-nums'],
  },
  pastTwist: {
    fontFamily: font.bodySemi,
    fontSize: 12.5,
    lineHeight: 17,
    color: color.text2,
    flex: 1,
    minWidth: 0,
  },
  pastPts: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 18,
    color: color.text1,
    width: 58,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  pastPos: {
    fontFamily: font.body,
    fontSize: 12,
    lineHeight: 17,
    color: color.text3,
    width: 40,
    textAlign: 'right',
  },
});
