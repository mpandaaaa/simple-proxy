import { useCallback, useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { ModeScreen, Press, Rise, Shine } from '../../src/ui/components';
import { go, home, swap } from '../../src/game/nav';
import { color, space, radius, line, hue, alpha } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import {
  KNOCKOUTS,
  STAGE_NAME,
  wcScorers,
  wcSummary,
  wcTeam,
  nameIn,
  flagIn,
  ratingIn,
  type WcMatch,
  type WcStage,
} from '../../src/engine';
import { useWorldCup } from '../../src/game/worldcup';

/**
 * The tournament, between matches.
 *
 * Everything you need to decide whether to press the button: where you
 * are in the thing, what your group looks like, who is scoring, and who
 * is next. The one match ahead of you is the loudest object on the page,
 * because in a tournament played a match at a time that is the only
 * thing you can actually do.
 */

const RAIL: { stage: WcStage; short: string }[] = [
  { stage: 'group', short: 'GRP' },
  { stage: 'r32', short: 'R32' },
  { stage: 'r16', short: 'R16' },
  { stage: 'qf', short: 'QF' },
  { stage: 'sf', short: 'SF' },
  { stage: 'final', short: 'FIN' },
];

export default function WorldCupHub() {
  const run = useWorldCup();

  useEffect(() => {
    if (!run) swap('/worldcup');
  }, [run]);

  const me = run
    ? {
        n: nameIn(run, run.you),
        f: flagIn(run, run.you),
        r: ratingIn(run, run.you),
        /* The group is the place in the draw, which a drafted XI takes from
           the nation whose flag it carries. */
        g: wcTeam(run.you)?.g ?? '',
      }
    : null;
  const summary = useMemo(() => (run ? wcSummary(run) : null), [run]);
  const scorers = useMemo(() => (run ? wcScorers(run).slice(0, 4) : []), [run]);

  const onReport = useCallback(() => {
    haptic('light');
    go('/worldcup/report');
  }, []);

  if (!run || !me || !summary) return null;

  const next = run.ahead[0] ?? null;
  const at = RAIL.findIndex((r) => r.stage === run.stage);
  /* A tournament that ended at a round still reached that round, so the
     rail lights it. Going out in the group used to light nothing at all,
     which read as never having played. */
  const reached = run.over ? RAIL.findIndex((r) => r.stage === run.outAt) + 1 : at;

  return (
    <ModeScreen
      overline="World Cup 2026"
      title={me.n}
      scroll={false}
      onBack={() => home()}
      right={
        <View style={styles.chip}>
          <Text style={styles.chipText} allowFontScaling={false}>
            {me.r}
          </Text>
        </View>
      }
    >
      <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
        {/* ---- who you are ---- */}
        <View style={styles.crest}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%">
              <Defs>
                <RadialGradient id="wcglow" cx="50%" cy="10%" r="90%">
                  <Stop offset="0" stopColor={hue.gold} stopOpacity={0.22} />
                  <Stop offset="1" stopColor={hue.gold} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#wcglow)" />
            </Svg>
          </View>
          <Text style={styles.flag} allowFontScaling={false}>
            {me.f}
          </Text>
          <Text style={styles.nation}>{me.n}</Text>
          <Text style={styles.crestMeta}>
            Squad rating {me.r} {'·'} Group {me.g}
          </Text>
          <Text style={[styles.now, run.over ? { color: hue.crimson } : null]}>
            {run.over
              ? run.won
                ? 'Champions of the world'
                : `Out at the ${STAGE_NAME[run.outAt ?? 'group']}`
              : `Now: ${STAGE_NAME[run.stage]}`}
          </Text>
        </View>

        {/* ---- how far you have got ---- */}
        <View style={styles.rail}>
          {RAIL.map((r, i) => {
            const done = i < reached;
            const here = !run.over && i === at;
            return (
              <View key={r.stage} style={styles.railCell}>
                <View
                  style={[
                    styles.pip,
                    done ? { borderColor: hue.gold, backgroundColor: alpha(hue.gold, 0.3) } : null,
                    here ? { borderColor: hue.gold, borderWidth: 3 } : null,
                  ]}
                />
                <Text style={[styles.railWord, done || here ? { color: hue.gold } : null]}>
                  {r.short}
                </Text>
              </View>
            );
          })}
          <View style={styles.railCell}>
            <Text style={[styles.trophy, run.won ? null : styles.trophyOff]} allowFontScaling={false}>
              {'\u{1F3C6}'}
            </Text>
          </View>
        </View>

        {/* ---- the next match, which is the point of the page ---- */}
        {next ? (
          <Rise delay={0}>
            <View style={styles.next}>
              <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
              <Text style={styles.nextKey}>{STAGE_NAME[next.stage]}</Text>
              <View style={styles.nextRow}>
                <Text style={styles.nextFlag} allowFontScaling={false}>
                  {wcTeam(next.b)?.f}
                </Text>
                <View style={styles.nextBody}>
                  <Text style={styles.nextName} numberOfLines={1}>
                    {wcTeam(next.b)?.n}
                  </Text>
                  <Text style={styles.nextMeta}>
                    Rated {wcTeam(next.b)?.r} {'·'} {wcTeam(next.b)?.c}
                  </Text>
                </View>
              </View>
              <Press
                onPress={() => {
                  haptic('medium');
                  go('/worldcup/match');
                }}
                feel="medium"
                scaleTo={0.98}
                style={styles.play}
              >
                <Text style={styles.playText}>Play the match</Text>
              </Press>
            </View>
          </Rise>
        ) : (
          <Press onPress={onReport} feel="medium" scaleTo={0.98} style={styles.report}>
            <Text style={styles.reportText}>See the tournament report</Text>
          </Press>
        )}

        {/* ---- the numbers ---- */}
        <View style={styles.stats}>
          <Stat n={summary.w} word="won" tint={hue.emerald} />
          <Stat n={summary.d} word="drawn" tint={hue.amber} />
          <Stat n={summary.l} word="lost" tint={hue.crimson} />
          <Stat n={summary.gf} word="scored" />
          <Stat n={summary.ga} word="conceded" />
          <Stat n={summary.cleanSheets} word="clean" tint={hue.sky} />
        </View>

        {/* ---- who is scoring ---- */}
        {scorers.length && scorers[0].g > 0 ? (
          <>
            <Text style={[text.label, styles.sect]}>Golden Boot race</Text>
            <View style={styles.card}>
              {scorers.map((s) => (
                <View key={s.n} style={styles.scorer}>
                  <Text style={styles.scorerName} numberOfLines={1}>
                    {s.n}
                  </Text>
                  {s.a ? (
                    <Text style={styles.scorerAssist}>
                      {s.a} {s.a === 1 ? 'assist' : 'assists'}
                    </Text>
                  ) : null}
                  <Text style={styles.scorerGoals} allowFontScaling={false}>
                    {s.g}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* ---- the group ---- */}
        <Text style={[text.label, styles.sect]}>Group {me.g}</Text>
        <View style={styles.card}>
          <View style={styles.tHead}>
            <Text style={[styles.th, styles.tName]}>Nation</Text>
            <Text style={[styles.th, styles.tNum]}>P</Text>
            <Text style={[styles.th, styles.tNum]}>W</Text>
            <Text style={[styles.th, styles.tNum]}>D</Text>
            <Text style={[styles.th, styles.tNum]}>L</Text>
            <Text style={[styles.th, styles.tNum]}>GD</Text>
            <Text style={[styles.th, styles.tPts]}>Pts</Text>
          </View>
          {run.table.map((r, i) => {
            const you = r.code === run.you;
            /* Your row carries your name, which for a drafted run is your
               XI rather than the nation whose place it took. */
            const t = { f: flagIn(run, r.code), n: nameIn(run, r.code) };
            return (
              <View
                key={r.code}
                style={[styles.tRow, you ? { backgroundColor: alpha(hue.gold, 0.1) } : null]}
              >
                <Text
                  style={[styles.td, styles.tName, you ? { color: hue.gold } : null]}
                  numberOfLines={1}
                >
                  {i + 1}. {t?.f} {t?.n}
                </Text>
                <Text style={[styles.td, styles.tNum]}>{r.p}</Text>
                <Text style={[styles.td, styles.tNum]}>{r.w}</Text>
                <Text style={[styles.td, styles.tNum]}>{r.d}</Text>
                <Text style={[styles.td, styles.tNum]}>{r.l}</Text>
                <Text style={[styles.td, styles.tNum]}>{r.gf - r.ga}</Text>
                <Text style={[styles.td, styles.tPts, you ? { color: hue.gold } : null]}>
                  {r.pts}
                </Text>
              </View>
            );
          })}
          <Text style={styles.tNote}>
            The top two go through, and the eight best third places across all
            twelve groups go with them.
          </Text>
        </View>

        {/* ---- what has happened ---- */}
        {run.played.length ? (
          <>
            <Text style={[text.label, styles.sect]}>Played</Text>
            <View style={styles.card}>
              {run.played.map((m, i) => (
                <Result key={`${m.stage}-${i}`} match={m} />
              ))}
            </View>
          </>
        ) : null}

        <View style={{ height: space.s6 }} />
      </ScrollView>
    </ModeScreen>
  );
}

function Stat({ n, word, tint }: { n: number; word: string; tint?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statNum, tint ? { color: tint } : null]} allowFontScaling={false}>
        {n}
      </Text>
      <Text style={styles.statWord}>{word}</Text>
    </View>
  );
}

function Result({ match }: { match: WcMatch }) {
  const opp = wcTeam(match.b);
  const won = match.pens ? match.pens.a > match.pens.b : match.ga > match.gb;
  const lost = match.pens ? match.pens.a < match.pens.b : match.ga < match.gb;
  const tint = won ? hue.emerald : lost ? hue.crimson : hue.amber;
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultStage} numberOfLines={1}>
        {STAGE_NAME[match.stage]}
      </Text>
      <Text style={styles.resultOpp} numberOfLines={1}>
        {opp?.f} {opp?.n}
      </Text>
      <Text style={[styles.resultScore, { color: tint }]} allowFontScaling={false}>
        {match.ga}-{match.gb}
        {match.pens ? ` (${match.pens.a}-${match.pens.b})` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  chip: {
    minWidth: 46,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.gold, 0.45),
    backgroundColor: alpha(hue.gold, 0.1),
  },
  chipText: {
    fontFamily: font.displayBlack,
    fontSize: 15,
    color: hue.gold,
    fontVariant: ['tabular-nums'],
  },

  crest: {
    alignItems: 'center',
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: alpha(hue.gold, 0.3),
    backgroundColor: '#14110A',
    overflow: 'hidden',
    gap: 2,
  },
  flag: { fontSize: 52, lineHeight: 62 },
  nation: { fontFamily: font.displayBlack, fontSize: 30, lineHeight: 38, color: color.text1 },
  crestMeta: { ...text.small, fontSize: 12.5, lineHeight: 18, color: color.text2 },
  now: { ...text.key, fontSize: 9, color: hue.gold, marginTop: space.s2 },

  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.s4,
    paddingVertical: space.s3,
    paddingHorizontal: space.s2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  railCell: { flex: 1, alignItems: 'center', gap: 4 },
  pip: {
    width: 16,
    height: 16,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  railWord: { ...text.key, fontSize: 7, color: color.text3 },
  trophy: { fontSize: 20, lineHeight: 26 },
  trophyOff: { opacity: 0.25 },

  next: {
    marginTop: space.s4,
    padding: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: alpha(hue.gold, 0.5),
    backgroundColor: '#161206',
    experimental_backgroundImage:
      'radial-gradient(120% 100% at 50% 0%, rgba(214,178,94,0.2) 0%, rgba(22,18,6,0.7) 55%, #0B0904 100%)',
    overflow: 'hidden',
    gap: space.s3,
  },
  nextKey: { ...text.key, fontSize: 9, color: hue.gold },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  nextFlag: { fontSize: 38, lineHeight: 46 },
  nextBody: { flex: 1, minWidth: 0 },
  nextName: { fontFamily: font.displayBlack, fontSize: 24, lineHeight: 31, color: color.text1 },
  nextMeta: { ...text.small, fontSize: 12.5, lineHeight: 18, color: color.text2 },
  play: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: hue.gold,
    experimental_backgroundImage: 'linear-gradient(140deg, #E8C878 0%, #B98F35 100%)',
    boxShadow: '0px 10px 26px rgba(214,178,94,0.26), inset 0px 1px 0px rgba(255,255,255,0.26)',
  },
  playText: { ...text.button, fontSize: 16, color: '#1A1408' },

  report: {
    marginTop: space.s4,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.gold, 0.5),
    backgroundColor: alpha(hue.gold, 0.14),
  },
  reportText: { ...text.button, fontSize: 15, color: hue.gold },

  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: space.s4,
    paddingVertical: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#0D1610',
  },
  stat: { width: '33.33%', alignItems: 'center', paddingVertical: space.s2, gap: 1 },
  statNum: {
    fontFamily: font.displayBlack,
    fontSize: 22,
    lineHeight: 28,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  statWord: { ...text.key, fontSize: 7.5, color: color.text3 },

  sect: { marginTop: space.s5, marginBottom: space.s2 },
  card: {
    padding: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },

  scorer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  scorerName: {
    flex: 1,
    minWidth: 0,
    fontFamily: font.displayBold,
    fontSize: 14.5,
    lineHeight: 19,
    color: color.text1,
  },
  scorerAssist: { ...text.small, fontSize: 11, color: color.text3 },
  scorerGoals: {
    fontFamily: font.displayBlack,
    fontSize: 18,
    lineHeight: 23,
    color: hue.gold,
    fontVariant: ['tabular-nums'],
  },

  tHead: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  th: { ...text.key, fontSize: 7.5, color: color.text3 },
  td: {
    fontFamily: font.bodySemi,
    fontSize: 12.5,
    lineHeight: 18,
    color: color.text2,
    fontVariant: ['tabular-nums'],
  },
  tName: { flex: 1, minWidth: 0, textAlign: 'left' },
  tNum: { width: 24, textAlign: 'center' },
  tPts: { width: 30, textAlign: 'right', color: color.text1 },
  tRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderRadius: 4 },
  tNote: { ...text.small, fontSize: 10.5, lineHeight: 15, color: color.text3, marginTop: space.s2 },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  resultStage: { ...text.key, fontSize: 7.5, color: color.text3, width: 74 },
  resultOpp: {
    flex: 1,
    minWidth: 0,
    fontFamily: font.bodySemi,
    fontSize: 13,
    lineHeight: 18,
    color: color.text1,
  },
  resultScore: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
  },
});
