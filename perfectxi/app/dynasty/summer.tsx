import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { Stack } from 'expo-router';
import { go, swap, home } from '../../src/game/nav';
import {
  ModeScreen,
  Press,
  Rise,
  Shine,
  Ticker,
  Confetti,
  Trophy,
  SeasonCurve,
  ClubDisc,
  Collapse,
  MatchLive,
} from '../../src/ui/components';
import { color, gradient, line, positionColor, radius, space, hue, alpha } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { GRAIN_URI } from '../../src/ui/grain';
import { haptic } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import {
  asSquad,
  awards,
  COMPS,
  objectiveClause,
  takeJob,
  type CupRun,
  chemBonus,
  expectedRating,
  finishFor,
  highlights,
  livePosition,
  mulberry32,
  ordinal,
  processSeasonEnd,
  simulateSeason,
  starters,
  everyone,
  verdict,
  type Dynasty,
  type DynastyPlayer,
  type FinishTone,
  type Outcome,
  type SeasonResult,
  type SummerReport,
  type TableRow,
} from '../../src/engine';
import { getCareer, setCareer } from '../../src/game/career';
import { awardDynasty } from '../../src/game/award';
import { clearSeasonResult, takeSeasonResult } from '../../src/game/careerSeason';

/** Eight highlights, eight colours, so the grid is not one green block. */
const HL_HUES = [
  hue.emerald,
  hue.sky,
  hue.gold,
  hue.rose,
  hue.violet,
  hue.amber,
  hue.mint,
  hue.indigo,
];

const TONE: Record<FinishTone, { tint: string; edge: string; wash: string }> = {
  gold: {
    tint: color.gold,
    edge: 'rgba(214,178,94,0.45)',
    wash: 'radial-gradient(135% 105% at 50% 0%, rgba(214,178,94,0.30) 0%, rgba(58,44,12,0.55) 44%, #0C0F0A 86%)',
  },
  silver: {
    tint: '#C9D6CE',
    edge: 'rgba(201,214,206,0.36)',
    wash: 'radial-gradient(135% 105% at 50% 0%, rgba(201,214,206,0.22) 0%, rgba(40,50,46,0.5) 44%, #0A0F0C 86%)',
  },
  ucl: {
    tint: color.accent,
    edge: 'rgba(31,197,126,0.42)',
    wash: 'radial-gradient(135% 105% at 50% 0%, rgba(31,197,126,0.26) 0%, rgba(10,60,38,0.5) 44%, #08110D 86%)',
  },
  europa: {
    tint: color.blue,
    edge: 'rgba(76,160,255,0.40)',
    wash: 'radial-gradient(135% 105% at 50% 0%, rgba(76,160,255,0.24) 0%, rgba(12,38,68,0.5) 44%, #080D14 86%)',
  },
  mid: {
    tint: color.text2,
    edge: 'rgba(255,255,255,0.16)',
    wash: 'radial-gradient(135% 105% at 50% 0%, rgba(255,255,255,0.12) 0%, rgba(24,32,28,0.6) 44%, #0A0F0C 86%)',
  },
  low: {
    tint: color.warning,
    edge: 'rgba(245,165,36,0.36)',
    wash: 'radial-gradient(135% 105% at 50% 0%, rgba(245,165,36,0.22) 0%, rgba(58,40,10,0.5) 44%, #0C0D08 86%)',
  },
  rel: {
    tint: color.danger,
    edge: 'rgba(229,72,77,0.42)',
    wash: 'radial-gradient(135% 105% at 50% 0%, rgba(229,72,77,0.26) 0%, rgba(62,14,16,0.5) 44%, #100809 86%)',
  },
};

/**
 * The season review, and the summer that follows it.
 *
 * One long page, in the order a season actually resolves. Where you
 * finished and what the papers made of it. The awards. What the squad did,
 * player by player. The table you finished in. Then the board's verdict,
 * the books, and everything the year did to the eleven.
 *
 * The draft's review sets the standard for the top half of this and there
 * is no reason a career should get less.
 */
