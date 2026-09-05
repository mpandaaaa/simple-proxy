import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { ClubDisc, ModeScreen, Press, Rise, Shine, Confirm } from '../../src/ui/components';
import { enter, go, home, swap } from '../../src/game/nav';
import { color, space, radius, alpha } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { ucl as sky } from '../../src/ui/ucl';
import { haptic } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import {
  UCL_MATCHDAYS,
  UCL_STAGE_NAME,
  uclClub,
  uclNameOf,
  uclPosition,
  uclRatingOf,
  type UclMatch,
  type UclRun,
} from '../../src/engine';
import { skipLeaguePhase, useUcl } from '../../src/game/ucl';

/**
 * The campaign.
 *
 * The league phase is the story for the first eight matches, so the table
 * is the screen: thirty six rows with the two lines that matter drawn
 * across it, the one under eighth and the one under twenty fourth. After
 * that the table is history and the tie in front of you is the screen.
 *
 * The skip button exists because eight matchdays is a lot to sit through
 * when what you came for is the knockout. It plays exactly the same
 * matches through exactly the same function.
 */
export default function UclHub() {
  const run = useUcl();
  const [asking, setAsking] = useState(false);

  const skip = useCallback(() => {
    setAsking(false);
    haptic('medium');
    sfx('whistle');
    skipLeaguePhase();
  }, []);

  if (!run) {
    return (
      <ModeScreen
        wide
        overline="Europe" title="Champions League" onBack={() => home()}>
        <Text style={styles.none}>No campaign on the go.</Text>
        <Press
          onPress={() => {
            haptic('light');
            swap('/ucl');
          }}
          feel="medium"
          scaleTo={0.98}
          style={styles.go}
        >
          <Text style={styles.goText}>Pick a club</Text>
        </Press>
      </ModeScreen>
    );
  }

  const me = uclNameOf(run, run.you);
  const next = run.ahead[0] ?? null;
  /* A campaign a career owns belongs behind that career, not behind the
     front door: backing out of it goes to the club, and finishing it goes
     back to the club rather than offering another one. */
  const owned = Boolean(run.custom && run.owner);
  const league = run.stage === 'league';
  const pos = uclPosition(run);

  return (
    <>
      <ModeScreen
        overline={UCL_STAGE_NAME[run.stage]}
        title={me}
        scroll={false}
        onBack={() => (owned ? enter('/dynasty') : home())}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled" style={styles.page} showsVerticalScrollIndicator={false}>
          {/* ================= where you are ================= */}
          <View style={styles.crest}>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg width="100%" height="100%">
                <Defs>
                  <RadialGradient id="uclhub" cx="50%" cy="20%" r="85%">
                    <Stop offset="0" stopColor={sky.blue} stopOpacity={0.2} />
                    <Stop offset="1" stopColor={sky.blue} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#uclhub)" />
              </Svg>
            </View>
            <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />

            <Text style={styles.star} allowFontScaling={false}>
              ★
            </Text>
            <Text style={styles.club} numberOfLines={1}>
              {me}
            </Text>
            <Text style={styles.crestMeta}>
              Rated {Math.round(uclRatingOf(run, run.you))}
              {run.custom ? '' : ` · Pot ${uclClub(run.you)?.pot ?? ''}`}
              {` · ${ordinalOf(pos)} of 36`}
            </Text>
            <Text style={[styles.now, run.over ? { color: sky.out } : null]}>
              {run.over
                ? run.won
                  ? 'Champions of Europe.'
                  : `Out at the ${UCL_STAGE_NAME[run.outAt ?? 'league']}.`
                : UCL_STAGE_NAME[run.stage]}
            </Text>
          </View>

          {/* ================= the rail ================= */}
          <Rail run={run} />

          {/* ================= the tie you are in ================= */}
          {/* Between the legs of a tie, whatever the aggregate is. Nil
              nil after the first leg is a state worth seeing. */}
          {next && next.n === 2 && next.stage !== 'league' && next.stage !== 'final' && run.agg ? (
            <View style={styles.agg}>
              <Text style={styles.aggKey}>AGGREGATE</Text>
              <Text style={styles.aggScore} allowFontScaling={false}>
                {run.agg.a}-{run.agg.b}
              </Text>
              <Text style={styles.aggNote}>
                {run.agg.a > run.agg.b
                  ? 'Ahead going into the second leg.'
                  : run.agg.a < run.agg.b
                    ? 'Behind going into the second leg.'
                    : 'Level going into the second leg.'}
              </Text>
            </View>
          ) : null}

          {/* ================= what is next ================= */}
          {next && !run.over ? (
            <Rise delay={0}>
              <Press
                onPress={() => {
                  haptic('medium');
                  go('/ucl/match');
                }}
                feel="none"
                scaleTo={0.98}
                style={styles.nextCard}
              >
                <View style={styles.nextTop}>
                  <Text style={styles.nextKey}>
                    {next.stage === 'league'
                      ? `MATCHDAY ${next.n + 1} OF ${UCL_MATCHDAYS}`
                      : next.stage === 'final'
                        ? 'THE FINAL'
                        : `${UCL_STAGE_NAME[next.stage].toUpperCase()} · LEG ${next.n}`}
                  </Text>
                  <Text style={styles.nextWhere}>
                    {next.neutral ? 'Neutral' : next.home ? 'Home' : 'Away'}
                  </Text>
                </View>
                <View style={styles.nextWho}>
                  <ClubDisc club={next.b} size={40} />
                  <View style={styles.nextBody}>
                    <Text style={styles.nextName} numberOfLines={1}>
                      {next.b}
                    </Text>
                    <Text style={styles.nextMeta} numberOfLines={1}>
                      Rated {Math.round(uclRatingOf(run, next.b))} {'·'}{' '}
                      {uclClub(next.b)?.country ?? ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.play}>
                  <Text style={styles.playText}>Play it</Text>
                </View>
              </Press>
            </Rise>
          ) : null}

          {run.over ? (
            <Press
              onPress={() => {
                haptic('light');
                go('/ucl/report');
              }}
              feel="medium"
              scaleTo={0.98}
              style={styles.go}
            >
              <Text style={styles.goText}>The campaign report</Text>
            </Press>
          ) : null}

          {/* ================= skipping ================= */}
          {league && !run.over && run.ahead.length > 1 ? (
            <Press
              onPress={() => {
                haptic('light');
                setAsking(true);
              }}
              feel="light"
              scaleTo={0.98}
              style={styles.skip}
            >
              <Text style={styles.skipText}>
                Skip to the knockout {'·'} {run.ahead.length} matchdays left
              </Text>
            </Press>
          ) : null}

          {/* ================= the table ================= */}
          <Text style={[text.label, styles.sect]}>
            {league ? 'The league phase' : 'How the league phase finished'}
          </Text>
          <View style={styles.table}>
            <View style={styles.tHead}>
              <Text style={[styles.th, styles.tName]}>Club</Text>
              <Text style={[styles.th, styles.tNum]}>P</Text>
              <Text style={[styles.th, styles.tNum]}>W</Text>
              <Text style={[styles.th, styles.tNum]}>D</Text>
              <Text style={[styles.th, styles.tNum]}>L</Text>
              <Text style={[styles.th, styles.tNum]}>GD</Text>
              <Text style={[styles.th, styles.tPts]}>Pts</Text>
            </View>
            {run.table.map((r, i) => {
              const you = r.club === run.you;
              const band = i < 8 ? sky.through : i < 24 ? sky.play : sky.out;
              return (
                <View key={r.club}>
                  <View
                    style={[
                      styles.tRow,
                      you ? { backgroundColor: alpha(sky.blue, 0.14) } : null,
                    ]}
                  >
                    <View style={[styles.band, { backgroundColor: band }]} />
                    <Text
                      style={[styles.td, styles.tName, you ? { color: sky.blue } : null]}
                      numberOfLines={1}
                    >
                      {i + 1}. {uclNameOf(run, r.club)}
                    </Text>
                    <Text style={[styles.td, styles.tNum]}>{r.p}</Text>
                    <Text style={[styles.td, styles.tNum]}>{r.w}</Text>
                    <Text style={[styles.td, styles.tNum]}>{r.d}</Text>
                    <Text style={[styles.td, styles.tNum]}>{r.l}</Text>
                    <Text style={[styles.td, styles.tNum]}>{r.gf - r.ga}</Text>
                    <Text style={[styles.td, styles.tPts, you ? { color: sky.blue } : null]}>
                      {r.pts}
                    </Text>
                  </View>
                  {i === 7 ? <Cut label="Straight to the last sixteen" tint={sky.through} /> : null}
                  {i === 23 ? <Cut label="Play-off for the last eight places" tint={sky.play} /> : null}
                </View>
              );
            })}
          </View>

          {/* ================= what you have played ================= */}
          {run.played.length ? (
            <>
              <Text style={[text.label, styles.sect]}>Played</Text>
              <View style={styles.card}>
                {run.played.map((m, i) => (
                  <PlayedRow key={`${m.stage}-${m.n}-${i}`} match={m} />
                ))}
              </View>
            </>
          ) : null}

          <View style={{ height: space.s6 }} />
        </ScrollView>
      </ModeScreen>

      <Confirm
        visible={asking}
        title="Skip the league phase?"
        body="The rest of your matchdays are played at once. You will see the table and the draw, not the matches."
        confirmLabel="Skip it"
        cancelLabel="Watch them"
        onCancel={() => setAsking(false)}
        onConfirm={skip}
      />
    </>
  );
}

