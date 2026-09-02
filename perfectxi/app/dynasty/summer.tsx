import { useEffect, useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import { ModeScreen, Press, Rise, Shine, Ticker } from '../../src/ui/components';
import { color, gradient, line, positionColor, radius, space } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { GRAIN_URI } from '../../src/ui/grain';
import { haptic } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import type { DynastyPlayer } from '../../src/engine';
import { clearReport, takeReport } from '../../src/game/dynastyReport';

/**
 * The summer.
 *
 * A year passes on the whole squad at once and this is the only place you
 * see it happen. Who got better, who started to go, and who is not coming
 * back at all.
 *
 * The retirements are first, because they are the ones you cannot undo.
 */
export default function Summer() {
  const report = useMemo(() => takeReport(), []);

  useEffect(() => {
    if (!report) {
      router.replace('/dynasty');
      return;
    }
    haptic(report.retired.length ? 'warning' : 'medium');
    sfx(report.after >= report.before ? 'pick' : 'against');
    return clearReport;
  }, [report]);

  if (!report) return null;

  const swing = report.after - report.before;

  return (
    <ModeScreen
      overline="A year has passed"
      title="The summer"
      onBack={() => router.replace('/dynasty')}
    >
      {/* ---- what it did to the squad as a whole ---- */}
      <View style={styles.hero}>
        <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
        <View style={styles.bloom} pointerEvents="none">
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <Defs>
              <RadialGradient id="summerBloom" cx="50%" cy="50%" r="50%">
                <Stop
                  offset="0"
                  stopColor={swing >= 0 ? color.accent : color.danger}
                  stopOpacity={0.26}
                />
                <Stop
                  offset="1"
                  stopColor={swing >= 0 ? color.accent : color.danger}
                  stopOpacity={0}
                />
              </RadialGradient>
            </Defs>
            <Ellipse cx="50" cy="4" rx="66" ry="44" fill="url(#summerBloom)" />
          </Svg>
        </View>
        <View style={styles.grain} pointerEvents="none">
          <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.fill} />
        </View>

        <Text style={styles.heroKey}>Squad rating</Text>
        <View style={styles.heroRow}>
          <Text style={styles.was} allowFontScaling={false}>
            {report.before}
          </Text>
          <Text style={styles.arrow} allowFontScaling={false}>
            {'→'}
          </Text>
          <Ticker
            value={report.after}
            from={report.before}
            duration={900}
            style={[
              styles.now,
              { color: swing > 0 ? color.win : swing < 0 ? color.loss : color.text1 },
            ]}
          />
        </View>
        <Text
          style={[
            styles.swing,
            { color: swing > 0 ? color.win : swing < 0 ? color.loss : color.text3 },
          ]}
        >
          {swing === 0
            ? 'No change on the whole'
            : `${swing > 0 ? '+' : ''}${swing} across the squad`}
        </Text>
      </View>

      {/* ---- the ones who are not coming back ---- */}
      {report.retired.length ? (
        <Rise delay={0}>
          <View style={styles.retired}>
            <Text style={styles.retiredKey}>
              {report.retired.length === 1 ? 'Retired' : `${report.retired.length} retired`}
            </Text>
            {report.retired.map((p) => (
              <View key={p.n} style={styles.retiredRow}>
                <Text style={styles.retiredName} numberOfLines={1}>
                  {p.n}
                </Text>
                <Text style={styles.retiredMeta}>
                  {p.pos} {'·'} {p.age} {'·'} rated {p.rtg}
                </Text>
              </View>
            ))}
            <Text style={styles.retiredNote}>
              Signings are not built yet, so this eleven is what you have.
            </Text>
          </View>
        </Rise>
      ) : null}

      {report.improved.length ? (
        <>
          <Text style={[text.label, styles.sect]}>Better than last year</Text>
          <View style={styles.list}>
            {report.improved.map((p) => (
              <Change key={p.n} player={p} />
            ))}
          </View>
        </>
      ) : null}

      {report.declined.length ? (
        <>
          <Text style={[text.label, styles.sect]}>Slipping</Text>
          <View style={styles.list}>
            {report.declined.map((p) => (
              <Change key={p.n} player={p} />
            ))}
          </View>
        </>
      ) : null}

      <Press
        onPress={() => {
          haptic('medium');
          router.replace('/dynasty');
        }}
        feel="none"
        style={styles.cta}
        scaleTo={0.98}
      >
        <Text style={styles.ctaText}>Back to the club</Text>
      </Press>
    </ModeScreen>
  );
}