export default function Summer() {
  const done = useRef(false);
  /* Any of the thirty eight can be watched back, the same as it can from
     the season screen. */
  const [watching, setWatching] = useState<number | null>(null);
  const [state, setState] = useState<{
    report: SummerReport;
    result: SeasonResult;
    before: Dynasty;
    /**
     * The career after the season was processed.
     *
     * Appearances, days out and the average match rating are only written
     * when the season closes, so reading them off `before` showed last
     * year's numbers next to this year's goals. A player who had just
     * signed read as nought appearances and two assists.
     */
    after: Dynasty;
  } | null>(null);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const career = getCareer();
    if (!career) {
      swap('/dynasty');
      return;
    }

    /* The season is a pure function of the career and the year, so if the
       handoff is gone, which it is after the app has been closed, it can
       be played again and comes out identical. */
    const result =
      takeSeasonResult() ??
      (() => {
        const xi = starters(career);
        if (xi.length < 11) return null;
        const rnd = mulberry32((career.seed ^ Math.imul(career.year, 0x9e3779b1)) >>> 0);
        const squad = asSquad(xi);
        return simulateSeason(squad, career.tactic.form, chemBonus(squad), rnd, career.club, career.league);
      })();

    if (!result) {
      swap('/dynasty');
      return;
    }

    const out = processSeasonEnd(career, result);
    setCareer(out.dynasty);
    /* The season is over, so the cabinet is told about it here. Only ever
       once: this runs on the way into the summer, not on every render. */
    awardDynasty(out.dynasty);
    clearSeasonResult();
    setState({ report: out.report, result, before: career, after: out.dynasty });

    haptic(out.report.sacked ? 'error' : out.report.met ? 'success' : 'warning');
    sfx(
      out.report.sacked
        ? 'lose'
        : result.position === 1
          ? 'trophy'
          : out.report.met
            ? 'win'
            : 'ft',
    );
  }, []);

  const curve = useMemo(() => {
    if (!state) return { positions: [] as number[], outcomes: [] as Outcome[] };
    const positions: number[] = [];
    const outcomes: Outcome[] = [];
    let pts = 0;
    state.result.matches.forEach((m, i) => {
      pts += m.oc === 'win' ? 3 : m.oc === 'draw' ? 1 : 0;
      positions.push(livePosition(pts, i + 1, state.result.table));
      outcomes.push(m.oc);
    });
    return { positions, outcomes };
  }, [state]);

  if (!state) return null;
  const { report, result, before, after } = state;
  /* Who will have you now. Generated when the season closed, so it is
     the same list whichever way you come back to this screen. */
  const jobs = after.jobs ?? [];
  const fin = finishFor(result);
  const tone = TONE[fin.tone];
  const paper = verdict(result);
  const stats = highlights(result);
  const trophies = awards(
    result.playerStats,
    starters(before).map((p) => ({ pos: p.pos, player: null })),
  );
  const swing = report.after - report.before;

  // The squad that played it, so the review can name them.
  const squad = starters(before);
  const byName = new Map(squad.map((p) => [p.n, p]));
  /* What each of them actually did this season, which lives on the career
     as it is after the summer has been processed, not before it. */
  const played = new Map(everyone(after).map((p) => [p.n, p]));
  const scorers = Object.entries(result.playerStats)
    .map(([n, s]) => ({ n, ...s }))
    .sort((a, b) => b.g - a.g || b.a - a.a);

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <ModeScreen
        overline={`${before.club} · season ${before.year}`}
        title="Season review"
        onBack={() => swap('/dynasty')}
      >
        {/* ================= where you finished ================= */}
        <View
          style={[
            styles.finish,
            { borderColor: tone.edge, experimental_backgroundImage: tone.wash },
          ]}
        >
          <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
          <View style={styles.bloom} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              <Defs>
                <RadialGradient id="revBloom" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={tone.tint} stopOpacity={0.34} />
                  <Stop offset="1" stopColor={tone.tint} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Ellipse cx="50" cy="6" rx="66" ry="50" fill="url(#revBloom)" />
            </Svg>
          </View>
          <View style={styles.grain} pointerEvents="none">
            <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.fill} />
          </View>

          {result.position === 1 ? (
            <Trophy size={92} tint={color.gold} />
          ) : (
            <Text style={styles.mark} allowFontScaling={false}>
              {fin.mark}
            </Text>
          )}

          <View style={styles.posRow}>
            <Ticker
              value={result.position}
              from={20}
              duration={1000}
              style={[styles.posNum, { color: tone.tint }]}
            />
            <Text style={[styles.posOrd, { color: tone.tint }]} allowFontScaling={false}>
              {ordinal(result.position).replace(String(result.position), '')}
            </Text>
          </View>
          <Text style={styles.finTitle}>{fin.title}</Text>
          <Text style={styles.finSub}>{fin.sub}</Text>

          <View
            style={[
              styles.pv,
              {
                borderColor: (report.met ? color.accent : color.danger) + '66',
                backgroundColor: (report.met ? color.accent : color.danger) + '1A',
              },
            ]}
          >
            <Text
              style={[styles.pvText, { color: report.met ? color.accent : color.danger }]}
            >
              {report.met ? '▲ Objective met' : '▼ Objective missed'}
            </Text>
          </View>
          <Text style={styles.pvSub}>
            They wanted you to {objectiveClause(before.objective.target, before.division)}
          </Text>
        </View>

        {/* ================= the six numbers ================= */}
        <View style={styles.tiles}>
          <Tile value={result.wins} label="Won" tint={hue.emerald} />
          <Tile value={result.draws} label="Drawn" tint={hue.amber} />
          <Tile value={result.losses} label="Lost" tint={hue.crimson} />
          <Tile value={result.gf} label="Goals for" tint={hue.rose} />
          <Tile value={result.ga} label="Goals against" tint={hue.sky} />
          <Tile value={result.pts} label="Points" tint={tone.tint} />
        </View>

        {/* ================= the cups ================= */}
        {report.cups.runs.some((r) => r.entered) ? (
          <>
            <Text style={[text.label, styles.sect]}>The cups</Text>
            <Text style={styles.sectNote}>
              £{Math.round(report.cups.money)}m of prize money.
              {report.cups.europeNext
                ? ` ${COMPS[report.cups.europeNext].name} next season.`
                : ' No European football next season.'}
            </Text>
            <View style={styles.cups}>
              {report.cups.runs
                .filter((r) => r.entered)
                .map((r) => (
                  <CupPath key={r.id} run={r} />
                ))}
            </View>
          </>
        ) : null}

        {/* ================= who is following now ================= */}
        <View style={styles.fans}>
          <View style={styles.fansRow}>
            <View style={styles.fansCol}>
              <Text style={styles.fansValue} allowFontScaling={false}>
                {(report.fansBefore + report.fansSwing).toFixed(1)}m
              </Text>
              <Text style={styles.fansKey}>supporters</Text>
            </View>
            <View style={styles.fansCol}>
              <Text
                style={[
                  styles.fansSwing,
                  { color: report.fansSwing >= 0 ? hue.emerald : hue.crimson },
                ]}
                allowFontScaling={false}
              >
                {report.fansSwing >= 0 ? '+' : ''}
                {report.fansSwing.toFixed(2)}m
              </Text>
              <Text style={styles.fansKey}>this season</Text>
            </View>
          </View>
          <Text style={styles.fansNote}>
            {report.fansSwing > 0.3
              ? 'A season people will talk about. The shop will feel it.'
              : report.fansSwing > 0
                ? 'A few more through the turnstiles than last year.'
                : 'People drifted away. Winning is what brings them back.'}
          </Text>
        </View>

        {/* ================= the papers ================= */}
        <Rise delay={0}>
          <View style={[styles.paper, { borderColor: tone.edge }]}>
            <View style={styles.grain} pointerEvents="none">
              <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.fill} />
            </View>
            <Text style={[styles.paperKey, { color: tone.tint }]}>The morning papers</Text>
            <View style={[styles.rule, { backgroundColor: tone.edge }]} />
            <Text style={styles.paperHead}>{paper.headline}</Text>
            <Text style={styles.paperQuote}>{paper.quote}</Text>
            <Text style={styles.paperSource}>{paper.source}</Text>
          </View>
        </Rise>

        {/* ================= the season as a shape ================= */}
        <Text style={[text.label, styles.sect]}>The season</Text>
        <SeasonCurve
          positions={curve.positions}
          outcomes={curve.outcomes}
          tint={tone.tint}
        />

        {/* ================= highlights ================= */}
        <Text style={[text.label, styles.sect]}>Season highlights</Text>
        <View style={styles.hlGrid}>
          {stats.map((h, i) => (
            <View
              key={h.label}
              style={[
                styles.hl,
                {
                  borderColor: alpha(HL_HUES[i % HL_HUES.length], 0.24),
                  backgroundColor: alpha(HL_HUES[i % HL_HUES.length], 0.07),
                },
              ]}
            >
              <Text
                style={[styles.hlValue, { color: HL_HUES[i % HL_HUES.length] }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                allowFontScaling={false}
              >
                {h.value}
              </Text>
              <Text style={styles.hlLabel}>{h.label}</Text>
            </View>
          ))}
        </View>

        {/* ================= awards ================= */}
        <Rise delay={0}>
          <View style={styles.awards}>
            <View style={styles.grain} pointerEvents="none">
              <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.fill} />
            </View>
            <Text style={styles.awardsKey}>Season awards</Text>
            <Award
              tint={hue.gold}
              mark="🏆"
              label="Player of the season"
              name={trophies.pots?.name}
              stat={
                trophies.pots
                  ? `${trophies.pots.value} goals, ${trophies.pots.extra ?? 0} assists`
                  : undefined
              }
              squad={byName}
              top
            />
            <Award
              tint={hue.rose}
              mark="⚽"
              label="Golden Boot"
              name={trophies.boot?.name}
              stat={trophies.boot ? `${trophies.boot.value} goals` : undefined}
              squad={byName}
            />
            <Award
              tint={hue.sky}
              mark="🎯"
              label="Playmaker"
              name={trophies.playmaker?.name}
              stat={trophies.playmaker ? `${trophies.playmaker.value} assists` : undefined}
              squad={byName}
            />
            <Award
              tint={hue.violet}
              mark="🧤"
              label="Golden Glove"
              name={trophies.glove?.name}
              stat={trophies.glove ? `${trophies.glove.value} clean sheets` : undefined}
              squad={byName}
            />
          </View>
        </Rise>

        {/* ================= what every player did ================= */}
        <Text style={[text.label, styles.sect]}>Player statistics</Text>
        <View style={styles.players}>
          {squad.map((p, si) => {
            const st = result.playerStats[p.n] ?? { g: 0, a: 0, cs: 0 };
            const keeps = p.pos === 'GK' || p.pos === 'DEF';
            const expected = expectedRating(p.rtg);
            // his season, not the one before it
            const did = played.get(p.n);
            const rating = did?.avgR ?? null;
            const apps = did?.apps ?? 0;
            const out = did?.daysOut ?? 0;
            return (
              <View key={`${p.n}-${si}`} style={styles.pl}>
                <View
                  style={[
                    styles.plPos,
                    {
                      backgroundColor: positionColor[p.pos] + '26',
                      borderColor: positionColor[p.pos] + '66',
                    },
                  ]}
                >
                  <Text style={[styles.plPosText, { color: positionColor[p.pos] }]}>
                    {p.pos}
                  </Text>
                </View>
                <View style={styles.plName}>
                  <Text style={styles.plNameText} numberOfLines={1}>
                    {p.n}
                  </Text>
                  <Text style={styles.plMeta} numberOfLines={1}>
                    {apps} app{apps === 1 ? '' : 's'}
                    {out >= 30 ? ` · ${out} days out` : ''}
                  </Text>
                </View>
                {rating != null ? (
                  <View style={styles.plRating}>
                    <Text
                      style={[
                        styles.plRatingValue,
                        {
                          color:
                            rating >= expected + 0.3
                              ? color.win
                              : rating <= expected - 0.3
                                ? color.loss
                                : color.text1,
                        },
                      ]}
                      allowFontScaling={false}
                    >
                      {rating.toFixed(2)}
                    </Text>
                    <Text style={styles.plRatingLabel}>form</Text>
                  </View>
                ) : null}
                <PlStat value={st.g} label="G" />
                <PlStat value={st.a} label="A" />
                {keeps ? <PlStat value={st.cs} label="CS" /> : null}
              </View>
            );
          })}
        </View>

        {/* ================= every result ================= */}
        <Text style={[text.label, styles.sect]}>Every result</Text>
        <Collapse label="The thirty eight" count={result.matches.length}>
          <View style={styles.games}>
            {result.matches.map((m, i) => (
              <Press
                key={m.n}
                onPress={() => {
                  haptic('light');
                  setWatching(i);
                }}
                feel="none"
                scaleTo={0.995}
                style={styles.game}
              >
                <Text style={styles.gameMd} allowFontScaling={false}>
                  {m.n}
                </Text>
                <ClubDisc club={m.opp} size={24} />
                <View style={styles.gameBody}>
                  <Text style={styles.gameOpp} numberOfLines={1}>
                    {m.opp}
                  </Text>
                  <Text style={styles.gameWhere}>
                    {m.home ? 'Home' : 'Away'} {'·'} watch it back
                  </Text>
                </View>
                <Text
                  style={[
                    styles.gameScore,
                    {
                      color:
                        m.oc === 'win' ? hue.emerald : m.oc === 'draw' ? hue.amber : hue.crimson,
                    },
                  ]}
                  allowFontScaling={false}
                >
                  {m.gf}
                  {'–'}
                  {m.ga}
                </Text>
              </Press>
            ))}
          </View>
        </Collapse>

        {/* ================= the table ================= */}
        <Text style={[text.label, styles.sect]}>Final standings</Text>
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.colPos]}>#</Text>
            <Text style={[styles.th, styles.colClub]}>Club</Text>
            <Text style={[styles.th, styles.colNum]}>W</Text>
            <Text style={[styles.th, styles.colNum]}>D</Text>
            <Text style={[styles.th, styles.colNum]}>L</Text>
            <Text style={[styles.th, styles.colGd]}>GD</Text>
            <Text style={[styles.th, styles.colPts]}>Pts</Text>
          </View>
          {result.table.map((r, i) => (
            <Row key={r.name} row={r} pos={i + 1} tint={tone.tint} club={before.club} />
          ))}
        </View>

        {/* ================= now the summer ================= */}
        <View style={styles.divider} />
        <Text style={[text.label, styles.sect]}>The summer</Text>

        <View
          style={[
            styles.verdictCard,
            {
              borderColor: report.sacked
                ? line.danger
                : report.met
                  ? line.accent
                  : 'rgba(245,165,36,0.4)',
            },
          ]}
        >
          <Shine radius={radius.lg} group="panel" />
          <Text style={styles.verdictKey}>The board</Text>
          <Text
            style={[
              styles.verdictTitle,
              {
                color: report.sacked
                  ? color.danger
                  : report.met
                    ? color.accent
                    : color.warning,
              },
            ]}
          >
            {report.sacked ? 'You are sacked' : report.met ? 'They are pleased' : 'Not good enough'}
          </Text>
          <Text style={styles.verdictSwing}>
            Confidence {report.mgrSwing >= 0 ? 'up' : 'down'} {Math.abs(report.mgrSwing)}
            {report.deduction ? `, and ${report.deduction} points come off next season` : ''}
          </Text>
        </View>

        {report.sacked ? (
          <View style={styles.sacked}>
            <Text style={styles.sackedText}>
              The board have run out of patience. You are out of a job at{' '}
              {before.club}.
            </Text>
            {jobs.length ? (
              <>
                <Text style={styles.sackedNote}>
                  Somebody always needs a manager, and it is always a rung
                  down. Everything you have won comes with you.
                </Text>
                {jobs.map((j) => (
                  <Press
                    key={j.club}
                    onPress={() => {
                      haptic('medium');
                      const next = takeJob(after, j);
                      if (!next) return;
                      setCareer(next);
                      sfx('pick');
                      swap('/dynasty');
                    }}
                    feel="none"
                    style={styles.sackedJob}
                    scaleTo={0.98}
                  >
                    <ClubDisc club={j.club} size={30} />
                    <View style={styles.sackedJobBody}>
                      <Text style={styles.sackedJobClub} numberOfLines={1}>
                        {j.club}
                      </Text>
                      <Text style={styles.sackedJobNote} numberOfLines={1}>
                        {j.note} {'·'} rated {j.rating} {'·'} £{j.budget}m
                      </Text>
                    </View>
                    <Text style={styles.sackedJobGo} allowFontScaling={false}>
                      {'›'}
                    </Text>
                  </Press>
                ))}
              </>
            ) : null}
            <Press
              onPress={() => {
                haptic('medium');
                setCareer(null);
                home();
                go('/dynasty/start');
              }}
              feel="none"
              style={styles.sackedCta}
              scaleTo={0.98}
            >
              <Text style={styles.sackedCtaText}>
                {jobs.length ? 'Walk away and start again' : 'Find another job'}
              </Text>
            </Press>
          </View>
        ) : null}

        {/* the books */}
        <View style={styles.books}>
          <Shine radius={radius.lg} group="panel" />
          <Text style={styles.booksKey}>The books</Text>
          <View style={styles.booksGrid}>
            <Money label="Revenue" value={report.ledger.rev} />
            <Money label="Wages" value={-report.ledger.wages} />
            <Money label="Transfers" value={-report.ledger.amort} />
            <Money label="Running" value={-report.ledger.running} />
          </View>
          <View style={styles.profitRow}>
            <Text style={styles.profitKey}>Profit</Text>
            <Text
              style={[
                styles.profitValue,
                { color: report.ledger.profit >= 0 ? color.win : color.loss },
              ]}
              allowFontScaling={false}
            >
              {report.ledger.profit >= 0 ? '+' : '−'}£{Math.abs(report.ledger.profit)}m
            </Text>
          </View>
          <View style={styles.psrTrack}>
            <View
              style={[
                styles.psrFill,
                {
                  width: `${Math.max(2, Math.min(100, ((105 + report.ledger.rolling) / 210) * 100))}%`,
                  backgroundColor: report.ledger.breach
                    ? color.danger
                    : report.ledger.rolling < -60
                      ? color.warning
                      : color.accent,
                },
              ]}
            />
          </View>
          <Text style={styles.psrNote}>
            Three year rolling {report.ledger.rolling >= 0 ? '+' : '−'}£
            {Math.abs(Math.round(report.ledger.rolling))}m. The league allows losses to £105m.
          </Text>
          <Text style={styles.budgetNote}>£{report.budget}m to spend this summer.</Text>
        </View>

        {/* the squad, a year older */}
        <View style={styles.swing}>
          <Text style={styles.swingKey}>Squad rating</Text>
          <View style={styles.swingRow}>
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
        </View>

        {report.retired.length ? (
          <Group title={`${report.retired.length} retired`} tone={color.danger}>
            {report.retired.map((p) => (
              <Line key={`${p.n}-${p.age}`} name={p.n} note={`${p.age} years old, rated ${p.rtg}`} pos={p.pos} />
            ))}
          </Group>
        ) : null}

        {report.lost.length ? (
          <Group title="Left on a free" tone={color.danger}>
            {report.lost.map((n) => (
              <Line key={n} name={n} note="contract ran out and was not renewed" />
            ))}
          </Group>
        ) : null}

        {report.renewed.length ? (
          <Group title="Signed new terms" tone={color.accent}>
            {report.renewed.map((n) => (
              <Line key={n} name={n} note="contract extended" />
            ))}
          </Group>
        ) : null}

        {report.held.length ? (
          <Group title="Played too well to decline" tone={color.gold}>
            {report.held.map((p, n) => (
              <Line key={`${p.n}-${n}`} name={p.n} note={p.why ?? ''} pos={p.pos} rtg={p.rtg} />
            ))}
          </Group>
        ) : null}

        {report.improved.length ? (
          <Group title="Better than last year" tone={color.win}>
            {report.improved.map((p, i) => (
              <Change key={`${p.n}-${i}`} player={p} />
            ))}
          </Group>
        ) : null}

        {report.declined.length ? (
          <Group title="Slipping" tone={color.loss}>
            {report.declined.map((p, i) => (
              <Change key={`${p.n}-${i}`} player={p} />
            ))}
          </Group>
        ) : null}

        {report.injured.length ? (
          <Group title="On the treatment table" tone={color.warning}>
            {report.injured.map((i, n) => (
              <Line key={`${i.name}-${n}`} name={i.name} note={`${i.days} days, ${i.injury.toLowerCase()}`} />
            ))}
          </Group>
        ) : null}

        {/* back from loan, with the academy where it belongs */}
        {report.loans.length ? (
          <Group title={`${report.loans.length} back from loan`} tone={hue.mint}>
            <View style={styles.backFrom}>
              {report.loans.map((l, n) => (
                <View key={`${l.name}-${n}`} style={styles.backRow}>
                  <View style={styles.backBody}>
                    <Text style={styles.backName} numberOfLines={1}>
                      {l.name}
                    </Text>
                    <Text style={styles.backNote} numberOfLines={1}>
                      {l.apps} games at {l.club}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.backGain,
                      { color: l.gained > 0 ? hue.emerald : color.text3 },
                    ]}
                    allowFontScaling={false}
                  >
                    {l.gained > 0 ? '+' : ''}
                    {l.gained}
                  </Text>
                </View>
              ))}
            </View>
          </Group>
        ) : null}

        {report.intake.length ? (
          <Group title={`${report.intake.length} through the academy`} tone={color.accent}>
            {report.intake.map((p) => (
              <Line key={`${p.n}-${p.age}`} name={p.n} note={`${p.age} years old, rated ${p.rtg}`} pos={p.pos} />
            ))}
          </Group>
        ) : null}

        {!report.sacked ? (
          <Press
            onPress={() => {
              haptic('medium');
              swap('/dynasty');
            }}
            feel="none"
            style={styles.cta}
            scaleTo={0.98}
          >
            <Text style={styles.ctaText}>Continue to season {before.year + 1}</Text>
          </Press>
        ) : null}
      </ModeScreen>

      <MatchLive
        match={watching !== null ? result.matches[watching] : null}
        seed={before.seed ^ before.year}
        live={false}
        visible={watching !== null}
        onDone={() => setWatching(null)}
      />

      <Confetti fire={result.position === 1 && !report.sacked} />
    </>
  );
}

