import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Text, View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { router, Stack } from 'expo-router';
import {
  ModeScreen,
  Press,
  Ticker,
  Rise,
  Pitch,
  ClubDisc,
  MatchLive,
  Confirm,
  Shine,
} from '../../src/ui/components';
import { color, space, radius, line, gradient, positionColor } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { GRAIN_URI } from '../../src/ui/grain';
import { haptic, useReduceMotion } from '../../src/ui/feel';
import {
  awards,
  calcOdds,
  chemBonus,
  expectation,
  finishFor,
  highlights,
  ordinal,
  squadAvg,
  verdict,
  type FinishTone,
  type Grade,
  type MatchResult,
  type Position,
  type Slot,
  type TableRow,
} from '../../src/engine';
import { clearRun, useRun } from '../../src/game/run';
import { progressStore } from '../../src/save';

/**
 * The season review.
 *
 * The site puts eight sections on this page and every one of them earns its
 * place: where you came and what it means, the papers, the numbers, the
 * awards, what every player did, all thirty eight results, and the table
 * you finished in. A results screen that shows a score and a table is a
 * receipt.
 *
 * Two things here the site does not have. Every result can be tapped and
 * watched back in full, because the match engine is the same one that
 * played it. And the season is set against what the odds card promised you
 * on Squad Complete, in places and in points, which is the only way to know
 * whether the XI you drafted was any good or merely lucky.
 */

const TONE: Record<
  FinishTone,
  { tint: string; edge: string; wash: string }
> = {
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

const GRADE_TINT: Record<Grade, string> = {
  S: color.gold,
  A: color.accent,
  B: color.accent,
  C: color.blue,
  D: color.text2,
  E: color.warning,
  F: color.danger,
};

const OUTCOME = {
  win: color.win,
  draw: color.draw,
  loss: color.loss,
} as const;

const POS_ORDER: Position[] = ['GK', 'DEF', 'MID', 'ATT'];

/** Just the suffix, so the number itself can count up on its own. */
function suffix(n: number): string {
  return ordinal(n).replace(String(n), '');
}

/**
 * Chop a list into rows of a fixed size.
 *
 * Thirty eight does not divide by four, and a wrapping flex row handles
 * that by stretching the last two tiles across the width, which is what
 * made the grid look broken. Real rows with real columns do not.
 */
function rows<T>(items: readonly T[], per: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += per) out.push(items.slice(i, i + per));
  return out;
}

