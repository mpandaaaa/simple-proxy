import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { swap, home } from '../src/game/nav';
import { ModeScreen, Press, Rise, Shine, Confetti } from '../src/ui/components';
import { color, space, radius, line, hue, alpha, positionColor } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { haptic } from '../src/ui/feel';
import { sfx } from '../src/ui/sound';
import {
  chemBonus,
  compareSeasons,
  duelScore,
  duelVerdict,
  mulberry32,
  other,
  ordinal,
  simulateCups,
  simulateSeason,
  squadAvg,
  squadOf,
  winnerOf,
  bankDuel,
  type Compare,
  type Slot,
} from '../src/engine';
import { clearH2H, getH2H, startH2H } from '../src/game/h2h';
import { clearRun, useRun } from '../src/game/run';
import { askRematch, fetchSeason, pollRematch, sendSeason, type SeasonCard } from '../src/net/h2hNet';
import { duelStore } from '../src/save';

/**
 * The duel review.
 *
 * Every other review in the app is a report on a season. This one is not
 * a report, it is a result, and the difference runs through every line of
 * it: there is no number on this page that does not have somebody else's
 * number next to it.
 *
 * The score is the league plus what the cups are worth, because two
 * people finishing level on points with one of them holding the
 * Continental Cup is not a draw.
 */
