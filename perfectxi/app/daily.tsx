import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { shareFrom } from '../src/ui/share';
import { useFocusEffect } from 'expo-router';
import { go, back } from '../src/game/nav';
import { ONLINE_CONFIGURED } from '../src/net/client';
import { boardLive, dailyBoard } from '../src/net/leaderboard';
import {
  ModeScreen,
  Press,
  Rise,
  Shine,
  Ticker,
  Collapse,
} from '../src/ui/components';
import { color, hue, line, radius, space, alpha, gradient } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { haptic } from '../src/ui/feel';
import { sfx } from '../src/ui/sound';
import {
  dailyNumber,
  dailyTitle,
  today as todaysPuzzle,
  untilNextDaily,
  scorecard,
  ordinal,
  liveStreak,
  playedToday,
  resultFor,
  type DailyResult,
  type DailyRecord,
} from '../src/engine';
import { dailyStore } from '../src/save';
import { startRun } from '../src/game/run';

/**
 * The Daily.
 *
 * One puzzle a day, the same one for everybody, one attempt. It is the
 * front door of the whole app: the reason to open it on a Tuesday morning
 * when there is no career to get back to.
 *
 * Everything on this screen answers one of three questions. What is today?
 * How did I do? And when is the next one?
 */
export default function Daily() {
  const [record, setRecord] = useState<DailyRecord>(() => dailyStore.read());
  const [now, setNow] = useState(() => Date.now());

  /* The clock, so the countdown moves and so the screen turns over at
     midnight without being closed and opened again. One tick a second,
     and nothing is read from storage on it. */
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  /* The record is read when the screen comes back to the front, which is
     the moment a finished run has just banked one. */
  useFocusEffect(
    useCallback(() => {
      setRecord(dailyStore.read());
      setNow(Date.now());
    }, []),
  );

  const n = dailyNumber(now);
  const puzzle = useMemo(() => todaysPuzzle(now), [n]);
  const done = playedToday(record, n);
  const mine = resultFor(record, n);
  const streak = liveStreak(record, n);
  const left = untilNextDaily(now);

  const play = useCallback(() => {
    haptic('medium');
    sfx('pick');
    startRun(puzzle.config, puzzle.seed, { daily: puzzle.n });
    go('/draft/board');
  }, [puzzle]);

  /* The share sheet is a popover on an iPad and has to point at
     something. This is the thing it points at. */
  const shareAnchor = useRef<View>(null);

  /*
   * Whether there is a board to go to.
   *
   * Asked once, and the way in appears only if the answer is yes. A
   * button that says no connection every single time is not an online
   * feature having a bad day, it is a broken one, and offering it is
   * worse than not having it.
   */
  const [hasBoard, setHasBoard] = useState(false);
  useEffect(() => {
    let alive = true;
    if (ONLINE_CONFIGURED) {
      void boardLive().then((yes) => {
        if (alive) setHasBoard(yes);
      });
    }
    return () => {
      alive = false;
    };
  }, []);

  const share = useCallback(async () => {
    if (!mine) return;
    haptic('light');
    const card = scorecard(mine.form).join('\n');
    await shareFrom(shareAnchor, {
      message:
        `Perfect XI ${dailyTitle(mine.n)}\n` +
        `${ordinal(mine.position)} on ${mine.pts} points\n\n` +
        `${card}\n\n` +
        `${puzzle.twist}`,
    });
  }, [mine, puzzle]);

  const history = record.results.filter((r: DailyResult) => r.n !== n);

  return (
    <ModeScreen
        wide
      overline="Play today"
      title={dailyTitle(n)}
      onBack={() => back()}
    >
      {/* ---- what today is ---- */}
      <View style={styles.today}>
        <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
        <Text style={styles.todayKey}>Everyone gets the same spins</Text>
        <Text style={styles.todayShape} allowFontScaling={false}>
          {puzzle.config.formation}
        </Text>
        <Text style={styles.todayEra}>{puzzle.era.name}</Text>
        <Text style={styles.todayNote}>{puzzle.era.note}</Text>

        <View style={styles.rules}>
          {puzzle.config.blitz ? (
            <Rule mark="⚡" text="Blitz. Only the top three of every board." tint={hue.amber} />
          ) : null}
          {!puzzle.config.showRatings ? (
            <Rule mark="🙈" text="No ratings. You are picking on the name." tint={hue.violet} />
          ) : null}
          <Rule mark="🎯" text="One attempt. There is no going back." tint={hue.sky} />
        </View>
      </View>

      {/* ---- how it went, or the way in ---- */}
      {done && mine ? (
        <Rise delay={0}>
          <View style={styles.result}>
            <Text style={styles.resultKey}>You finished</Text>
            <View style={styles.resultRow}>
              <Ticker
                value={mine.position}
                from={20}
                duration={520}
                style={[styles.resultPos, { color: finTint(mine.position) }]}
              />
              <Text
                style={[styles.resultOrd, { color: finTint(mine.position) }]}
                allowFontScaling={false}
              >
                {ordinal(mine.position).replace(String(mine.position), '')}
              </Text>
            </View>
            <Text style={styles.resultLine}>
              {mine.pts} points {'·'} {mine.gf} scored, {mine.ga} conceded {'·'} grade{' '}
              {mine.grade}
            </Text>

            <View style={styles.card}>
              {scorecard(mine.form).map((row, i) => (
                <Text key={i} style={styles.cardRow} allowFontScaling={false}>
                  {row}
                </Text>
              ))}
            </View>

            <View ref={shareAnchor} collapsable={false}>
              <Press onPress={share} feel="light" scaleTo={0.98} style={styles.share}>
                <Text style={styles.shareText}>Share the scorecard</Text>
              </Press>
            </View>

            {/* Only once it has been played. A board is other people's
                answers to a puzzle, and reading them before you have
                given yours spoils the one attempt you get. */}
            {hasBoard ? (
              <Press
                onPress={() => {
                  haptic('light');
                  go({
                    pathname: '/leaderboard',
                    params: { board: dailyBoard(mine.n), title: `Daily #${mine.n}` },
                  });
                }}
                feel="none"
                scaleTo={0.98}
                style={styles.board}
              >
                <Text style={styles.boardText}>See how everyone did</Text>
              </Press>
            ) : null}
          </View>
        </Rise>
      ) : (
        <Press onPress={play} feel="medium" scaleTo={0.98} style={styles.play}>
          <Text style={styles.playText}>Play today</Text>
        </Press>
      )}

      {/* ---- the streak and the record ---- */}
      <View style={styles.stats}>
        <Stat
          value={String(streak)}
          label={streak === 1 ? 'day streak' : 'day streak'}
          tint={streak >= 3 ? hue.amber : undefined}
        />
        <Stat value={String(record.played)} label="played" />
        <Stat value={String(record.won)} label="won" tint={record.won ? hue.gold : undefined} />
        <Stat value={String(record.best)} label="best points" tint={hue.emerald} />
      </View>

      {streak === 0 && record.played > 0 ? (
        <Text style={styles.broke}>
          Your streak went when you missed one. Today starts a new one.
        </Text>
      ) : null}

      {/* ---- when the next one opens ---- */}
      <View style={styles.next}>
        <Text style={styles.nextKey}>{done ? 'Next puzzle' : 'Today closes in'}</Text>
        <Text style={styles.nextTime} allowFontScaling={false}>
          {clock(left)}
        </Text>
      </View>

      {/* ---- everything before today ---- */}
      {history.length ? (
        <>
          <Text style={[text.label, styles.sect]}>Your last {history.length}</Text>
          <Collapse label="Every puzzle you have played" count={history.length}>
            <View style={styles.past}>
              {history.map((r: DailyResult) => (
                <PastRow key={r.n} result={r} />
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
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function finTint(pos: number): string {
  if (pos === 1) return hue.gold;
  if (pos <= 4) return hue.sky;
  if (pos <= 7) return hue.emerald;
  if (pos >= 18) return hue.crimson;
  return color.text1;
}

function Rule({ mark, text: body, tint }: { mark: string; text: string; tint: string }) {
  return (
    <View style={[styles.rule, { borderColor: alpha(tint, 0.28), backgroundColor: alpha(tint, 0.08) }]}>
      <Text style={styles.ruleMark} allowFontScaling={false}>
        {mark}
      </Text>
      <Text style={styles.ruleText}>{body}</Text>
    </View>
  );
}

function Stat({ value, label, tint }: { value: string; label: string; tint?: string }) {
  return (
    <View style={styles.stat}>
      <Text
        style={[styles.statValue, tint ? { color: tint } : null]}
        allowFontScaling={false}
      >
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PastRow({ result: r }: { result: DailyResult }) {
  return (
    <View style={styles.pastRow}>
      <Text style={styles.pastN} allowFontScaling={false}>
        #{r.n}
      </Text>
      <Text
        style={[styles.pastPos, { color: finTint(r.position) }]}
        allowFontScaling={false}
      >
        {ordinal(r.position)}
      </Text>
      <Text style={styles.pastPts} allowFontScaling={false}>
        {r.pts} pts
      </Text>
      <Text style={styles.pastCard} numberOfLines={1} allowFontScaling={false}>
        {r.form
          .slice(0, 12)
          .split('')
          .map((c) => (c === 'w' ? '🟩' : c === 'd' ? '🟨' : '🟥'))
          .join('')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  today: {
    alignItems: 'center',
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: alpha(hue.sky, 0.3),
    backgroundColor: '#0B1219',
    experimental_backgroundImage:
      'linear-gradient(180deg, #16273A 0%, #0D1319 62%, #080B0E 100%)',
    overflow: 'hidden',
  },
  todayKey: { ...text.key, fontSize: 9, color: hue.sky },
  todayShape: {
    fontFamily: font.hero,
    fontSize: 52,
    lineHeight: 68,
    color: color.text1,
    letterSpacing: 1,
  },
  todayEra: {
    fontFamily: font.displayBold,
    fontSize: 19,
    lineHeight: 24,
    color: color.text1,
    marginTop: -space.s2,
  },
  todayNote: { ...text.small, fontSize: 12, lineHeight: 17, marginTop: 2, textAlign: 'center' },
  rules: { alignSelf: 'stretch', gap: 6, marginTop: space.s4 },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: 8,
    paddingHorizontal: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  ruleMark: { fontSize: 15, lineHeight: 20 },
  ruleText: { ...text.small, fontSize: 12, lineHeight: 17, color: color.text2, flex: 1 },

  play: {
    marginTop: space.s5,
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: hue.emerald,
    experimental_backgroundImage: 'linear-gradient(140deg, #22D287 0%, #12A866 100%)',
    boxShadow: '0px 10px 26px rgba(31,197,126,0.32), inset 0px 1px 0px rgba(255,255,255,0.22)',
  },
  playText: { ...text.button, fontSize: 18, color: '#05170E' },

  result: {
    alignItems: 'center',
    marginTop: space.s5,
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  resultKey: { ...text.key, fontSize: 9, color: color.text3 },
  resultRow: { flexDirection: 'row', alignItems: 'flex-start' },
  resultPos: {
    fontFamily: font.hero,
    fontSize: 58,
    lineHeight: 76,
    fontVariant: ['tabular-nums'],
  },
  resultOrd: { fontFamily: font.displayBlack, fontSize: 20, lineHeight: 32, marginLeft: 2 },
  resultLine: { ...text.small, fontSize: 12.5, lineHeight: 18, marginTop: -space.s2 },
  card: { alignItems: 'center', marginTop: space.s4, gap: 3 },
  cardRow: { fontSize: 19, lineHeight: 24, letterSpacing: 1 },
  board: {
    /* alignSelf and minHeight are what bound the touch target. Press
       moves the layout keys to the outer Pressable and leaves the rest
       on an inner view that grows to fill it, so a style with no layout
       key at all leaves nothing to fill and the button stretches down
       the page. Every other button here carries both. */
    alignSelf: 'stretch',
    minHeight: 46,
    marginTop: space.s2,
    justifyContent: 'center',
    paddingVertical: space.s3,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.emerald, 0.4),
  },
  boardText: { ...text.button, fontSize: 14, color: hue.emerald },
  share: {
    alignSelf: 'stretch',
    marginTop: space.s4,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.sky, 0.45),
    backgroundColor: alpha(hue.sky, 0.12),
  },
  shareText: { ...text.button, fontSize: 15, color: hue.sky },

  stats: {
    flexDirection: 'row',
    marginTop: space.s5,
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
  broke: { ...text.small, fontSize: 12, lineHeight: 17, marginTop: space.s3, color: hue.amber },

  next: {
    alignItems: 'center',
    marginTop: space.s4,
    paddingVertical: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 2,
  },
  nextKey: { ...text.key, fontSize: 9, color: color.text3 },
  nextTime: {
    fontFamily: font.displayBlack,
    fontSize: 30,
    lineHeight: 38,
    color: color.text1,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },

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
  pastPos: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 19,
    width: 40,
  },
  pastPts: {
    fontFamily: font.body,
    fontSize: 12,
    lineHeight: 17,
    color: color.text2,
    width: 52,
    fontVariant: ['tabular-nums'],
  },
  pastCard: { fontSize: 11, lineHeight: 16, flex: 1, textAlign: 'right' },
});
