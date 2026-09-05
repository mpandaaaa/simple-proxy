import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ClubDisc, ModeScreen, Press, Rise, Shine, Confirm } from '../../src/ui/components';
import { back, enter, go } from '../../src/game/nav';
import { alpha, color, hue, line, radius, space } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import { CUP_ROUND_NAME, cupSide, drawSixteen, spreadSixteen, strongestSixteen } from '../../src/engine';
import { getCup, startCup, useCup } from '../../src/game/cup';

/**
 * Filling a bracket.
 *
 * Sixteen sides out of seven hundred and twelve is too many taps to ask
 * for, so it is filled for you three ways and you follow whichever of the
 * sixteen you fancy. The eras option is the interesting one and the
 * default, because ratings drift upwards across thirty five seasons and
 * the strongest sixteen outright is almost all of this year.
 */

type Fill = 'eras' | 'strongest' | 'draw';

const ERAS: { label: string; from: number; to: number }[] = [
  { label: 'The 1990s', from: 1992, to: 1999 },
  { label: 'The 2000s', from: 2000, to: 2009 },
  { label: 'The 2010s', from: 2010, to: 2019 },
  { label: 'The 2020s', from: 2020, to: 2026 },
];

export default function CupPick() {
  const run = useCup();
  const [fill, setFill] = useState<Fill>('eras');
  const [era, setEra] = useState(0);
  const [nonce, setNonce] = useState(0);
  const [follow, setFollow] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);

  const field = useMemo(() => {
    if (fill === 'strongest') return strongestSixteen();
    if (fill === 'draw') return drawSixteen(ERAS[era].from, ERAS[era].to, nonce * 7919 + era * 31 + 1);
    return spreadSixteen();
  }, [fill, era, nonce]);

  const begin = useCallback(
    (key: string) => {
      haptic('success');
      sfx('whistle');
      startCup(field, key);
      enter('/cup/hub');
    },
    [field],
  );

  const tap = useCallback(
    (key: string) => {
      haptic('light');
      setFollow(key);
      const on = getCup();
      if (on && !on.over) setAsking(key);
      else begin(key);
    },
    [begin],
  );

  const resume = run && !run.over ? cupSide(run.you) : null;

  return (
    <>
      <ModeScreen
        wide
        overline="Any era, any club" title="The Cup" scroll={false} onBack={() => back()}>
        <ScrollView
          keyboardShouldPersistTaps="handled" style={styles.page} showsVerticalScrollIndicator={false}>
          {/* ================= the brand ================= */}
          <View style={styles.hero}>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="cupband" x1="0" y1="0" x2="0.5" y2="1">
                    <Stop offset="0" stopColor="#3A2A08" stopOpacity={0.95} />
                    <Stop offset="0.6" stopColor="#1A1608" stopOpacity={0.95} />
                    <Stop offset="1" stopColor="#0C0F0B" stopOpacity={0.95} />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#cupband)" />
              </Svg>
            </View>
            <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />

            <Text style={styles.trophy} allowFontScaling={false}>
              🏆
            </Text>
            <Text style={styles.big} allowFontScaling={false}>
              THE CUP
            </Text>
            <Text style={styles.hosts}>
              Sixteen sides {'·'} thirty five seasons {'·'} one night each
            </Text>
          </View>

          {/* ================= carry on ================= */}
          {resume ? (
            <Rise delay={0}>
              <Press
                onPress={() => {
                  haptic('light');
                  go('/cup/hub');
                }}
                feel="none"
                scaleTo={0.98}
                style={styles.resume}
              >
                <ClubDisc club={resume.club} size={38} />
                <View style={styles.resumeBody}>
                  <Text style={styles.resumeKey}>Carry on</Text>
                  <Text style={styles.resumeName} numberOfLines={1}>
                    {resume.club} {resume.season}
                  </Text>
                  <Text style={styles.resumeNote} numberOfLines={1}>
                    {CUP_ROUND_NAME[run!.round]} {'·'} {run!.played.length} played
                  </Text>
                </View>
                <Text style={styles.chev}>{'›'}</Text>
              </Press>
            </Rise>
          ) : null}

          <Text style={styles.lead}>
            The Invincibles against Guardiola's City. Blackburn against Leicester.
            Sixteen club seasons out of seven hundred and twelve, one match a
            round, extra time and penalties if they cannot be separated.
          </Text>

          {/* ================= how the bracket is filled ================= */}
          <View style={styles.tabs}>
            {(['eras', 'strongest', 'draw'] as Fill[]).map((f) => (
              <Press
                key={f}
                onPress={() => {
                  haptic('light');
                  setFill(f);
                }}
                feel="none"
                scaleTo={0.98}
                style={[styles.tab, fill === f ? styles.tabOn : null]}
              >
                <Text style={[styles.tabText, fill === f ? styles.tabTextOn : null]}>
                  {f === 'eras' ? 'Across the eras' : f === 'strongest' ? 'Strongest' : 'Draw one'}
                </Text>
              </Press>
            ))}
          </View>

          {fill === 'draw' ? (
            <>
              <View style={styles.eras}>
                {ERAS.map((e, i) => (
                  <Press
                    key={e.label}
                    onPress={() => {
                      haptic('light');
                      setEra(i);
                    }}
                    feel="none"
                    scaleTo={0.97}
                    style={[styles.eraChip, era === i ? styles.eraChipOn : null]}
                  >
                    <Text style={[styles.eraText, era === i ? styles.eraTextOn : null]}>
                      {e.label}
                    </Text>
                  </Press>
                ))}
              </View>
              <Press
                onPress={() => {
                  haptic('medium');
                  sfx('tick');
                  setNonce((n) => n + 1);
                }}
                feel="light"
                scaleTo={0.98}
                style={styles.redraw}
              >
                <Text style={styles.redrawText}>Draw again</Text>
              </Press>
            </>
          ) : (
            <Text style={styles.note}>
              {fill === 'eras'
                ? 'Four from each of the four decades, the best season each club had in it.'
                : 'The sixteen highest rated squads in the database, one season per club.'}
            </Text>
          )}

          {/* ================= who you follow ================= */}
          <Text style={[text.label, styles.sect]}>Pick the one you follow</Text>
          {field.map((key, i) => {
            const side = cupSide(key);
            if (!side) return null;
            return (
              <Rise key={key} delay={Math.min(i, 8)}>
                <Press
                  onPress={() => tap(key)}
                  feel="none"
                  scaleTo={0.99}
                  style={[styles.row, follow === key ? styles.rowOn : null]}
                >
                  <ClubDisc club={side.club} size={38} />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {side.club}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {side.season}
                    </Text>
                  </View>
                  <View style={[styles.rating, { borderColor: alpha(tintFor(side.rating), 0.55) }]}>
                    <Text
                      style={[styles.ratingText, { color: tintFor(side.rating) }]}
                      allowFontScaling={false}
                    >
                      {side.rating}
                    </Text>
                  </View>
                </Press>
              </Rise>
            );
          })}

          <View style={{ height: space.s6 }} />
        </ScrollView>
      </ModeScreen>

      <Confirm
        visible={asking !== null}
        title="Start again?"
        body="You have a cup on the go. Starting another throws it away."
        confirmLabel="Start again"
        cancelLabel="Keep it"
        onCancel={() => setAsking(null)}
        onConfirm={() => {
          const key = asking;
          setAsking(null);
          if (key) begin(key);
        }}
      />
    </>
  );
}