/**
 * One cup run, folded down to a line until you want the path.
 *
 * The line is the fate and the cheque. Opening it is every tie, who it
 * was against, where it was played and what it finished.
 */
function CupPath({ run }: { run: CupRun }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Press
        onPress={() => {
          haptic('light');
          setOpen((o) => !o);
        }}
        feel="none"
        scaleTo={0.99}
        style={[
          styles.cup,
          run.won
            ? { borderColor: alpha(hue.gold, 0.5), backgroundColor: alpha(hue.gold, 0.12) }
            : null,
          open ? styles.cupOpen : null,
        ]}
      >
        <Text style={styles.cupMark} allowFontScaling={false}>
          {COMPS[run.id].mark}
        </Text>
        <View style={styles.cupBody}>
          <Text style={styles.cupName} numberOfLines={1}>
            {run.name}
          </Text>
          <Text
            style={[styles.cupFate, run.won ? { color: hue.gold } : null]}
            numberOfLines={1}
          >
            {run.won ? 'Winners' : `Out in the ${run.elim}`}
          </Text>
        </View>
        {run.money > 0 ? (
          <Text style={styles.cupMoney} allowFontScaling={false}>
            £{Math.round(run.money)}m
          </Text>
        ) : null}
        <Text style={styles.cupChevron} allowFontScaling={false}>
          {open ? '⌃' : '⌄'}
        </Text>
      </Press>

      {open ? (
        <View style={styles.path}>
          {run.ties.map((t, i) => (
            <View key={`${t.round}-${i}`} style={styles.tie}>
              {t.opp ? <ClubDisc club={t.opp} size={24} /> : <View style={styles.tieGap} />}
              <View style={styles.tieBody}>
                <Text style={styles.tieRound}>
                  {t.round}
                  {t.neutral
                    ? ' · Wembley'
                    : t.legs
                      ? ' · two legs'
                      : t.opp
                        ? t.home
                          ? ' · home'
                          : ' · away'
                        : ''}
                </Text>
                <Text style={styles.tieOpp} numberOfLines={1}>
                  {t.opp ?? 'The league phase'}
                </Text>
                {t.detail ? <Text style={styles.tieDetail}>{t.detail}</Text> : null}
                {t.pens ? (
                  <Text style={[styles.tieDetail, { color: hue.amber }]}>{t.pens}</Text>
                ) : null}
              </View>
              {t.opp ? (
                <Text
                  style={[styles.tieScore, { color: t.won ? hue.emerald : hue.crimson }]}
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
      ) : null}
    </View>
  );
}

function Tile({ value, label, tint }: { value: number; label: string; tint?: string }) {
  return (
    <View
      style={[
        styles.tile,
        tint
          ? {
              borderColor: alpha(tint, 0.26),
              experimental_backgroundImage: `linear-gradient(180deg, ${alpha(
                tint,
                0.15,
              )} 0%, rgba(10,15,12,0) 80%)`,
            }
          : null,
      ]}
    >
      <Ticker
        value={value}
        from={0}
        blank="0"
        duration={780}
        style={[styles.tileValue, tint ? { color: tint } : null]}
      />
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function Award({
  mark,
  label,
  name,
  stat,
  squad,
  tint,
  top,
}: {
  mark: string;
  label: string;
  name?: string;
  stat?: string;
  squad: Map<string, DynastyPlayer>;
  tint: string;
  top?: boolean;
}) {
  const p = name ? squad.get(name) : undefined;
  return (
    <View
      style={[
        styles.aw,
        top ? styles.awTop : null,
        {
          borderColor: alpha(tint, top ? 0.5 : 0.26),
          backgroundColor: alpha(tint, top ? 0.12 : 0.06),
        },
      ]}
    >
      <Text style={styles.awMark} allowFontScaling={false}>
        {mark}
      </Text>
      <View style={styles.awBody}>
        <Text style={[styles.awLabel, { color: tint }]}>{label}</Text>
        <Text style={styles.awName} numberOfLines={1}>
          {name ?? 'Not awarded'}
        </Text>
        {stat ? <Text style={styles.awStat}>{stat}</Text> : null}
      </View>
      {p ? (
        <Text style={styles.awRtg} allowFontScaling={false}>
          {p.rtg}
        </Text>
      ) : null}
    </View>
  );
}

function PlStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.plStat}>
      <Text style={styles.plStatValue} allowFontScaling={false}>
        {value}
      </Text>
      <Text style={styles.plStatLabel}>{label}</Text>
    </View>
  );
}

function Row({
  row,
  pos,
  tint,
  club,
}: {
  row: TableRow;
  pos: number;
  tint: string;
  club: string;
}) {
  const zone =
    pos === 1
      ? color.gold
      : pos <= 4
        ? color.blue
        : pos <= 7
          ? color.accent
          : pos >= 18
            ? color.danger
            : 'transparent';
  return (
    <View style={[styles.tr, row.isYou ? { backgroundColor: tint + '14' } : null]}>
      <View style={[styles.zone, { backgroundColor: zone }]} />
      <Text
        style={[styles.td, styles.colPos, { color: zone === 'transparent' ? color.text3 : zone }]}
        allowFontScaling={false}
      >
        {pos}
      </Text>
      <Text
        style={[
          styles.td,
          styles.colClub,
          row.isYou ? { color: tint, fontFamily: font.bodyBold } : null,
        ]}
        numberOfLines={1}
      >
        {row.isYou ? `★ ${club}` : row.name}
      </Text>
      <Text style={[styles.td, styles.colNum]} allowFontScaling={false}>
        {row.w}
      </Text>
      <Text style={[styles.td, styles.colNum]} allowFontScaling={false}>
        {row.d}
      </Text>
      <Text style={[styles.td, styles.colNum]} allowFontScaling={false}>
        {row.l}
      </Text>
      <Text
        style={[
          styles.td,
          styles.colGd,
          { color: row.gf - row.ga >= 0 ? color.win : color.loss },
        ]}
        allowFontScaling={false}
      >
        {row.gf - row.ga >= 0 ? '+' : ''}
        {row.gf - row.ga}
      </Text>
      <Text
        style={[styles.tdPts, styles.colPts, row.isYou ? { color: tint } : null]}
        allowFontScaling={false}
      >
        {row.pts}
      </Text>
    </View>
  );
}

function Group({
  title,
  tone,
  children,
}: {
  title: string;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.group}>
      <Text style={[styles.groupKey, { color: tone }]}>{title}</Text>
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

function Line({
  name,
  note,
  pos,
  rtg,
}: {
  name: string;
  note: string;
  pos?: string;
  rtg?: number;
}) {
  const tint = pos ? (positionColor[pos as 'GK'] ?? color.text3) : color.text3;
  return (
    <View style={styles.line}>
      {pos ? (
        <View style={[styles.badge, { backgroundColor: tint + '26', borderColor: tint + '66' }]}>
          <Text style={[styles.badgeText, { color: tint }]}>{pos}</Text>
        </View>
      ) : null}
      <View style={styles.lineBody}>
        <Text style={styles.lineName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.lineNote} numberOfLines={2}>
          {note}
        </Text>
      </View>
      {rtg != null ? (
        <Text style={styles.lineRtg} allowFontScaling={false}>
          {rtg}
        </Text>
      ) : null}
    </View>
  );
}

function Change({ player: p }: { player: DynastyPlayer }) {
  const tint = positionColor[p.pos];
  const up = p.delta > 0;
  return (
    <View style={styles.line}>
      <View style={[styles.badge, { backgroundColor: tint + '26', borderColor: tint + '66' }]}>
        <Text style={[styles.badgeText, { color: tint }]}>{p.pos}</Text>
      </View>
      <View style={styles.lineBody}>
        <Text style={styles.lineName} numberOfLines={1}>
          {p.n}
        </Text>
        <Text style={styles.lineNote} numberOfLines={1}>
          now {p.age} {'·'} {p.why}
        </Text>
      </View>
      <Text style={styles.lineRtg} allowFontScaling={false}>
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

function Money({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.money}>
      <Text
        style={[styles.moneyValue, { color: value >= 0 ? color.text1 : color.text2 }]}
        allowFontScaling={false}
      >
        {value >= 0 ? '' : '−'}£{Math.abs(value)}m
      </Text>
      <Text style={styles.moneyLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  grain: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05 },
  bloom: { position: 'absolute', top: -40, left: -40, right: -40, height: 220 },

  finish: {
    alignItems: 'center',
    paddingTop: space.s5,
    paddingHorizontal: space.s4,
    paddingBottom: space.s5,
    borderRadius: radius.xl,
    borderWidth: 1,
    backgroundColor: '#0A0F0C',
    boxShadow: '0px 16px 38px rgba(0,0,0,0.55)',
    overflow: 'hidden',
  },
  mark: { fontSize: 40, lineHeight: 50 },
  posRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: space.s2 },
  posNum: {
    fontFamily: font.hero,
    fontSize: 78,
    lineHeight: 102,
    fontVariant: ['tabular-nums'],
  },
  posOrd: { fontFamily: font.displayBlack, fontSize: 24, lineHeight: 42, marginLeft: 3 },
  finTitle: {
    fontFamily: font.displayBlack,
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: 0.3,
    color: color.text1,
    textAlign: 'center',
    marginTop: -space.s2,
  },
  finSub: { ...text.body, color: color.text2, textAlign: 'center', marginTop: 4 },
  pv: {
    marginTop: space.s4,
    paddingHorizontal: space.s4,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pvText: { ...text.key, fontSize: 11 },
  pvSub: { ...text.small, fontSize: 12, marginTop: space.s2, textAlign: 'center' },

  sectNote: { ...text.small, fontSize: 11.5, marginBottom: space.s3, marginTop: -space.s2 },
  backFrom: { gap: space.s2, marginBottom: space.s2 },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.mint, 0.24),
    backgroundColor: alpha(hue.mint, 0.06),
  },
  backBody: { flex: 1, minWidth: 0 },
  backName: { fontFamily: font.bodySemi, fontSize: 14.5, lineHeight: 19, color: color.text1 },
  backNote: { ...text.small, fontSize: 11, lineHeight: 15, color: color.text3 },
  backGain: {
    fontFamily: font.displayBlack,
    fontSize: 20,
    lineHeight: 25,
    fontVariant: ['tabular-nums'],
  },

  cups: { gap: space.s2, marginBottom: space.s2 },
  cup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
  },
  cupMark: { fontSize: 20, lineHeight: 26, width: 26, textAlign: 'center' },
  cupBody: { flex: 1, minWidth: 0 },
  cupName: { fontFamily: font.bodySemi, fontSize: 14.5, lineHeight: 19, color: color.text1 },
  cupFate: { ...text.key, fontSize: 8, color: color.text3 },
  cupOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  cupChevron: { fontSize: 15, lineHeight: 19, color: color.text3, width: 14, textAlign: 'center' },
  path: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: line.card,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.02)',
    paddingHorizontal: space.s3,
    paddingBottom: space.s2,
    gap: space.s2,
  },
  tie: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingTop: space.s2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  tieGap: { width: 24 },
  tieBody: { flex: 1, minWidth: 0 },
  tieRound: { ...text.key, fontSize: 7.5, color: color.text3 },
  tieOpp: { fontFamily: font.bodySemi, fontSize: 13.5, lineHeight: 18, color: color.text1 },
  tieDetail: { fontFamily: font.body, fontSize: 10, lineHeight: 14, color: color.text3 },
  tieScore: {
    fontFamily: font.displayBlack,
    fontSize: 16,
    lineHeight: 21,
    fontVariant: ['tabular-nums'],
  },

  games: { gap: 5, paddingTop: space.s2 },
  game: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  gameMd: {
    fontFamily: font.body,
    fontSize: 11,
    lineHeight: 15,
    color: color.text3,
    width: 18,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  gameBody: { flex: 1, minWidth: 0 },
  gameOpp: { fontFamily: font.bodySemi, fontSize: 13.5, lineHeight: 18, color: color.text1 },
  gameWhere: { ...text.key, fontSize: 7.5, color: color.text3 },
  gameScore: {
    fontFamily: font.displayBlack,
    fontSize: 16,
    lineHeight: 21,
    fontVariant: ['tabular-nums'],
  },

  cupMoney: {
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 19,
    color: hue.emerald,
    fontVariant: ['tabular-nums'],
  },

  fans: {
    marginTop: space.s4,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(hue.rose, 0.24),
    backgroundColor: '#170F13',
    experimental_backgroundImage:
      'linear-gradient(180deg, #261520 0%, #150E12 70%, #0B0709 100%)',
    gap: space.s2,
  },
  fansRow: { flexDirection: 'row' },
  fansCol: { flex: 1, alignItems: 'center', gap: 1 },
  fansValue: {
    fontFamily: font.displayBlack,
    fontSize: 28,
    lineHeight: 35,
    color: hue.rose,
    fontVariant: ['tabular-nums'],
  },
  fansSwing: {
    fontFamily: font.displayBlack,
    fontSize: 28,
    lineHeight: 35,
    fontVariant: ['tabular-nums'],
  },
  fansKey: { ...text.key, fontSize: 8, color: color.text3 },
  fansNote: { ...text.small, fontSize: 12, lineHeight: 16, textAlign: 'center' },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2, marginTop: space.s4 },
  tile: {
    width: '31.7%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow:
      'inset 0px 1px 0px rgba(255,255,255,0.06), inset 0px 0px 0px 1px rgba(255,255,255,0.035)',
  },
  tileValue: {
    fontFamily: font.hero,
    fontSize: 32,
    lineHeight: 42,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  tileLabel: { ...text.key, fontSize: 8.5, color: color.text3, marginTop: 2 },

  paper: {
    marginTop: space.s6,
    padding: space.s5,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: '#0E1712',
    experimental_backgroundImage: 'linear-gradient(180deg, #16211B 0%, #0C120E 100%)',
    overflow: 'hidden',
  },
  paperKey: { ...text.key, fontSize: 10 },
  rule: { height: 1, marginTop: space.s3, marginBottom: space.s3 },
  paperHead: {
    fontFamily: font.displayBlack,
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: 0.2,
    color: color.text1,
  },
  paperQuote: {
    fontFamily: font.body,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 24,
    color: color.text2,
    marginTop: space.s3,
  },
  paperSource: {
    ...text.key,
    fontSize: 9.5,
    color: color.text3,
    marginTop: space.s3,
    textAlign: 'right',
  },

  sect: { marginTop: space.s6, marginBottom: space.s3 },

  hlGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  hl: {
    width: '48.6%',
    flexGrow: 1,
    paddingVertical: space.s3,
    paddingHorizontal: space.s4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  hlValue: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: 0.2,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  hlLabel: { ...text.key, fontSize: 8.5, color: color.text3, marginTop: 3 },

  awards: {
    marginTop: space.s6,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: '#141207',
    experimental_backgroundImage:
      'linear-gradient(180deg, #221D0D 0%, #14120A 60%, #0D0C07 100%)',
    overflow: 'hidden',
    gap: space.s2,
  },
  awardsKey: { ...text.key, fontSize: 10, color: color.gold, marginBottom: space.s1 },
  aw: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.20)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  awTop: { borderColor: 'rgba(214,178,94,0.48)', backgroundColor: 'rgba(214,178,94,0.09)' },
  awMark: { fontSize: 22, lineHeight: 28, width: 28, textAlign: 'center' },
  awBody: { flex: 1, minWidth: 0 },
  awLabel: { ...text.key, fontSize: 8.5, color: color.text3 },
  awName: {
    fontFamily: font.displayBold,
    fontSize: 19,
    lineHeight: 24,
    color: color.text1,
    marginTop: 1,
  },
  awStat: { ...text.small, fontSize: 12, color: color.gold },
  awRtg: {
    fontFamily: font.displayBlack,
    fontSize: 20,
    lineHeight: 25,
    color: color.gold,
    fontVariant: ['tabular-nums'],
  },

  players: { gap: space.s2 },
  pl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingVertical: space.s2,
    paddingHorizontal: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  plPos: {
    width: 38,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plPosText: { ...text.key, fontSize: 9 },
  plName: { flex: 1, minWidth: 0 },
  plNameText: { fontFamily: font.bodySemi, fontSize: 14, lineHeight: 19, color: color.text1 },
  plMeta: { fontFamily: font.body, fontSize: 10, lineHeight: 14, color: color.text3 },
  plRating: { alignItems: 'center', minWidth: 40 },
  plRatingValue: {
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
  },
  plRatingLabel: { ...text.key, fontSize: 7, color: color.text3 },
  plStat: { alignItems: 'center', minWidth: 26 },
  plStatValue: {
    fontFamily: font.displayBold,
    fontSize: 16,
    lineHeight: 20,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  plStatLabel: { ...text.key, fontSize: 7, color: color.text3 },

  table: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#0D1610',
    overflow: 'hidden',
  },
  thead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.s2,
    paddingRight: space.s3,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  th: { ...text.key, fontSize: 8.5, color: color.text3 },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingRight: space.s3,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  zone: { width: 3, alignSelf: 'stretch', marginRight: space.s2 },
  td: {
    fontFamily: font.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: color.text2,
    fontVariant: ['tabular-nums'],
  },
  tdPts: {
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 19,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  colPos: { width: 22, textAlign: 'center' },
  colClub: { flex: 1, paddingLeft: space.s2 },
  colNum: { width: 24, textAlign: 'center' },
  colGd: { width: 38, textAlign: 'right' },
  colPts: { width: 34, textAlign: 'right' },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: space.s7,
  },

  verdictCard: {
    alignItems: 'center',
    paddingVertical: space.s4,
    paddingHorizontal: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: '#0C1510',
    experimental_backgroundImage: gradient.card,
    overflow: 'hidden',
  },
  verdictKey: { ...text.key, fontSize: 9, color: color.text3 },
  verdictTitle: {
    fontFamily: font.displayBlack,
    fontSize: 25,
    lineHeight: 31,
    letterSpacing: 0.3,
  },
  verdictSwing: { ...text.small, fontSize: 12, marginTop: 2, textAlign: 'center' },

  sacked: {
    marginTop: space.s4,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.danger,
    backgroundColor: 'rgba(229,72,77,0.10)',
    gap: space.s3,
  },
  sackedText: { ...text.body, color: color.text2 },
  sackedNote: { ...text.small, fontSize: 12, lineHeight: 17, marginTop: -space.s1 },
  sackedJob: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.sky, 0.34),
    backgroundColor: alpha(hue.sky, 0.09),
  },
  sackedJobBody: { flex: 1, minWidth: 0 },
  sackedJobClub: {
    fontFamily: font.displayBold,
    fontSize: 17,
    lineHeight: 22,
    color: color.text1,
  },
  sackedJobNote: { ...text.small, fontSize: 11, lineHeight: 15, color: color.text3 },
  sackedJobGo: { fontSize: 18, color: hue.sky },

  sackedCta: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.danger,
  },
  sackedCtaText: { ...text.button, fontSize: 15, color: color.danger },

  books: {
    marginTop: space.s4,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    overflow: 'hidden',
    gap: space.s3,
  },
  booksKey: { ...text.key, fontSize: 9.5, color: color.text3 },
  booksGrid: { flexDirection: 'row' },
  money: { flex: 1, alignItems: 'center', gap: 1 },
  moneyValue: {
    fontFamily: font.displayBold,
    fontSize: 16,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  moneyLabel: { ...text.key, fontSize: 7.5, color: color.text3 },
  profitRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: space.s2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  profitKey: { ...text.key, fontSize: 9.5, color: color.text3 },
  profitValue: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 29,
    fontVariant: ['tabular-nums'],
  },
  psrTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  psrFill: { height: 6, borderRadius: 3 },
  psrNote: { ...text.small, fontSize: 11, marginTop: -space.s2 },
  budgetNote: { ...text.key, fontSize: 10, color: color.accent },

  swing: { alignItems: 'center', marginTop: space.s5 },
  swingKey: { ...text.key, fontSize: 9, color: color.text3 },
  swingRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  was: {
    fontFamily: font.hero,
    fontSize: 34,
    lineHeight: 45,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  arrow: { fontSize: 18, lineHeight: 45, color: color.text3 },
  now: { fontFamily: font.hero, fontSize: 50, lineHeight: 65, fontVariant: ['tabular-nums'] },

  group: { marginTop: space.s5 },
  groupKey: { ...text.key, fontSize: 10, marginBottom: space.s3 },
  groupBody: { gap: space.s2 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  badge: {
    width: 36,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...text.key, fontSize: 8.5 },
  lineBody: { flex: 1, minWidth: 0 },
  lineName: { fontFamily: font.bodySemi, fontSize: 14, lineHeight: 19, color: color.text1 },
  lineNote: { fontFamily: font.body, fontSize: 11, lineHeight: 15, color: color.text3 },
  lineRtg: {
    fontFamily: font.displayBlack,
    fontSize: 19,
    lineHeight: 24,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  delta: {
    minWidth: 32,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  deltaText: {
    fontFamily: font.displayBold,
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },

  cta: {
    marginTop: space.s7,
    marginBottom: space.s6,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: color.accent,
    experimental_backgroundImage: 'linear-gradient(140deg, #22D287 0%, #12A866 100%)',
    boxShadow: '0px 8px 22px rgba(31,197,126,0.3), inset 0px 1px 0px rgba(255,255,255,0.22)',
  },
  ctaText: { ...text.button, color: '#05170E' },
});