/** One player and what the year did to him. */
function Change({ player: p }: { player: DynastyPlayer }) {
  const tint = positionColor[p.pos];
  const up = p.delta > 0;
  return (
    <View style={styles.row}>
      <View
        style={[styles.badge, { backgroundColor: tint + '26', borderColor: tint + '66' }]}
      >
        <Text style={[styles.badgeText, { color: tint }]}>{p.pos}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {p.n}
        </Text>
        <Text style={styles.rowMeta}>
          now {p.age} {'·'} {reason(p)}
        </Text>
      </View>
      <Text style={styles.rowRtg} allowFontScaling={false}>
        {p.rtg}
      </Text>
      <View
        style={[
          styles.delta,
          {
            borderColor: (up ? color.win : color.loss) + '59',
            backgroundColor: (up ? color.win : color.loss) + '1F',
          },
        ]}
      >
        <Text
          style={[styles.deltaText, { color: up ? color.win : color.loss }]}
          allowFontScaling={false}
        >
          {up ? '+' : ''}
          {p.delta}
        </Text>
      </View>
    </View>
  );
}

/**
 * Why it happened, in four words.
 *
 * The engine knows whether he is still short of his ceiling or past his
 * peak, and saying so is the difference between a number changing and a
 * career being told.
 */
function reason(p: DynastyPlayer): string {
  if (p.delta > 0) {
    if (p.rtg >= p.pot - 1) return 'as good as he will get';
    if (p.age <= 23) return 'still growing';
    return 'improving';
  }
  if (p.age >= 33) return 'the legs are going';
  if (p.age >= 30) return 'past his peak';
  return 'a hard year';
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  grain: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05 },

  hero: {
    alignItems: 'center',
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#0C1510',
    experimental_backgroundImage:
      'linear-gradient(180deg, #16281F 0%, #0D1712 62%, #080D0A 100%)',
    boxShadow: '0px 14px 34px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
  bloom: { position: 'absolute', top: -30, left: -30, right: -30, height: 180 },
  heroKey: { ...text.key, fontSize: 9, color: color.text3 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3, marginTop: 2 },
  was: {
    fontFamily: font.hero,
    fontSize: 40,
    lineHeight: 52,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  arrow: { fontSize: 20, lineHeight: 52, color: color.text3 },
  now: {
    fontFamily: font.hero,
    fontSize: 58,
    lineHeight: 76,
    fontVariant: ['tabular-nums'],
  },
  swing: { ...text.key, fontSize: 10, marginTop: space.s2 },

  retired: {
    marginTop: space.s5,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.danger,
    backgroundColor: 'rgba(229,72,77,0.09)',
    gap: space.s2,
  },
  retiredKey: { ...text.key, fontSize: 10, color: color.danger },
  retiredRow: { gap: 1 },
  retiredName: {
    fontFamily: font.displayBold,
    fontSize: 19,
    lineHeight: 24,
    color: color.text1,
  },
  retiredMeta: { ...text.small, fontSize: 12 },
  retiredNote: { ...text.small, fontSize: 11, marginTop: space.s2 },

  sect: { marginTop: space.s6, marginBottom: space.s3 },
  list: { gap: space.s2 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow:
      'inset 0px 1px 0px rgba(255,255,255,0.06), inset 0px 0px 0px 1px rgba(255,255,255,0.035)',
  },
  badge: {
    width: 38,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...text.key, fontSize: 9 },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: {
    fontFamily: font.bodySemi,
    fontSize: 14,
    lineHeight: 19,
    color: color.text1,
  },
  rowMeta: { fontFamily: font.body, fontSize: 11, lineHeight: 15, color: color.text3 },
  rowRtg: {
    fontFamily: font.displayBlack,
    fontSize: 20,
    lineHeight: 25,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  delta: {
    minWidth: 34,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  deltaText: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 17,
    fontVariant: ['tabular-nums'],
  },

  cta: {
    marginTop: space.s6,
    marginBottom: space.s6,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.accent,
    backgroundColor: 'rgba(31,197,126,0.12)',
  },
  ctaText: { ...text.button, color: color.accent },
});