export default function Results() {
  const run = useRun();
  const banked = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const [watching, setWatching] = useState<number | null>(null);

  // The season goes on the record here rather than while it was playing, so
  // a season abandoned halfway never counts.
  useEffect(() => {
    const r = run?.result;
    if (!r || banked.current) return;
    banked.current = true;
    progressStore.update((p) => ({
      ...p,
      seasons: p.seasons + 1,
      titles: p.titles + (r.position === 1 ? 1 : 0),
      best: Math.max(p.best, r.pts),
      coins:
        p.coins +
        30 +
        Math.round(r.pts / 2) +
        (r.position === 1 ? 120 : r.position <= 4 ? 45 : 0),
      xp:
        p.xp +
        140 +
        r.pts * 3 +
        (r.position === 1 ? 400 : r.position <= 4 ? 180 : r.position <= 10 ? 60 : 0),
    }));
  }, [run]);

  const result = run?.result ?? null;

  const trophies = useMemo(
    () => (run && result ? awards(result.playerStats, run.state.squad) : null),
    [run, result],
  );

  const rewatch = useCallback((index: number) => {
    haptic('light');
    setWatching(index);
  }, []);

  if (!run || !result) return null;

  const { squad, config } = run.state;
  const avg = squadAvg(squad);
  const odds = calcOdds(avg, chemBonus(squad));
  const fin = finishFor(result);
  const tone = TONE[fin.tone];
  const exp = expectation(avg, result.position);
  const paper = verdict(result);
  const stats = highlights(result);

  const placesBetter = odds.projFinish - result.position;
  const pointsBetter = result.pts - odds.expPts;

  const ordered = squad
    .filter((s): s is Slot & { player: NonNullable<Slot['player']> } => !!s.player)
    .slice()
    .sort((a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos));

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />

      <ModeScreen
        overline="Season complete"
        title={config.formation}
        onBack={() => setLeaving(true)}
        right={
          <View
            style={[
              styles.grade,
              {
                borderColor: GRADE_TINT[result.grade],
                backgroundColor: GRADE_TINT[result.grade] + '1F',
              },
            ]}
          >
            <Text style={[styles.gradeText, { color: GRADE_TINT[result.grade] }]}>
              {result.grade}
            </Text>
          </View>
        }
      >
        {/* ================= where you finished ================= */}
        <Finish
          position={result.position}
          title={fin.title}
          sub={fin.sub}
          mark={fin.mark}
          tone={tone}
          expVerdict={exp.verdict}
          expLine={`Avg ${Math.round(avg)} · Expected ${exp.label} · Finished ${ordinal(
            result.position,
          )}`}
        />

        {/* ================= the six numbers ================= */}
        <View style={styles.tiles}>
          <Tile value={result.wins} label="Won" tint={color.win} />
          <Tile value={result.draws} label="Drawn" tint={color.draw} />
          <Tile value={result.losses} label="Lost" tint={color.loss} />
          <Tile value={result.gf} label="Goals for" />
          <Tile value={result.ga} label="Goals against" />
          <Tile value={result.pts} label="Points" tint={tone.tint} />
        </View>

        {/* ================= the morning papers ================= */}
        <Rise delay={0}>
          <View style={[styles.paper, { borderColor: tone.edge }]}>
            <View style={styles.grain} pointerEvents="none">
              <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.fill} />
            </View>
            <Shine radius={radius.lg} group="panel" bevel={false} clip={false} />
            <Text style={[styles.paperKey, { color: tone.tint }]}>The morning papers</Text>
            <View style={[styles.rule, { backgroundColor: tone.edge }]} />
            <Text style={styles.paperHead}>{paper.headline}</Text>
            <Text style={styles.paperQuote}>{paper.quote}</Text>
            <Text style={styles.paperSource}>{paper.source}</Text>
          </View>
        </Rise>

        {/* ================= against the odds ================= */}
        <Rise delay={1}>
          <View style={styles.odds}>
            <Shine radius={radius.lg} group="feature" />
            <Text style={styles.sectKey}>Against the odds</Text>
            <Text style={styles.oddsLead}>
              What an {Math.round(avg)} rated XI was promised, against what it did.
            </Text>

            <View style={styles.oddsGrid}>
              <OddsCol
                label="Finish"
                promised={ordinal(odds.projFinish)}
                actual={ordinal(result.position)}
                delta={placesBetter}
                unit={Math.abs(placesBetter) === 1 ? 'place' : 'places'}
              />
              <View style={styles.oddsDivide} />
              <OddsCol
                label="Points"
                promised={String(odds.expPts)}
                actual={String(result.pts)}
                delta={pointsBetter}
                unit={Math.abs(pointsBetter) === 1 ? 'point' : 'points'}
              />
            </View>
          </View>
        </Rise>

        {/* ================= season highlights ================= */}
        <Text style={[text.label, styles.sect]}>Season highlights</Text>
        <View style={styles.hlGrid}>
          {stats.map((h) => (
            <View key={h.label} style={styles.hl}>
              <Text
                style={styles.hlValue}
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

        {/* ================= season awards ================= */}
        {trophies ? (
          <Rise delay={0}>
            <View style={styles.awards}>
              <View style={styles.grain} pointerEvents="none">
                <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.fill} />
              </View>
              <Shine radius={radius.lg} group="feature" bevel={false} clip={false} />
              <Text style={styles.awardsKey}>Season awards</Text>

              <Award
                mark="🏆"
                label="Player of the season"
                name={trophies.pots?.name}
                stat={
                  trophies.pots
                    ? `${trophies.pots.value} goals, ${trophies.pots.extra ?? 0} assists`
                    : undefined
                }
                squad={ordered}
                top
              />
              <Award
                mark="⚽"
                label="Golden Boot"
                name={trophies.boot?.name}
                stat={trophies.boot ? `${trophies.boot.value} goals` : undefined}
                squad={ordered}
              />
              <Award
                mark="🎯"
                label="Playmaker"
                name={trophies.playmaker?.name}
                stat={
                  trophies.playmaker ? `${trophies.playmaker.value} assists` : undefined
                }
                squad={ordered}
              />
              <Award
                mark="🧤"
                label="Golden Glove"
                name={trophies.glove?.name}
                stat={trophies.glove ? `${trophies.glove.value} clean sheets` : undefined}
                squad={ordered}
              />
            </View>
          </Rise>
        ) : null}

        {/* ================= what every player did ================= */}
        <Text style={[text.label, styles.sect]}>Player statistics</Text>
        <View style={styles.players}>
          {ordered.map((s) => {
            const st = result.playerStats[s.player.n] ?? { g: 0, a: 0, cs: 0 };
            const keeps = s.pos === 'GK' || s.pos === 'DEF';
            return (
              <View key={s.player.n} style={styles.pl}>
                <View
                  style={[styles.plPos, { backgroundColor: positionColor[s.pos] + '26', borderColor: positionColor[s.pos] + '66' }]}
                >
                  <Text style={[styles.plPosText, { color: positionColor[s.pos] }]}>
                    {s.pos}
                  </Text>
                </View>
                <View style={styles.plRtg}>
                  <Text style={styles.plRtgText} allowFontScaling={false}>
                    {s.player.rtg}
                  </Text>
                </View>
                <View style={styles.plName}>
                  <Text style={styles.plNameText} numberOfLines={1}>
                    {s.player.n}
                  </Text>
                  <Text style={styles.plClub} numberOfLines={1}>
                    {s.player.club} {'·'} {s.player.season}
                  </Text>
                </View>
                <PlStat value={st.g} label="Goals" />
                <PlStat value={st.a} label="Assists" />
                {keeps ? <PlStat value={st.cs} label="CS" /> : null}
              </View>
            );
          })}
        </View>

        {/* ================= all thirty eight ================= */}
        <Text style={[text.label, styles.sect]}>Every result</Text>
        <Text style={styles.sectHint}>Tap any one of them to watch it back.</Text>
        <View style={styles.results}>
          {rows(result.matches, 4).map((line, r) => (
            <View key={r} style={styles.rtRow}>
              {line.map((m) => (
                <ResultTile
                  key={m.n}
                  match={m}
                  onPress={() => rewatch(m.n - 1)}
                />
              ))}
              {/* a short last row keeps its columns rather than stretching */}
              {Array.from({ length: 4 - line.length }, (_, k) => (
                <View key={`gap${k}`} style={styles.rtGap} />
              ))}
            </View>
          ))}
        </View>

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
            <Row key={r.name} row={r} pos={i + 1} tint={tone.tint} />
          ))}
          <View style={styles.legend}>
            <Key tint={color.gold} label="Champions" />
            <Key tint={color.blue} label="Champions League" />
            <Key tint={color.accent} label="Europe" />
            <Key tint={color.danger} label="Relegation" />
          </View>
        </View>

        {/* ================= the XI that did it ================= */}
        <Text style={[text.label, styles.sect]}>The XI</Text>
        <Pitch squad={squad} formation={config.formation} />

        <View style={styles.cta}>
          <Press
            onPress={() => {
              haptic('medium');
              clearRun();
              router.dismissAll();
              router.push('/draft');
            }}
            feel="none"
            style={[styles.again, { borderColor: tone.edge }]}
            scaleTo={0.98}
          >
            <Text style={[styles.againText, { color: tone.tint }]}>Draft another XI</Text>
          </Press>
          <Press
            onPress={() => {
              haptic('light');
              clearRun();
              router.dismissAll();
            }}
            feel="none"
            style={styles.home}
            scaleTo={0.98}
          >
            <Text style={styles.homeText}>Back to home</Text>
          </Press>
        </View>
      </ModeScreen>

      <MatchLive
        match={watching !== null ? result.matches[watching] : null}
        seed={run.seed}
        live={false}
        visible={watching !== null}
        onDone={() => setWatching(null)}
      />

      <Confirm
        visible={leaving}
        title="Leave the season?"
        body="The season is already on your record. Leaving just closes it."
        confirmLabel="Leave"
        onCancel={() => setLeaving(false)}
        onConfirm={() => {
          setLeaving(false);
          clearRun();
          router.dismissAll();
        }}
      />
    </>
  );
}

