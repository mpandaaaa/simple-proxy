import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ModeScreen, Press, Rise, Shine, Confetti, Collapse } from '../../src/ui/components';
import { back, home, swap } from '../../src/game/nav';
import { color, space, radius, line, hue, alpha } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import {
  STAGE_NAME,
  goldenBoot,
  goldenGlove,
  wcExpected,
  wcScorers,
  wcSquad,
  wcSummary,
  wcTeam,
  wcVerdict,
  type WcMatch,
} from '../../src/engine';
import { clearWorldCup, useWorldCup } from '../../src/game/worldcup';

/**
 * The tournament report.
 *
 * What a World Cup leaves behind, which is not a league table. How far
 * you got against how far a nation that good should have got, every
 * match of the campaign in the order they happened, who your tournament
 * belonged to, and the two awards the whole world was playing for.
 *
 * The Golden Boot and the Golden Glove are contested across all forty
 * eight nations rather than only your own, because a top scorer who only
 * had to beat his own team mates is not a top scorer.
 */
export default function WorldCupReport() {
  const run = useWorldCup();

  useEffect(() => {
    if (!run) swap('/worldcup');
  }, [run]);

  const summary = useMemo(() => (run ? wcSummary(run) : null), [run]);
  const scorers = useMemo(() => (run ? wcScorers(run) : []), [run]);
  const boot = useMemo(() => (run ? goldenBoot(run) : null), [run]);
  const glove = useMemo(() => (run ? goldenGlove(run) : null), [run]);

  if (!run || !summary) return null;

  const me = wcTeam(run.you);
  const verdict = wcVerdict(run);
  const expect = wcExpected(me?.r ?? 70);
  const tint = run.won ? hue.gold : verdict === 'over' ? hue.emerald : verdict === 'met' ? hue.sky : hue.crimson;

  const group = run.played.filter((m) => m.stage === 'group');
  const knockout = run.played.filter((m) => m.stage !== 'group');

  const top = scorers[0];
  const maker = [...scorers].sort((a, b) => b.a - a.a || b.g - a.g)[0];
  const potm = [...scorers].sort((a, b) => b.g * 2 + b.a - (a.g * 2 + a.a))[0];
  const keeper = wcSquad(run.you)
    .filter((p) => (p.pos[0] ?? '') === 'GK')
    .sort((a, b) => b.rtg - a.rtg)[0];

  return (
    <ModeScreen
      overline="World Cup 2026"
      title="Tournament report"
      scroll={false}
      onBack={() => back()}
    >
      <Confetti fire={run.won} />
      <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
        {/* ---- how it ended ---- */}
        <View style={[styles.hero, { borderColor: alpha(tint, 0.45) }]}>
          <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
          <Text style={styles.flag} allowFontScaling={false}>
            {me?.f}
          </Text>
          <Text style={styles.headline}>
            {run.won ? 'WORLD CHAMPIONS' : 'TOURNAMENT OVER'}
          </Text>
          <Text style={styles.sub}>
            {run.won
              ? `${me?.n} have won the World Cup.`
              : `${me?.n} are out at the ${STAGE_NAME[run.outAt ?? 'group']}.`}
          </Text>
          <Text style={styles.avg}>
            Avg {me?.r} {'·'} Expected {STAGE_NAME[expect]} {'·'} Finished{' '}
            {run.won ? 'Winners' : STAGE_NAME[run.outAt ?? 'group']}
          </Text>
          <View style={[styles.badge, { borderColor: tint, backgroundColor: alpha(tint, 0.14) }]}>
            <Text style={[styles.badgeText, { color: tint }]}>
              {verdict === 'over' ? 'OVERPERFORMED' : verdict === 'met' ? 'AS EXPECTED' : 'UNDERPERFORMED'}
            </Text>
          </View>
        </View>

        {/* ---- the numbers ---- */}
        <View style={styles.tiles}>
          <Tile n={summary.w} word="Won" tint={hue.emerald} />
          <Tile n={summary.d} word="Drawn" tint={hue.amber} />
          <Tile n={summary.l} word="Lost" tint={hue.crimson} />
          <Tile n={summary.gf} word="Goals For" />
          <Tile n={summary.ga} word="Goals Against" />
          <Tile n={summary.cleanSheets} word="Clean Sheets" tint={hue.sky} />
        </View>

        {/* ---- the campaign ---- */}
        <Text style={[text.label, styles.sect]}>The campaign</Text>
        <View style={styles.card}>
          <View style={styles.stageHead}>
            <Text style={styles.stageName}>Group Stage</Text>
            <View
              style={[
                styles.tag,
                run.outAt === 'group'
                  ? { borderColor: hue.crimson, backgroundColor: alpha(hue.crimson, 0.14) }
                  : { borderColor: hue.emerald, backgroundColor: alpha(hue.emerald, 0.14) },
              ]}
            >
              <Text
                style={[
                  styles.tagText,
                  { color: run.outAt === 'group' ? hue.crimson : hue.emerald },
                ]}
              >
                {run.outAt === 'group' ? 'OUT' : 'QUALIFIED'}
              </Text>
            </View>
          </View>
          {group.map((m, i) => (
            <Line key={`g${i}`} match={m} />
          ))}
        </View>

        {knockout.length ? (
          <View style={[styles.card, styles.cardGap]}>
            <View style={styles.stageHead}>
              <Text style={styles.stageName}>Knockout Stage</Text>
              <View
                style={[
                  styles.tag,
                  run.won
                    ? { borderColor: hue.gold, backgroundColor: alpha(hue.gold, 0.16) }
                    : { borderColor: hue.crimson, backgroundColor: alpha(hue.crimson, 0.14) },
                ]}
              >
                <Text style={[styles.tagText, { color: run.won ? hue.gold : hue.crimson }]}>
                  {run.won ? 'WINNERS' : `OUT: ${STAGE_NAME[run.outAt ?? 'r32'].toUpperCase()}`}
                </Text>
              </View>
            </View>
            {knockout.map((m, i) => (
              <Line key={`k${i}`} match={m} />
            ))}
          </View>
        ) : null}

        {/* ---- your own ---- */}
        {top && top.g > 0 ? (
          <>
            <Text style={[text.label, styles.sect]}>Squad record</Text>
            <View style={styles.card}>
              <Award mark="👟" role="Top scorer" who={top.n} value={`${top.g} goals`} lead />
              {maker && maker.a > 0 ? (
                <Award mark="🎯" role="Top playmaker" who={maker.n} value={`${maker.a} assists`} />
              ) : null}
              {potm ? (
                <Award
                  mark="⭐"
                  role="Player of the tournament"
                  who={potm.n}
                  value={`${potm.g}G · ${potm.a}A`}
                />
              ) : null}
              {keeper ? (
                <Award
                  mark="🧤"
                  role="Best goalkeeper"
                  who={keeper.n}
                  value={`${summary.cleanSheets} clean ${summary.cleanSheets === 1 ? 'sheet' : 'sheets'}`}
                />
              ) : null}
            </View>
          </>
        ) : null}

        {/* ---- what the world was playing for ---- */}
        <Text style={[text.label, styles.sect]}>Tournament awards</Text>
        <View style={styles.card}>
          {boot ? (
            <Award
              mark="👟"
              role="Golden Boot"
              who={`${wcTeam(boot.code)?.f ?? ''} ${boot.n}`}
              value={`${boot.goals} goals · ${wcTeam(boot.code)?.n ?? ''}`}
              lead
            />
          ) : null}
          {glove ? (
            <Award
              mark="🧤"
              role="Golden Glove"
              who={`${wcTeam(glove.code)?.f ?? ''} ${glove.n}`}
              value={`${glove.cleanSheets} clean sheets · ${wcTeam(glove.code)?.n ?? ''}`}
            />
          ) : null}
          <Text style={styles.awardNote}>
            Both are contested across every nation. Beating the world to one of
            them is a different thing from leading your own squad.
          </Text>
        </View>

        {/* ---- everybody ---- */}
        {scorers.length ? (
          <>
            <Text style={[text.label, styles.sect]}>Squad, goals and assists</Text>
            <Collapse label="Every player who did something" count={scorers.length}>
              <View style={styles.card}>
                {scorers.map((s) => (
                  <View key={s.n} style={styles.statRow}>
                    <Text style={styles.statName} numberOfLines={1}>
                      {s.n}
                    </Text>
                    <Text style={styles.statVal} allowFontScaling={false}>
                      {s.g}G {'·'} {s.a}A
                    </Text>
                  </View>
                ))}
              </View>
            </Collapse>
          </>
        ) : null}

        <View style={styles.cta}>
          <Press
            onPress={() => {
              haptic('medium');
              clearWorldCup();
              swap('/worldcup');
            }}
            feel="none"
            scaleTo={0.98}
            style={styles.again}
          >
            <Text style={styles.againText}>Take another nation</Text>
          </Press>
          <Press
            onPress={() => {
              haptic('light');
              home();
            }}
            feel="none"
            scaleTo={0.98}
            style={styles.homeBtn}
          >
            <Text style={styles.homeText}>Back to home</Text>
          </Press>
        </View>

        <View style={{ height: space.s6 }} />
      </ScrollView>
    </ModeScreen>
  );
}