/** Where you have got to, as a rail across the top of the competition. */
function Rail({ run }: { run: UclRun }) {
  const steps = useMemo(
    () => [
      { key: 'league', label: 'LGE' },
      { key: 'po', label: 'PO' },
      { key: 'r16', label: '16' },
      { key: 'qf', label: 'QF' },
      { key: 'sf', label: 'SF' },
      { key: 'final', label: 'FIN' },
    ],
    [],
  );
  const order = ['league', 'po', 'r16', 'qf', 'sf', 'final'];
  const at = order.indexOf(run.won ? 'final' : (run.over ? (run.outAt ?? 'league') : run.stage));

  return (
    <View style={styles.rail}>
      {steps.map((s, i) => {
        /* A campaign that ended at a round still reached that round, so
           when it is over everything up to and including it is lit. */
        const done = run.over ? i <= at : i < at;
        const now = !run.over && i === at;
        return (
          <View key={s.key} style={styles.railStep}>
            <View
              style={[
                styles.railDot,
                done ? { backgroundColor: sky.blue, borderColor: sky.blue } : null,
                now ? { borderColor: sky.blue } : null,
              ]}
            >
              <Text
                style={[
                  styles.railText,
                  done ? { color: '#04102E' } : null,
                  now ? { color: sky.blue } : null,
                ]}
                allowFontScaling={false}
              >
                {s.label}
              </Text>
            </View>
            {i < steps.length - 1 ? (
              <View style={[styles.railLine, i < at ? { backgroundColor: sky.blue } : null]} />
            ) : null}
          </View>
        );
      })}
      <Text style={[styles.trophy, run.won ? { color: sky.gold } : null]} allowFontScaling={false}>
        🏆
      </Text>
    </View>
  );
}