/**
 * The moment the run resolves into.
 *
 * The position counts up under a bloom in the colour of what it means, so
 * third and thirteenth do not arrive on the same card looking the same.
 */
function Finish({
  position,
  title,
  sub,
  mark,
  tone,
  expVerdict,
  expLine,
}: {
  position: number;
  title: string;
  sub: string;
  mark: string;
  tone: { tint: string; edge: string; wash: string };
  expVerdict: 'over' | 'met' | 'under';
  expLine: string;
}) {
  const reduce = useReduceMotion();
  const inn = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) return;
    inn.value = withDelay(90, withSpring(1, { stiffness: 170, damping: 20, mass: 1 }));
    haptic('success');
  }, [inn, reduce]);

  const numStyle = useAnimatedStyle(() => ({
    opacity: inn.value,
    transform: [{ scale: 0.78 + inn.value * 0.22 }],
  }));
  const restStyle = useAnimatedStyle(() => ({
    opacity: inn.value,
    transform: [{ translateY: (1 - inn.value) * 12 }],
  }));

  const pill =
    expVerdict === 'over'
      ? { tint: color.accent, text: 'Overperformed', mark: '▲' }
      : expVerdict === 'under'
        ? { tint: color.danger, text: 'Underperformed', mark: '▼' }
        : { tint: color.text2, text: 'As expected', mark: '=' };

  return (
    <View
      style={[
        styles.finish,
        { borderColor: tone.edge, experimental_backgroundImage: tone.wash },
      ]}
    >
      <View style={styles.finishBloom} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="finishBloom" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={tone.tint} stopOpacity={0.34} />
              <Stop offset="1" stopColor={tone.tint} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50" cy="6" rx="66" ry="50" fill="url(#finishBloom)" />
        </Svg>
      </View>
      <View style={styles.grain} pointerEvents="none">
        <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.fill} />
      </View>
      <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
      <View style={styles.finishEdge} pointerEvents="none" />

      <Text style={styles.finishMark} allowFontScaling={false}>
        {mark}
      </Text>

      <Animated.View style={[styles.finishNum, numStyle]}>
        <Ticker
          value={position}
          from={20}
          duration={1000}
          blank="0"
          style={[styles.finishPos, { color: tone.tint }]}
        />
        <Text style={[styles.finishOrd, { color: tone.tint }]} allowFontScaling={false}>
          {suffix(position)}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.finishRest, restStyle]}>
        <Text style={styles.finishTitle}>{title}</Text>
        <Text style={styles.finishSub}>{sub}</Text>

        <View
          style={[
            styles.pv,
            { borderColor: pill.tint + '66', backgroundColor: pill.tint + '1A' },
          ]}
        >
          <Text style={[styles.pvText, { color: pill.tint }]}>
            {pill.mark} {pill.text}
          </Text>
        </View>
        <Text style={styles.pvSub}>{expLine}</Text>
      </Animated.View>
    </View>
  );
}