function Tile({ n, word, tint }: { n: number; word: string; tint?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileNum, tint ? { color: tint } : null]} allowFontScaling={false}>
        {n}
      </Text>
      <Text style={styles.tileWord}>{word}</Text>
    </View>
  );
}

function Line({ match }: { match: WcMatch }) {
  const opp = wcTeam(match.b);
  const won = match.pens ? match.pens.a > match.pens.b : match.ga > match.gb;
  const lost = match.pens ? match.pens.a < match.pens.b : match.ga < match.gb;
  return (
    <View style={styles.lineRow}>
      <Text style={styles.lineStage} numberOfLines={1}>
        {STAGE_NAME[match.stage]}
      </Text>
      <Text style={styles.lineOpp} numberOfLines={1}>
        {opp?.f} {opp?.n}
      </Text>
      <Text
        style={[
          styles.lineScore,
          { color: won ? hue.emerald : lost ? hue.crimson : hue.amber },
        ]}
        allowFontScaling={false}
      >
        {match.ga}-{match.gb}
      </Text>
    </View>
  );
}

function Award({
  mark,
  role,
  who,
  value,
  lead,
}: {
  mark: string;
  role: string;
  who: string;
  value: string;
  lead?: boolean;
}) {
  return (
    <View style={[styles.award, lead ? styles.awardLead : null]}>
      <Text style={styles.awardMark} allowFontScaling={false}>
        {mark}
      </Text>
      <View style={styles.awardBody}>
        <Text style={styles.awardRole}>{role}</Text>
        <Text style={styles.awardWho} numberOfLines={1}>
          {who}
        </Text>
      </View>
      <Text style={styles.awardValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  hero: {
    alignItems: 'center',
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    backgroundColor: '#0C0F0D',
    experimental_backgroundImage:
      'radial-gradient(130% 100% at 50% 0%, rgba(255,255,255,0.09) 0%, rgba(12,15,13,0.7) 48%, #080A09 100%)',
    overflow: 'hidden',
    gap: 3,
  },
  flag: { fontSize: 48, lineHeight: 58 },
  headline: {
    fontFamily: font.displayBlack,
    fontSize: 32,
    lineHeight: 40,
    color: color.text1,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  sub: { ...text.small, fontSize: 14, lineHeight: 20, color: color.text2, textAlign: 'center' },
  avg: {
    ...text.small,
    fontSize: 12,
    lineHeight: 17,
    color: color.text3,
    textAlign: 'center',
    marginTop: space.s2,
  },
  badge: {
    marginTop: space.s3,
    paddingHorizontal: space.s4,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badgeText: { ...text.key, fontSize: 9.5 },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.s4, gap: '2%' },
  tile: {
    width: '32%',
    alignItems: 'center',
    paddingVertical: space.s3,
    marginBottom: space.s2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 1,
  },
  tileNum: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 30,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  tileWord: { ...text.key, fontSize: 7, color: color.text3 },

  sect: { marginTop: space.s5, marginBottom: space.s2 },
  card: {
    padding: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  cardGap: { marginTop: space.s3 },

  stageHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingBottom: space.s2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: space.s2,
  },
  stageName: {
    flex: 1,
    fontFamily: font.displayBold,
    fontSize: 16,
    lineHeight: 21,
    color: color.text1,
  },
  tag: { paddingHorizontal: space.s3, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
  tagText: { ...text.key, fontSize: 7.5 },

  lineRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingVertical: 7 },
  lineStage: { ...text.key, fontSize: 7.5, color: color.text3, width: 80 },
  lineOpp: {
    flex: 1,
    minWidth: 0,
    fontFamily: font.bodySemi,
    fontSize: 13,
    lineHeight: 18,
    color: color.text1,
  },
  lineScore: {
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },

  award: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: space.s2,
    paddingHorizontal: space.s2,
    borderRadius: radius.md,
    marginBottom: 5,
  },
  awardLead: { backgroundColor: alpha(hue.gold, 0.09) },
  awardMark: { fontSize: 20 },
  awardBody: { flex: 1, minWidth: 0 },
  awardRole: { ...text.key, fontSize: 7.5, color: color.text3 },
  awardWho: { fontFamily: font.displayBold, fontSize: 15, lineHeight: 20, color: color.text1 },
  awardValue: { ...text.small, fontSize: 11.5, color: hue.gold, maxWidth: 140, textAlign: 'right' },
  awardNote: { ...text.small, fontSize: 10.5, lineHeight: 15, color: color.text3, marginTop: space.s2 },

  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  statName: {
    flex: 1,
    minWidth: 0,
    fontFamily: font.bodySemi,
    fontSize: 13,
    lineHeight: 18,
    color: color.text1,
  },
  statVal: {
    fontFamily: font.displayBold,
    fontSize: 12.5,
    color: hue.gold,
    fontVariant: ['tabular-nums'],
  },

  cta: { marginTop: space.s6, gap: space.s2 },
  again: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: hue.gold,
    experimental_backgroundImage: 'linear-gradient(140deg, #E8C878 0%, #B98F35 100%)',
    boxShadow: '0px 10px 26px rgba(214,178,94,0.24), inset 0px 1px 0px rgba(255,255,255,0.26)',
  },
  againText: { ...text.button, fontSize: 16, color: '#1A1408' },
  homeBtn: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  homeText: { ...text.button, fontSize: 14, color: color.text2 },
});