export default function H2HReview() {
  const run = useRun();
  const m = getH2H();
  const banked = useRef(false);

  const [theirs, setTheirs] = useState<SeasonCard | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [rematch, setRematch] = useState<{ mine: boolean; theirs: boolean } | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /* ---- mine ---- */
  const me = useMemo(() => {
    const r = run?.result;
    if (!run || !r || !m) return null;
    const squad = run.state.squad;
    const rating = Math.round(squadAvg(squad));
    const cups = simulateCups(rating, r.position, run.seed);
    const score = duelScore(r.pts, r.position, {
      national: cups.national.won,
      continental: cups.continental.won,
    });
    return {
      name: 'You',
      rating,
      pts: r.pts,
      position: r.position,
      w: r.wins,
      d: r.draws,
      l: r.losses,
      gf: r.gf,
      ga: r.ga,
      cleanSheets: r.cleanSheets,
      national: cups.national.won,
      continental: cups.continental.won,
      score: score.total,
      grade: r.grade,
      lines: score.lines,
      squad,
    };
  }, [run, m]);

  /* ---- theirs ---- */
  useEffect(() => {
    if (!m || !me || banked.current) return;
    banked.current = true;

    const theirSquad: Slot[] = squadOf(m.state, other(m.me)).squad;
    const theirRating = Math.round(squadAvg(theirSquad));

    if (!m.match) {
      /* The Machine. Its XI plays a season from the match seed, so the
         result is the same one however many times it is worked out. */
      const season = simulateSeason(
        theirSquad,
        m.config.formation,
        chemBonus(theirSquad),
        mulberry32((m.seed ^ 0x5bf03635) >>> 0),
      );
      const cups = simulateCups(theirRating, season.position, (m.seed ^ 0x1234567) >>> 0);
      const score = duelScore(season.pts, season.position, {
        national: cups.national.won,
        continental: cups.continental.won,
      });
      setTheirs({
        name: m.opponentName,
        rating: theirRating,
        pts: season.pts,
        position: season.position,
        w: season.wins,
        d: season.draws,
        l: season.losses,
        gf: season.gf,
        ga: season.ga,
        cleanSheets: season.cleanSheets,
        national: cups.national.won,
        continental: cups.continental.won,
        score: score.total,
        grade: season.grade,
        xi: theirSquad.map((s) => ({
          n: s.player?.n ?? '',
          pos: s.pos,
          rtg: s.player?.rtg ?? 0,
          club: s.player?.club ?? '',
          season: s.player?.season ?? '',
        })),
      });
      return;
    }

    /* A person. Yours goes up first, so they are never the one left
       waiting, and then theirs is waited for. */
    const mineCard: SeasonCard = {
      name: 'You',
      rating: me.rating,
      pts: me.pts,
      position: me.position,
      w: me.w,
      d: me.d,
      l: me.l,
      gf: me.gf,
      ga: me.ga,
      cleanSheets: me.cleanSheets,
      national: me.national,
      continental: me.continental,
      score: me.score,
      grade: me.grade,
      xi: me.squad.map((s) => ({
        n: s.player?.n ?? '',
        pos: s.pos,
        rtg: s.player?.rtg ?? 0,
        club: s.player?.club ?? '',
        season: s.player?.season ?? '',
      })),
    };
    void sendSeason(m.match, m.me, mineCard);
    setWaiting(true);

    const until = Date.now() + 90000;
    const ask = async () => {
      while (alive.current && Date.now() < until) {
        const got = await fetchSeason(m.match!, other(m.me));
        if (got && alive.current) {
          setTheirs(got);
          setWaiting(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
      if (alive.current) setWaiting(false);
    };
    void ask();
  }, [m, me]);

  /* Once both are in, it goes on your record. */
  const filed = useRef(false);
  useEffect(() => {
    if (!me || !theirs || !m || filed.current) return;
    filed.current = true;
    duelStore.update((rec) =>
      bankDuel(rec, {
        code: `h2h:${m.opponentName}`,
        who: m.opponentName,
        live: true,
        bot: m.bot,
        mine: me.score,
        theirs: theirs.score,
        outcome: duelVerdict(me.score, theirs.score),
        sent: false,
        at: Date.now(),
      }),
    );
  }, [me, theirs, m]);

  /* ---- another one ---- */
  useEffect(() => {
    if (!m?.match) return;
    const t = setInterval(async () => {
      const got = await pollRematch(m.match!, m.me);
      if (!got || !alive.current) return;
      setRematch({ mine: got.mine, theirs: got.theirs });
      if (got.mine && got.theirs && got.seed) {
        clearInterval(t);
        again(got.seed);
      }
    }, 2000);
    return () => clearInterval(t);
  }, [m]);

  const again = useCallback(
    (seed: number) => {
      if (!m) return;
      haptic('success');
      sfx('pick');
      clearRun();
      startH2H({
        config: m.config,
        seed,
        opponentName: m.opponentName,
        bot: m.bot,
        match: m.match ? { ...m.match, seed } : null,
      });
      swap('/h2h');
    },
    [m],
  );

  const wantRematch = useCallback(() => {
    if (!m) return;
    haptic('medium');
    const seed = Math.floor(Math.random() * 0x100000000) >>> 0;
    if (!m.match) {
      again(seed);
      return;
    }
    setRematch({ mine: true, theirs: rematch?.theirs ?? false });
    void askRematch(m.match, m.me, seed);
  }, [m, rematch, again]);

  if (!m || !me) return null;

  const outcome = theirs ? duelVerdict(me.score, theirs.score) : null;
  const tint =
    outcome === 'won' ? hue.emerald : outcome === 'drew' ? hue.amber : hue.crimson;

  const table: Compare[] = theirs
    ? compareSeasons(
        { ...me, score: me.score },
        {
          pts: theirs.pts,
          position: theirs.position,
          w: theirs.w,
          d: theirs.d,
          l: theirs.l,
          gf: theirs.gf,
          ga: theirs.ga,
          rating: theirs.rating,
          cleanSheets: theirs.cleanSheets,
          score: theirs.score,
        },
      )
    : [];

  return (
    <ModeScreen
      overline="Duel"
      title={
        outcome === 'won'
          ? 'You won'
          : outcome === 'drew'
            ? 'Level'
            : outcome === 'lost'
              ? 'You lost'
              : 'Duel result'
      }
      scroll={false}
      onBack={() => {
        clearH2H();
        clearRun();
        home();
        swap('/duel');
      }}
    >
      <Confetti fire={outcome === 'won'} />
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ================= the scoreboard ================= */}
        <View style={[styles.board, { borderColor: alpha(tint, 0.45) }]}>
          <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
          <View style={styles.boardRow}>
            <Column name="You" score={me.score} tint={hue.emerald} lead={Boolean(theirs && me.score > theirs.score)} />
            <View style={styles.dash}>
              <Text style={styles.dashText}>{'–'}</Text>
            </View>
            <Column
              name={m.opponentName}
              sub={m.bot ? 'the Machine' : 'live'}
              score={theirs ? theirs.score : null}
              tint={hue.crimson}
              lead={Boolean(theirs && theirs.score > me.score)}
              right
            />
          </View>
          <Text style={[styles.boardNote, { color: tint }]}>
            {theirs
              ? outcome === 'won'
                ? `You beat ${m.opponentName} by ${me.score - theirs.score}`
                : outcome === 'lost'
                  ? `${m.opponentName} beat you by ${theirs.score - me.score}`
                  : 'Nothing between you'
              : waiting
                ? `Waiting for ${m.opponentName} to finish their season`
                : `${m.opponentName} did not finish. No result.`}
          </Text>
        </View>

        {/* ================= where the score came from ================= */}
        <Text style={[text.label, styles.sect]}>How the score was made</Text>
        <View style={styles.split}>
          <Ledger title="You" lines={me.lines} total={me.score} tint={hue.emerald} />
          <Ledger
            title={m.opponentName}
            lines={
              theirs
                ? duelScore(theirs.pts, theirs.position, {
                    national: theirs.national,
                    continental: theirs.continental,
                  }).lines
                : []
            }
            total={theirs ? theirs.score : null}
            tint={hue.crimson}
          />
        </View>

        {/* ================= line by line ================= */}
        {theirs ? (
          <Rise delay={0}>
            <Text style={[text.label, styles.sect]}>Line by line</Text>
            <View style={styles.table}>
              <View style={styles.tHead}>
                <Text style={[styles.tHeadCell, styles.tLeft]}>You</Text>
                <Text style={[styles.tHeadCell, styles.tMid]} />
                <Text style={[styles.tHeadCell, styles.tRight]} numberOfLines={1}>
                  {m.opponentName}
                </Text>
              </View>
              {table.map((row) => (
                <Row key={row.label} row={row} />
              ))}
            </View>
          </Rise>
        ) : null}

        {/* ================= the two XIs ================= */}
        {theirs ? (
          <>
            <Text style={[text.label, styles.sect]}>The two XIs</Text>
            <View style={styles.xis}>
              {me.squad.map((s, i) => (
                <View key={i} style={styles.xiRow}>
                  <Text style={styles.xiName} numberOfLines={1}>
                    {s.player?.n ?? '-'}
                  </Text>
                  <Text style={[styles.xiPos, { color: positionColor[s.pos] }]}>{s.pos}</Text>
                  <Text style={[styles.xiName, styles.xiRightName]} numberOfLines={1}>
                    {theirs.xi[i]?.n ?? '-'}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* ================= another one ================= */}
        <View style={styles.cta}>
          <Press
            onPress={wantRematch}
            feel="medium"
            scaleTo={0.98}
            style={[styles.again, rematch?.mine ? styles.againAsked : null]}
          >
            <Text style={[styles.againText, rematch?.mine ? { color: color.text2 } : null]}>
              {!m.match
                ? 'Play again'
                : rematch?.mine && rematch?.theirs
                  ? 'Starting'
                  : rematch?.mine
                    ? `Waiting for ${m.opponentName}`
                    : rematch?.theirs
                      ? `${m.opponentName} wants another. Accept`
                      : 'Ask for a rematch'}
            </Text>
          </Press>
          {rematch?.theirs && !rematch?.mine ? (
            <Text style={styles.askNote}>
              They have asked for another one on a fresh board.
            </Text>
          ) : null}

          <Press
            onPress={() => {
              haptic('light');
              clearH2H();
              clearRun();
              home();
              swap('/duel');
            }}
            feel="none"
            scaleTo={0.98}
            style={styles.back}
          >
            <Text style={styles.backText}>Back to duels</Text>
          </Press>
        </View>

        <View style={{ height: space.s6 }} />
      </ScrollView>
    </ModeScreen>
  );
}

function Column({
  name,
  sub,
  score,
  tint,
  lead,
  right,
}: {
  name: string;
  sub?: string;
  score: number | null;
  tint: string;
  lead: boolean;
  right?: boolean;
}) {
  return (
    <View style={[styles.col, right ? { alignItems: 'flex-end' } : null]}>
      <Text style={styles.colName} numberOfLines={1}>
        {name}
      </Text>
      {sub ? <Text style={styles.colSub}>{sub}</Text> : null}
      <Text
        style={[styles.colScore, { color: lead ? tint : color.text1 }]}
        allowFontScaling={false}
      >
        {score === null ? '-' : score}
      </Text>
    </View>
  );
}

function Ledger({
  title,
  lines,
  total,
  tint,
}: {
  title: string;
  lines: { label: string; value: number }[];
  total: number | null;
  tint: string;
}) {
  return (
    <View style={styles.ledger}>
      <Text style={[styles.ledgerKey, { color: tint }]} numberOfLines={1}>
        {title}
      </Text>
      {lines.length === 0 ? <Text style={styles.ledgerNone}>Still playing</Text> : null}
      {lines.map((l) => (
        <View key={l.label} style={styles.ledgerRow}>
          <Text style={styles.ledgerLabel} numberOfLines={1}>
            {l.label}
          </Text>
          <Text style={styles.ledgerValue} allowFontScaling={false}>
            {l.value > 0 && l.label !== 'League points' ? '+' : ''}
            {l.value}
          </Text>
        </View>
      ))}
      <View style={styles.ledgerRule} />
      <View style={styles.ledgerRow}>
        <Text style={[styles.ledgerLabel, { color: color.text2 }]}>Score</Text>
        <Text style={[styles.ledgerValue, styles.ledgerTotal]} allowFontScaling={false}>
          {total ?? '-'}
        </Text>
      </View>
    </View>
  );
}

function Row({ row }: { row: Compare }) {
  const who = winnerOf(row);
  const show = (v: number) => (row.label === 'Position' ? ordinal(v) : String(v));
  return (
    <View style={[styles.tRow, row.big ? styles.tRowBig : null]}>
      <Text
        style={[
          styles.tCell,
          styles.tLeft,
          row.big ? styles.tCellBig : null,
          who === 'mine' ? { color: hue.emerald } : null,
        ]}
        allowFontScaling={false}
      >
        {show(row.mine)}
      </Text>
      <Text style={[styles.tCell, styles.tMid, styles.tLabel]} numberOfLines={1}>
        {row.label}
      </Text>
      <Text
        style={[
          styles.tCell,
          styles.tRight,
          row.big ? styles.tCellBig : null,
          who === 'theirs' ? { color: hue.crimson } : null,
        ]}
        allowFontScaling={false}
      >
        {show(row.theirs)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  pageContent: { paddingBottom: space.s4 },

  board: {
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    backgroundColor: '#0C1310',
    experimental_backgroundImage:
      'radial-gradient(120% 100% at 50% 0%, rgba(255,255,255,0.09) 0%, rgba(14,20,17,0.7) 50%, #080B09 100%)',
    overflow: 'hidden',
    gap: space.s3,
  },
  boardRow: { flexDirection: 'row', alignItems: 'center' },
  col: { flex: 1, minWidth: 0, gap: 1 },
  colName: { fontFamily: font.displayBold, fontSize: 14, lineHeight: 19, color: color.text2 },
  colSub: { ...text.key, fontSize: 7.5, color: color.text3 },
  colScore: {
    fontFamily: font.hero,
    fontSize: 52,
    lineHeight: 64,
    fontVariant: ['tabular-nums'],
  },
  dash: { paddingHorizontal: space.s2 },
  dashText: { fontFamily: font.displayBold, fontSize: 22, color: color.text3 },
  boardNote: { ...text.button, fontSize: 13, textAlign: 'center' },

  sect: { marginTop: space.s5, marginBottom: space.s2 },
  split: { flexDirection: 'row', gap: space.s2 },
  ledger: {
    flex: 1,
    minWidth: 0,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 3,
  },
  ledgerKey: { ...text.key, fontSize: 8.5 },
  ledgerNone: { ...text.small, fontSize: 11, color: color.text3 },
  ledgerRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.s2 },
  ledgerLabel: { ...text.small, fontSize: 11.5, lineHeight: 17, color: color.text3, flex: 1, minWidth: 0 },
  ledgerValue: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 18,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  ledgerTotal: { fontSize: 17, lineHeight: 22 },
  ledgerRule: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 4,
  },

  table: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: space.s2,
    paddingHorizontal: space.s3,
  },
  tHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: 4,
  },
  tHeadCell: { ...text.key, fontSize: 8, color: color.text3 },
  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tRowBig: { paddingVertical: 9 },
  tCell: {
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 20,
    color: color.text2,
    fontVariant: ['tabular-nums'],
  },
  tCellBig: { fontSize: 20, lineHeight: 26, color: color.text1 },
  tLeft: { width: 72, textAlign: 'left' },
  tRight: { width: 72, textAlign: 'right' },
  tMid: { flex: 1, minWidth: 0, textAlign: 'center' },
  tLabel: { ...text.small, fontSize: 11.5, lineHeight: 16, color: color.text3 },

  xis: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: space.s2,
    paddingHorizontal: space.s3,
  },
  xiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  xiName: {
    fontFamily: font.bodySemi,
    fontSize: 12.5,
    lineHeight: 17,
    color: color.text1,
    flex: 1,
    minWidth: 0,
  },
  xiRightName: { textAlign: 'right' },
  xiPos: { ...text.key, fontSize: 8, width: 32, textAlign: 'center' },

  cta: { marginTop: space.s6, gap: space.s2 },
  again: {
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: hue.emerald,
    experimental_backgroundImage: 'linear-gradient(140deg, #3BE59B 0%, #12A365 100%)',
    boxShadow: '0px 10px 26px rgba(31,197,126,0.26), inset 0px 1px 0px rgba(255,255,255,0.24)',
  },
  againAsked: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    experimental_backgroundImage: 'none',
    borderWidth: 1,
    borderColor: line.card,
    boxShadow: 'none',
  },
  againText: { ...text.button, fontSize: 16, color: '#04140C' },
  askNote: { ...text.small, fontSize: 11.5, lineHeight: 16, color: color.text3, textAlign: 'center' },
  back: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  backText: { ...text.button, fontSize: 14, color: color.text2 },
});