/** The line under eighth and the line under twenty fourth. */
function Cut({ label, tint }: { label: string; tint: string }) {
  return (
    <View style={styles.cut}>
      <View style={[styles.cutLine, { backgroundColor: alpha(tint, 0.5) }]} />
      <Text style={[styles.cutText, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function PlayedRow({ match }: { match: UclMatch }) {
  const won = match.pens ? match.pens.a > match.pens.b : match.ga > match.gb;
  const drew = match.ga === match.gb && !match.pens;
  const tint = drew ? color.text3 : won ? sky.blue : sky.out;
  return (
    <View style={styles.pRow}>
      <Text style={styles.pKey} allowFontScaling={false}>
        {match.stage === 'league' ? `MD${match.n + 1}` : match.stage === 'final' ? 'FIN' : `L${match.n}`}
      </Text>
      <Text style={styles.pName} numberOfLines={1}>
        {match.neutral ? '' : match.home ? '' : 'at '}
        {match.b}
      </Text>
      <Text style={[styles.pScore, { color: tint }]} allowFontScaling={false}>
        {match.ga}-{match.gb}
        {match.pens ? ` (${match.pens.a}-${match.pens.b}p)` : ''}
      </Text>
    </View>
  );
}

function ordinalOf(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

const styles = StyleSheet.create({
  page: { flex: 1 },

  crest: {
    alignItems: 'center',
    paddingVertical: space.s4,
    paddingHorizontal: space.s3,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: sky.edgeHi,
    backgroundColor: sky.ink,
    overflow: 'hidden',
  },
  star: { fontSize: 30, lineHeight: 38, color: sky.blue },
  club: { fontFamily: font.displayBlack, fontSize: 26, lineHeight: 33, color: color.text1 },
  crestMeta: { ...text.key, fontSize: 8, color: color.text3, marginTop: 2 },
  now: { ...text.button, fontSize: 14, color: sky.blue, marginTop: space.s2 },

  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: space.s5,
    paddingHorizontal: 2,
  },
  railStep: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  railDot: {
    minWidth: 34,
    height: 26,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  railText: { ...text.key, fontSize: 7.5, color: color.text3 },
  railLine: { flex: 1, height: 1.5, backgroundColor: 'rgba(255,255,255,0.12)' },
  trophy: { fontSize: 17, marginLeft: 4, opacity: 0.9 },

  agg: {
    alignItems: 'center',
    marginTop: space.s5,
    padding: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: sky.edgeHi,
    backgroundColor: sky.panelOn,
  },
  aggKey: { ...text.key, fontSize: 8, color: sky.blue },
  aggScore: {
    fontFamily: font.hero,
    fontSize: 34,
    lineHeight: 42,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  aggNote: { ...text.small, fontSize: 12, lineHeight: 17, color: color.text2 },

  nextCard: {
    marginTop: space.s5,
    padding: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: sky.edgeHi,
    backgroundColor: sky.panelOn,
    gap: 2,
  },
  nextTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nextKey: { ...text.key, fontSize: 8, color: sky.blue },
  nextWhere: { ...text.key, fontSize: 8, color: color.text3 },
  nextWho: { flexDirection: 'row', alignItems: 'center', gap: space.s3, marginTop: space.s2 },
  nextBody: { flex: 1, minWidth: 0, gap: 1 },
  nextName: { fontFamily: font.displayBlack, fontSize: 22, lineHeight: 29, color: color.text1 },
  nextMeta: { ...text.small, fontSize: 12, lineHeight: 17, color: color.text2 },
  play: {
    marginTop: space.s3,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: sky.blue,
  },
  playText: { ...text.button, fontSize: 15, color: '#04102E' },

  skip: {
    marginTop: space.s2,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: sky.edge,
    backgroundColor: sky.panel,
  },
  skipText: { ...text.key, fontSize: 9, color: color.text3 },

  sect: { marginTop: space.s5, marginBottom: space.s2 },
  table: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: sky.edge,
    backgroundColor: sky.panel,
    overflow: 'hidden',
  },
  tHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.s2,
    paddingRight: space.s3,
    paddingLeft: space.s3 + 4,
    borderBottomWidth: 1,
    borderBottomColor: sky.edge,
    backgroundColor: 'rgba(120,166,255,0.09)',
  },
  th: { ...text.key, fontSize: 7.5, color: color.text3 },
  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
    paddingRight: space.s3,
    paddingLeft: space.s3 + 4,
  },
  band: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  td: { ...text.small, fontSize: 12, lineHeight: 17, color: color.text2 },
  tName: { flex: 1, minWidth: 0, color: color.text1 },
  tNum: { width: 24, textAlign: 'center' },
  tPts: {
    width: 30,
    textAlign: 'right',
    fontFamily: font.displayBold,
    color: color.text1,
  },

  cut: { flexDirection: 'row', alignItems: 'center', gap: space.s2, paddingHorizontal: space.s3 },
  cutLine: { flex: 1, height: 1 },
  cutText: { ...text.key, fontSize: 7, paddingVertical: 3 },

  card: {
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: sky.edge,
    backgroundColor: sky.panel,
  },
  pRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3, minHeight: 36 },
  pKey: { ...text.key, fontSize: 7.5, color: color.text3, width: 34 },
  pName: {
    flex: 1,
    minWidth: 0,
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 19,
    color: color.text1,
  },
  pScore: {
    fontFamily: font.displayBold,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },

  none: { ...text.small, fontSize: 13, color: color.text3, marginBottom: space.s4 },
  go: {
    marginTop: space.s4,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: sky.edgeHi,
    backgroundColor: sky.panelOn,
  },
  goText: { ...text.button, fontSize: 15, color: sky.blue },
});
