import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ModeScreen, Press, Rise, Shine, ClubDisc } from '../../src/ui/components';
import { color, hue, line, radius, space, alpha, type Hue } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import { COMPS, type CompId, type CupRun, type CupSeason } from '../../src/engine';
import { useCareer } from '../../src/game/career';

/**
 * The cups.
 *
 * Five competitions, all of them real. The FA Cup you enter at the third
 * round with sixty three other clubs, the League Cup with its two legged
 * semi-final, and whichever European competition last season's finish
 * earned you. What was won sits at the top, because the cabinet is the
 * point of a career.
 */

/** A colour each, so a season's five runs are readable at a glance. */
const TINT: Record<CompId, Hue> = {
  shield: 'mint',
  efl: 'violet',
  fa: 'gold',
  ucl: 'sky',
  uel: 'amber',
  uecl: 'lime',
};

const ORDER: CompId[] = ['ucl', 'uel', 'uecl', 'fa', 'efl', 'shield'];

export default function Cups() {
  const career = useCareer();
  if (!career) return null;

  const last = (career.lastCups as CupSeason | null) ?? null;
  const honours = career.honours ?? {};
  const cabinet = ORDER.filter((id) => (honours[id] ?? 0) > 0);
  const total = cabinet.reduce((a, id) => a + (honours[id] ?? 0), 0) + career.titles;

  return (
    <ModeScreen
      overline={career.club}
      title="The cups"
      onBack={() => router.back()}
    >
      {/* ---- what has been won ---- */}
      <View style={styles.cabinet}>
        <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
        <Text style={styles.cabTotal} allowFontScaling={false}>
          {total}
        </Text>
        <Text style={styles.cabKey}>
          {total === 1 ? 'trophy' : 'trophies'} in {career.year - 1}{' '}
          {career.year - 1 === 1 ? 'season' : 'seasons'}
        </Text>

        {total ? (
          <View style={styles.medals}>
            {career.titles ? (
              <Medal mark="🏅" name="Premier League" n={career.titles} tint={hue.emerald} />
            ) : null}
            {cabinet.map((id) => (
              <Medal
                key={id}
                mark={COMPS[id].mark}
                name={COMPS[id].name}
                n={honours[id] ?? 0}
                tint={hue[TINT[id]]}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.cabNone}>
            Nothing yet. The League Cup is the one most clubs win first.
          </Text>
        )}
      </View>

      {/* ---- where you are ---- */}
      <View style={styles.inEurope}>
        <Text style={styles.inKey}>This season</Text>
        <Text style={styles.inBody}>
          {career.europe
            ? `${COMPS[career.europe].name}, the FA Cup and the League Cup.`
            : 'The FA Cup and the League Cup. No European football.'}
          {career.europe === 'ucl'
            ? ' Eight league phase games, and the top eight go straight to the last sixteen.'
            : career.europe
              ? ' A league phase, then a knockout the same shape as the Champions League.'
              : ' Finish in the top seven, or win a cup, and that changes.'}
        </Text>
      </View>

      {/* ---- last season, run by run ---- */}
      <Text style={[text.label, styles.sect]}>
        {last ? `Season ${career.year - 1}` : 'No season played yet'}
      </Text>
      {last ? (
        <>
          <Text style={styles.sectNote}>
            £{Math.round(last.money)}m of prize money across the cups.
          </Text>
          {ORDER.map((id) => {
            const run = last.runs.find((r) => r.id === id);
            if (!run || !run.entered) return null;
            return <RunCard key={id} run={run} tint={hue[TINT[id]]} />;
          })}
        </>
      ) : (
        <Text style={styles.none}>
          Play a season and every tie you were in will be here.
        </Text>
      )}

      <View style={{ height: space.s7 }} />
    </ModeScreen>
  );
}

function Medal({
  mark,
  name,
  n,
  tint,
}: {
  mark: string;
  name: string;
  n: number;
  tint: string;
}) {
  return (
    <View
      style={[styles.medal, { borderColor: alpha(tint, 0.4), backgroundColor: alpha(tint, 0.1) }]}
    >
      <Text style={styles.medalMark} allowFontScaling={false}>
        {mark}
      </Text>
      <Text style={[styles.medalN, { color: tint }]} allowFontScaling={false}>
        {n}
      </Text>
      <Text style={styles.medalName} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

function RunCard({ run, tint }: { run: CupRun; tint: string }) {
  return (
    <Rise delay={0}>
      <View
        style={[
          styles.run,
          {
            borderColor: alpha(tint, run.won ? 0.5 : 0.24),
            experimental_backgroundImage: `linear-gradient(180deg, ${alpha(
              tint,
              run.won ? 0.2 : 0.11,
            )} 0%, rgba(10,15,12,0) 78%)`,
          },
        ]}
      >
        <View style={styles.runHead}>
          <Text style={styles.runMark} allowFontScaling={false}>
            {COMPS[run.id].mark}
          </Text>
          <View style={styles.runBody}>
            <Text style={styles.runName} numberOfLines={1}>
              {run.name}
            </Text>
            <Text style={[styles.runFate, { color: run.won ? tint : color.text3 }]}>
              {run.won ? 'Winners' : `Out in the ${run.elim}`}
            </Text>
          </View>
          {run.money > 0 ? (
            <Text style={[styles.runMoney, { color: tint }]} allowFontScaling={false}>
              £{Math.round(run.money)}m
            </Text>
          ) : null}
        </View>

        <View style={styles.ties}>
          {run.ties.map((t, i) => (
            <View key={`${t.round}-${i}`} style={styles.tie}>
              {t.opp ? <ClubDisc club={t.opp} size={26} /> : <View style={styles.tieGap} />}
              <View style={styles.tieBody}>
                <Text style={styles.tieRound}>
                  {t.round}
                  {t.neutral ? ' · Wembley' : t.legs ? ' · two legs' : t.home ? ' · home' : ' · away'}
                </Text>
                <Text style={styles.tieOpp} numberOfLines={1}>
                  {t.opp ?? 'The league phase'}
                </Text>
                {t.detail ? (
                  <Text style={styles.tieDetail} numberOfLines={1}>
                    {t.detail}
                  </Text>
                ) : null}
                {t.pens ? (
                  <Text style={[styles.tieDetail, { color: hue.amber }]}>{t.pens}</Text>
                ) : null}
              </View>
              {t.opp ? (
                <Text
                  style={[
                    styles.tieScore,
                    { color: t.won ? hue.emerald : hue.crimson },
                  ]}
                  allowFontScaling={false}
                >
                  {t.gf}
                  {'–'}
                  {t.ga}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </Rise>
  );
}

const styles = StyleSheet.create({
  cabinet: {
    alignItems: 'center',
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: '#141207',
    experimental_backgroundImage:
      'linear-gradient(180deg, #241E0D 0%, #14120A 62%, #0B0A07 100%)',
    overflow: 'hidden',
  },
  cabTotal: {
    fontFamily: font.hero,
    fontSize: 64,
    lineHeight: 84,
    color: hue.gold,
    fontVariant: ['tabular-nums'],
  },
  cabKey: { ...text.key, fontSize: 9.5, color: color.text3, marginTop: -space.s3 },
  cabNone: { ...text.small, fontSize: 12.5, textAlign: 'center', marginTop: space.s3 },
  medals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s2,
    justifyContent: 'center',
    marginTop: space.s4,
  },
  medal: {
    width: '31.5%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: space.s3,
    paddingHorizontal: space.s2,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 1,
  },
  medalMark: { fontSize: 18, lineHeight: 23 },
  medalN: {
    fontFamily: font.displayBlack,
    fontSize: 20,
    lineHeight: 25,
    fontVariant: ['tabular-nums'],
  },
  medalName: { ...text.key, fontSize: 7.5, color: color.text3, textAlign: 'center' },

  inEurope: {
    marginTop: space.s4,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(hue.sky, 0.24),
    backgroundColor: '#0C1219',
    experimental_backgroundImage:
      'linear-gradient(180deg, #14212F 0%, #0D1319 70%, #080B0E 100%)',
    gap: space.s2,
  },
  inKey: { ...text.key, fontSize: 9.5, color: hue.sky },
  inBody: { ...text.small, fontSize: 12.5, lineHeight: 18 },

  sect: { marginTop: space.s6, marginBottom: space.s2 },
  sectNote: { ...text.small, fontSize: 11.5, marginBottom: space.s3 },
  none: { ...text.small, fontSize: 12.5 },

  run: {
    marginBottom: space.s3,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: '#101A14',
    gap: space.s3,
  },
  runHead: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  runMark: { fontSize: 22, lineHeight: 28 },
  runBody: { flex: 1, minWidth: 0 },
  runName: { fontFamily: font.displayBold, fontSize: 19, lineHeight: 24, color: color.text1 },
  runFate: { ...text.key, fontSize: 8.5 },
  runMoney: {
    fontFamily: font.displayBold,
    fontSize: 17,
    lineHeight: 21,
    fontVariant: ['tabular-nums'],
  },

  ties: { gap: space.s2 },
  tie: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingTop: space.s2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  tieGap: { width: 26 },
  tieBody: { flex: 1, minWidth: 0 },
  tieRound: { ...text.key, fontSize: 8, color: color.text3 },
  tieOpp: { fontFamily: font.bodySemi, fontSize: 14, lineHeight: 19, color: color.text1 },
  tieDetail: { fontFamily: font.body, fontSize: 10.5, lineHeight: 14, color: color.text3 },
  tieScore: {
    fontFamily: font.displayBlack,
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
});