function Tile({ value, label, tint }: { value: number; label: string; tint?: string }) {
  return (
    <View style={styles.tile}>
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

function OddsCol({
  label,
  promised,
  actual,
  delta,
  unit,
}: {
  label: string;
  promised: string;
  actual: string;
  delta: number;
  unit: string;
}) {
  const tint = delta > 0 ? color.accent : delta < 0 ? color.danger : color.text2;
  return (
    <View style={styles.oddsCol}>
      <Text style={styles.oddsKey}>{label}</Text>
      <View style={styles.oddsPair}>
        <View style={styles.oddsHalf}>
          <Text style={styles.oddsPromised} allowFontScaling={false}>
            {promised}
          </Text>
          <Text style={styles.oddsCap}>Promised</Text>
        </View>
        <Text style={styles.oddsArrow} allowFontScaling={false}>
          {'→'}
        </Text>
        <View style={styles.oddsHalf}>
          <Text style={[styles.oddsActual, { color: tint }]} allowFontScaling={false}>
            {actual}
          </Text>
          <Text style={styles.oddsCap}>Actual</Text>
        </View>
      </View>
      <Text style={[styles.oddsDelta, { color: tint }]}>
        {delta === 0
          ? `Exactly as promised`
          : `${Math.abs(delta)} ${unit} ${delta > 0 ? 'better' : 'worse'}`}
      </Text>
    </View>
  );
}

function Award({
  mark,
  label,
  name,
  stat,
  squad,
  top,
}: {
  mark: string;
  label: string;
  name?: string;
  stat?: string;
  squad: (Slot & { player: NonNullable<Slot['player']> })[];
  top?: boolean;
}) {
  const slot = name ? squad.find((s) => s.player.n === name) : undefined;
  return (
    <View style={[styles.aw, top ? styles.awTop : null]}>
      <Text style={styles.awMark} allowFontScaling={false}>
        {mark}
      </Text>
      <View style={styles.awBody}>
        <Text style={styles.awLabel}>{label}</Text>
        <Text style={styles.awName} numberOfLines={1}>
          {name ?? 'Not awarded'}
        </Text>
        {stat ? <Text style={styles.awStat}>{stat}</Text> : null}
      </View>
      {slot ? <ClubDisc club={slot.player.club} size={32} /> : null}
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

/** One of the thirty eight, tappable, colour coded by what happened. */
function ResultTile({ match, onPress }: { match: MatchResult; onPress: () => void }) {
  const tint = OUTCOME[match.oc];
  return (
    <Press
      onPress={onPress}
      feel="none"
      scaleTo={0.94}
      style={[
        styles.rt,
        { borderColor: tint + '26', backgroundColor: tint + '12' },
      ]}
    >
      <Text style={styles.rtKey} allowFontScaling={false}>
        {match.n} {match.home ? 'H' : 'A'}
      </Text>
      <Text style={[styles.rtScore, { color: tint }]} allowFontScaling={false}>
        {match.gf}
        {'–'}
        {match.ga}
      </Text>
      <Text style={styles.rtOpp} numberOfLines={1}>
        {match.opp}
      </Text>
    </Press>
  );
}

function Row({ row, pos, tint }: { row: TableRow; pos: number; tint: string }) {
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
      <Text style={[styles.td, styles.colPos, { color: zone === 'transparent' ? color.text3 : zone }]} allowFontScaling={false}>
        {pos}
      </Text>
      <Text
        style={[styles.td, styles.colClub, row.isYou ? { color: tint, fontFamily: font.bodyBold } : null]}
        numberOfLines={1}
      >
        {row.isYou ? '★ ' : ''}
        {row.name}
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

function Key({ tint, label }: { tint: string; label: string }) {
  return (
    <View style={styles.key}>
      <View style={[styles.keyDot, { backgroundColor: tint }]} />
      <Text style={styles.keyText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  grain: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05 },

  grade: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeText: {
    fontFamily: font.displayBlack,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: 0.5,
  },

  sect: { marginTop: space.s6, marginBottom: space.s3 },
  sectKey: { ...text.key, fontSize: 10, color: color.text3, marginBottom: space.s2 },
  sectHint: { ...text.small, marginTop: -space.s2, marginBottom: space.s3 },

  /* ---- the finish ---- */
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
  finishBloom: { position: 'absolute', top: -40, left: -40, right: -40, height: 220 },
  finishEdge: {
    position: 'absolute',
    top: 0,
    left: '22%',
    right: '22%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  finishMark: { fontSize: 34, lineHeight: 42 },
  finishNum: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 2 },
  finishPos: {
    fontFamily: font.hero,
    fontSize: 86,
    lineHeight: 112,
    fontVariant: ['tabular-nums'],
  },
  finishOrd: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 44,
    letterSpacing: 0.5,
    marginLeft: 3,
  },
  finishRest: { alignItems: 'center', marginTop: -space.s2 },
  finishTitle: {
    fontFamily: font.displayBlack,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 0.3,
    color: color.text1,
    textAlign: 'center',
  },
  finishSub: {
    ...text.body,
    color: color.text2,
    textAlign: 'center',
    marginTop: 4,
  },
  pv: {
    marginTop: space.s4,
    paddingHorizontal: space.s4,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pvText: { ...text.key, fontSize: 11 },
  pvSub: {
    ...text.small,
    fontSize: 12,
    color: color.text3,
    marginTop: space.s2,
    textAlign: 'center',
  },

  /* ---- six tiles ---- */
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s2,
    marginTop: space.s4,
  },
  tile: {
    boxShadow:
      'inset 0px 1px 0px rgba(255,255,255,0.06), inset 0px 0px 0px 1px rgba(255,255,255,0.035)',
    width: '31.7%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  tileValue: {
    fontFamily: font.hero,
    fontSize: 32,
    lineHeight: 42,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  tileLabel: { ...text.key, fontSize: 8.5, color: color.text3, marginTop: 2 },

  /* ---- the papers ---- */
  paper: {
    marginTop: space.s6,
    padding: space.s5,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: '#0E1712',
    experimental_backgroundImage: 'linear-gradient(180deg, #16211B 0%, #0C120E 100%)',
    boxShadow: '0px 10px 26px rgba(0,0,0,0.4)',
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

  /* ---- against the odds ---- */
  odds: {
    marginTop: space.s5,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  oddsLead: { ...text.small, marginBottom: space.s4 },
  oddsGrid: { flexDirection: 'row', alignItems: 'stretch' },
  oddsDivide: { width: 1, backgroundColor: line.card, marginHorizontal: space.s3 },
  oddsCol: { flex: 1, alignItems: 'center' },
  oddsKey: { ...text.key, fontSize: 9, color: color.text3, marginBottom: space.s2 },
  oddsPair: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  oddsHalf: { alignItems: 'center', minWidth: 46 },
  oddsPromised: {
    fontFamily: font.displayBold,
    fontSize: 22,
    lineHeight: 27,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  oddsActual: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 32,
    fontVariant: ['tabular-nums'],
  },
  oddsCap: { ...text.key, fontSize: 8, color: color.text3, marginTop: 1 },
  oddsArrow: { fontSize: 15, lineHeight: 20, color: color.text3 },
  oddsDelta: { ...text.key, fontSize: 9.5, marginTop: space.s3, textAlign: 'center' },

  /* ---- highlights ---- */
  hlGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  hl: {
    boxShadow:
      'inset 0px 1px 0px rgba(255,255,255,0.06), inset 0px 0px 0px 1px rgba(255,255,255,0.035)',
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

  /* ---- awards ---- */
  awards: {
    marginTop: space.s6,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: '#141207',
    experimental_backgroundImage:
      'linear-gradient(180deg, #221D0D 0%, #14120A 60%, #0D0C07 100%)',
    boxShadow: '0px 10px 26px rgba(0,0,0,0.42)',
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
  awTop: {
    borderColor: 'rgba(214,178,94,0.48)',
    backgroundColor: 'rgba(214,178,94,0.09)',
  },
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

  /* ---- player statistics ---- */
  players: { gap: space.s2 },
  pl: {
    boxShadow:
      'inset 0px 1px 0px rgba(255,255,255,0.06), inset 0px 0px 0px 1px rgba(255,255,255,0.035)',
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
  plRtg: {
    width: 32,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(31,197,126,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(31,197,126,0.32)',
  },
  plRtgText: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 18,
    color: color.accentHi,
    fontVariant: ['tabular-nums'],
  },
  plName: { flex: 1, minWidth: 0 },
  plNameText: {
    fontFamily: font.bodySemi,
    fontSize: 14,
    lineHeight: 19,
    color: color.text1,
  },
  plClub: { fontFamily: font.body, fontSize: 10.5, lineHeight: 14, color: color.text3 },
  plStat: { alignItems: 'center', minWidth: 34 },
  plStatValue: {
    fontFamily: font.displayBold,
    fontSize: 17,
    lineHeight: 21,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  plStatLabel: { ...text.key, fontSize: 7.5, color: color.text3 },

  /* ---- every result ---- */
  results: { gap: space.s2 },
  rtRow: { flexDirection: 'row', gap: space.s2 },
  rtGap: { flex: 1 },
  rt: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 7,
    paddingBottom: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  rtKey: {
    ...text.key,
    fontSize: 7.5,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  rtScore: {
    fontFamily: font.displayBlack,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  rtOpp: {
    fontFamily: font.body,
    fontSize: 9,
    lineHeight: 12,
    color: color.text3,
    maxWidth: '92%',
  },

  /* ---- the table ---- */
  table: {
    boxShadow:
      'inset 0px 1px 0px rgba(255,255,255,0.06), inset 0px 0px 0px 1px rgba(255,255,255,0.035)',
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

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s3,
    padding: space.s3,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  key: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  keyDot: { width: 8, height: 8, borderRadius: 2 },
  keyText: { ...text.key, fontSize: 8, color: color.text3 },

  /* ---- actions ---- */
  cta: { marginTop: space.s6, gap: space.s3, paddingBottom: space.s5 },
  again: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    experimental_backgroundImage: gradient.cardLift,
  },
  againText: { ...text.button },
  home: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
  },
  homeText: {
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 19,
    letterSpacing: 0.4,
    color: color.text2,
  },
});