function tintFor(rating: number): string {
  return rating >= 85 ? hue.gold : rating >= 81 ? hue.emerald : rating >= 77 ? hue.sky : color.text3;
}

const styles = StyleSheet.create({
  page: { flex: 1 },

  hero: {
    alignItems: 'center',
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: '#12100A',
    overflow: 'hidden',
  },
  trophy: { fontSize: 34, lineHeight: 44 },
  big: {
    fontFamily: font.displayBlack,
    fontSize: 42,
    lineHeight: 52,
    color: color.gold,
    letterSpacing: 2,
  },
  hosts: { ...text.small, fontSize: 12.5, lineHeight: 18, color: color.text2, marginTop: 2 },

  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    marginTop: space.s3,
    padding: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: alpha(color.gold, 0.1),
  },
  resumeBody: { flex: 1, minWidth: 0 },
  resumeKey: { ...text.key, fontSize: 8, color: color.gold },
  resumeName: { fontFamily: font.displayBold, fontSize: 17, lineHeight: 23, color: color.text1 },
  resumeNote: { ...text.small, fontSize: 11.5, lineHeight: 16, color: color.text2 },
  chev: { fontFamily: font.displayBold, fontSize: 22, color: color.gold },

  lead: {
    ...text.small,
    fontSize: 12.5,
    lineHeight: 18,
    color: color.text3,
    marginTop: space.s4,
    marginBottom: space.s3,
  },

  tabs: { flexDirection: 'row', gap: space.s2, marginBottom: space.s3 },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tabOn: { borderColor: line.gold, backgroundColor: alpha(color.gold, 0.13) },
  tabText: { ...text.key, fontSize: 8.5, color: color.text3 },
  tabTextOn: { color: color.gold },

  eras: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2, marginBottom: space.s2 },
  eraChip: {
    minHeight: 42,
    paddingHorizontal: space.s3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  eraChipOn: { borderColor: line.gold, backgroundColor: alpha(color.gold, 0.12) },
  eraText: { ...text.key, fontSize: 8, color: color.text3 },
  eraTextOn: { color: color.gold },
  redraw: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  redrawText: { ...text.key, fontSize: 9, color: color.text3 },

  note: { ...text.small, fontSize: 12, lineHeight: 17, color: color.text3 },
  sect: { marginTop: space.s5, marginBottom: space.s2 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 62,
    marginBottom: 6,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  rowOn: { borderColor: line.gold, backgroundColor: alpha(color.gold, 0.1) },
  rowBody: { flex: 1, minWidth: 0, gap: 1 },
  rowName: { fontFamily: font.displayBold, fontSize: 16, lineHeight: 21, color: color.text1 },
  rowMeta: { ...text.key, fontSize: 8, color: color.text3 },
  rating: {
    minWidth: 44,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  ratingText: { fontFamily: font.displayBlack, fontSize: 17, fontVariant: ['tabular-nums'] },
});
