import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ModeScreen, Press, Pitch, Shine, Confirm, Sheet } from '../src/ui/components';
import { color, space, radius, line, hue, alpha, positionColor } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { haptic } from '../src/ui/feel';
import { sfx } from '../src/ui/sound';
import {
  POSITION_LABEL,
  h2hSlotsFor,
  other,
  playableFor,
  ratingsHidden,
  squadOf,
  visibleBoard,
  type Pick,
  type Position,
} from '../src/engine';
import { clearH2H, secondsLeft, take, useH2H, SHOT_CLOCK_MS, getH2H } from '../src/game/h2h';
import { startRunWithSquad } from '../src/game/run';

/**
 * Hand the finished XI to a season.
 *
 * The head to head ends with eleven footballers and nothing else to
 * decide, so from here it is the ordinary season screen: the same engine,
 * the same thirty eight matches playing out. Only the page at the end is
 * its own.
 */
function handOver() {
  const m = getH2H();
  if (!m) return;
  startRunWithSquad(m.config, m.seed, squadOf(m.state, m.me).squad);
  router.replace('/draft/season');
}

/**
 * The head to head draft.
 *
 * One board in the middle, two XIs either side of it, and a clock. The
 * whole screen is built around the one question the mode asks that a solo
 * draft never does: do you take the best player here, or the one they
 * cannot do without.
 *
 * So the board says who it belongs to at all times, the other side's XI
 * is on the screen rather than a tap away, and every name carries what it
 * would do to your shape. Nothing about whose turn it is is ever implied.
 */
export default function HeadToHead() {
  const m = useH2H();
  const [chooser, setChooser] = useState<{ player: Pick; slots: number[] } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [, setBeat] = useState(0);

  /* The clock is read off the store rather than held here, but the screen
     still has to be told to look at it. */
  useEffect(() => {
    const t = setInterval(() => setBeat((v) => v + 1), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!m) router.replace('/duel');
  }, [m]);

  const mine = m ? squadOf(m.state, m.me) : null;
  const theirs = m ? squadOf(m.state, other(m.me)) : null;
  const myTurn = Boolean(m && !m.done && m.state.turn === m.me);

  const rows = useMemo(() => {
    if (!m || m.done) return [];
    const board = visibleBoard(m.state.board, m.state.config.blitz);
    const can = new Set(playableFor(m.state, m.me).map((p) => p.n));
    return board.map((p) => ({ player: p, playable: can.has(p.n) }));
  }, [m]);

  useEffect(() => {
    if (m?.done) {
      const t = setTimeout(() => handOver(), 400);
      return () => clearTimeout(t);
    }
  }, [m?.done]);

  const onTap = useCallback(
    (player: Pick, playable: boolean) => {
      if (!m || !myTurn || !playable) return;
      const slots = h2hSlotsFor(m.state, m.me, player);
      if (!slots.length) return;

      /* One place per position, not one per empty shirt. Three open
         midfield places are the same decision three times over, because
         which of them he stands in changes nothing: the shape is the
         same, the season is the same, and being asked reads as the game
         not knowing what it wants. Only a player who could genuinely go
         in two different positions gets a question. */
      const squad = squadOf(m.state, m.me).squad;
      const byPos = new Map<Position, number>();
      for (const i of slots) {
        const pos = squad[i].pos;
        if (!byPos.has(pos)) byPos.set(pos, i);
      }
      if (byPos.size === 1) {
        haptic('light');
        sfx('pick');
        take(player.n, slots[0]);
        return;
      }
      haptic('light');
      setChooser({ player, slots: [...byPos.values()] });
    },
    [m, myTurn],
  );

  if (!m || !mine || !theirs) return null;

  const left = secondsLeft(m);
  const hidden = ratingsHidden(m.state.config);
  const urgent = myTurn && left <= 8;

  return (
    <>
      <ModeScreen
        overline={`Round ${m.state.round} of ${mine.total}`}
        title={myTurn ? 'Your pick' : `${m.opponentName} picking`}
        scroll={false}
        onBack={() => setLeaving(true)}
        right={
          <View style={[styles.clock, urgent ? styles.clockUrgent : null]}>
            <Text
              style={[styles.clockText, urgent ? { color: hue.crimson } : null]}
              allowFontScaling={false}
            >
              {left}
            </Text>
          </View>
        }
      >
        <ScrollView
          style={styles.page}
          contentContainerStyle={styles.pageContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ---- the two of you ---- */}
          <View style={styles.versus}>
            <Shine radius={radius.lg} group="panel" />
            <Side
              label="You"
              filled={mine.filled}
              total={mine.total}
              turn={myTurn}
              tint={hue.emerald}
            />
            <View style={styles.vsMid}>
              <Text style={styles.vsText}>v</Text>
            </View>
            <Side
              label={m.opponentName}
              sub={m.bot ? 'the Machine' : 'live'}
              filled={theirs.filled}
              total={theirs.total}
              turn={!myTurn && !m.done}
              tint={hue.crimson}
              right
            />
          </View>

          {/* ---- whose turn, and how long ---- */}
          <View
            style={[
              styles.turn,
              {
                borderColor: myTurn ? alpha(hue.emerald, 0.5) : alpha(hue.crimson, 0.4),
                backgroundColor: myTurn ? alpha(hue.emerald, 0.1) : 'rgba(255,255,255,0.03)',
              },
            ]}
          >
            <Text
              style={[styles.turnText, { color: myTurn ? hue.emerald : color.text2 }]}
            >
              {m.done
                ? 'Both XIs are full'
                : myTurn
                  ? m.state.first === m.me
                    ? 'You pick first from this board'
                    : 'They have picked. Your turn'
                  : m.state.first === m.me
                    ? `${m.opponentName} is picking second`
                    : `${m.opponentName} picks first from this board`}
            </Text>
            <View style={styles.bar}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.max(0, Math.min(100, (left * 1000 * 100) / SHOT_CLOCK_MS))}%`,
                    backgroundColor: urgent ? hue.crimson : myTurn ? hue.emerald : color.text3,
                  },
                ]}
              />
            </View>
          </View>

          {/* ---- your shape ---- */}
          <View style={styles.block}>
            <Pitch
              squad={mine.squad}
              formation={m.state.config.formation}
              highlight={chooser?.slots}
            />
          </View>

          {/* ---- the board ---- */}
          {m.done ? null : (
            <>
              <View style={styles.boardHead}>
                <Text style={styles.boardKey}>On the board</Text>
                <Text style={styles.boardClub} numberOfLines={1}>
                  {m.state.club} {'·'} {m.state.season}
                </Text>
              </View>
              <View style={styles.list}>
                {rows.map((r) => (
                  <BoardRow
                    key={r.player.n}
                    player={r.player}
                    playable={r.playable && myTurn}
                    dim={!myTurn}
                    hidden={hidden}
                    onPress={() => onTap(r.player, r.playable)}
                  />
                ))}
                {rows.length === 0 ? (
                  <Text style={styles.none}>
                    Nobody on this board can fill what either of you has left.
                  </Text>
                ) : null}
              </View>
            </>
          )}

          {/* ---- what they have taken ---- */}
          <Text style={[text.label, styles.sect]}>{m.opponentName}&apos;s XI</Text>
          <View style={styles.theirs}>
            {theirs.squad.map((s, i) => (
              <View key={i} style={styles.theirRow}>
                <Text style={[styles.theirPos, { color: positionColor[s.pos] }]}>{s.pos}</Text>
                <Text style={styles.theirName} numberOfLines={1}>
                  {s.player ? s.player.n : '-'}
                </Text>
                <Text style={styles.theirClub} numberOfLines={1}>
                  {s.player ? s.player.club : ''}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ height: space.s6 }} />
        </ScrollView>
      </ModeScreen>

      {/* Where he goes, when there is more than one place he could. */}
      {/* Not bare: a bare sheet draws no surface of its own and the board
          behind shows straight through the words. */}
      <Sheet visible={chooser !== null} onClose={() => setChooser(null)}>
        <View style={styles.slots}>
          <Text style={styles.slotsTitle}>
            {chooser ? `Where does ${chooser.player.n} play?` : ''}
          </Text>
          {chooser ? (
            <Text style={styles.slotsNote}>
              {chooser.player.club} {'·'} {chooser.player.season} {'·'} rated{' '}
              {chooser.player.rtg}
            </Text>
          ) : null}
          {(chooser?.slots ?? []).map((slot) => (
            <Press
              key={slot}
              onPress={() => {
                if (!chooser) return;
                sfx('pick');
                take(chooser.player.n, slot);
                setChooser(null);
              }}
              feel="medium"
              scaleTo={0.97}
              style={[
                styles.slot,
                {
                  borderColor: positionColor[mine.squad[slot].pos],
                  backgroundColor: alpha(positionColor[mine.squad[slot].pos], 0.12),
                },
              ]}
            >
              <Text style={[styles.slotPos, { color: positionColor[mine.squad[slot].pos] }]}>
                {mine.squad[slot].pos}
              </Text>
              <Text style={styles.slotLabel}>
                {POSITION_LABEL[mine.squad[slot].pos as Position] ?? mine.squad[slot].pos}
              </Text>
            </Press>
          ))}
        </View>
      </Sheet>

      <Confirm
        visible={leaving}
        title="Leave the duel?"
        body="They are drafting against you. Walking away hands them the match."
        confirmLabel="Leave"
        onConfirm={() => {
          clearH2H();
          router.dismissAll();
          router.replace('/duel');
        }}
        onCancel={() => setLeaving(false)}
      />
    </>
  );
}

function Side({
  label,
  sub,
  filled,
  total,
  turn,
  tint,
  right,
}: {
  label: string;
  sub?: string;
  filled: number;
  total: number;
  turn: boolean;
  tint: string;
  right?: boolean;
}) {
  return (
    <View style={[styles.side, right ? { alignItems: 'flex-end' } : null]}>
      <View style={styles.sideTop}>
        {turn ? <View style={[styles.dot, { backgroundColor: tint }]} /> : null}
        <Text style={styles.sideName} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {sub ? <Text style={styles.sideSub}>{sub}</Text> : null}
      <Text style={[styles.sideCount, { color: tint }]} allowFontScaling={false}>
        {filled}
        <Text style={styles.sideOf}> / {total}</Text>
      </Text>
    </View>
  );
}

function BoardRow({
  player,
  playable,
  dim,
  hidden,
  onPress,
}: {
  player: Pick;
  playable: boolean;
  dim: boolean;
  hidden: boolean;
  onPress: () => void;
}) {
  const pos = (Array.isArray(player.pos) ? player.pos[0] : player.pos) as Position;
  return (
    <Press
      onPress={onPress}
      feel="none"
      scaleTo={playable ? 0.99 : 1}
      style={[styles.row, !playable ? styles.rowOff : null, dim ? styles.rowDim : null]}
    >
      <Text style={[styles.rowPos, { color: positionColor[pos] ?? color.text3 }]}>{pos}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {player.n}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {player.club} {'·'} {player.season}
        </Text>
      </View>
      {hidden ? null : (
        <Text style={styles.rowRtg} allowFontScaling={false}>
          {player.rtg}
        </Text>
      )}
    </Press>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  pageContent: { paddingBottom: space.s4 },

  clock: {
    minWidth: 44,
    height: 34,
    paddingHorizontal: space.s2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  clockUrgent: { borderColor: alpha(hue.crimson, 0.6), backgroundColor: alpha(hue.crimson, 0.14) },
  clockText: {
    fontFamily: font.displayBlack,
    fontSize: 17,
    lineHeight: 22,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },

  versus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.s3,
    paddingHorizontal: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#0D1410',
    overflow: 'hidden',
  },
  side: { flex: 1, minWidth: 0, gap: 1 },
  sideTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  sideName: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 19,
    color: color.text1,
    flexShrink: 1,
  },
  sideSub: { ...text.key, fontSize: 7.5, color: color.text3 },
  sideCount: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  sideOf: { fontSize: 13, color: color.text3 },
  vsMid: { paddingHorizontal: space.s2 },
  vsText: { fontFamily: font.displayBold, fontSize: 13, color: color.text3 },

  turn: {
    marginTop: space.s3,
    paddingVertical: space.s3,
    paddingHorizontal: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.s2,
  },
  turnText: { ...text.button, fontSize: 13.5, letterSpacing: 0.2 },
  bar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: { height: 4, borderRadius: 2 },

  block: { marginTop: space.s3 },

  boardHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: space.s4,
    marginBottom: space.s2,
    gap: space.s2,
  },
  boardKey: { ...text.key, fontSize: 9, color: color.text3 },
  boardClub: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 18,
    color: color.text2,
    flexShrink: 1,
  },
  list: { gap: 5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 52,
    paddingHorizontal: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rowOff: { opacity: 0.32 },
  rowDim: { opacity: 0.5 },
  rowPos: { ...text.key, fontSize: 9, width: 30 },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: font.displayBold, fontSize: 15, lineHeight: 20, color: color.text1 },
  rowMeta: { ...text.small, fontSize: 11, lineHeight: 15, color: color.text3 },
  rowRtg: {
    fontFamily: font.displayBlack,
    fontSize: 19,
    lineHeight: 24,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  none: { ...text.small, fontSize: 12.5, lineHeight: 18, color: color.text3, paddingVertical: space.s3 },

  sect: { marginTop: space.s5, marginBottom: space.s2 },
  theirs: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.crimson, 0.22),
    backgroundColor: 'rgba(229,72,77,0.05)',
    paddingVertical: space.s2,
    paddingHorizontal: space.s3,
  },
  theirRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingVertical: 4 },
  theirPos: { ...text.key, fontSize: 8, width: 28 },
  theirName: {
    fontFamily: font.bodySemi,
    fontSize: 13,
    lineHeight: 18,
    color: color.text1,
    flex: 1,
    minWidth: 0,
  },
  theirClub: { ...text.small, fontSize: 11, lineHeight: 15, color: color.text3, maxWidth: 110 },

  slots: { gap: space.s2, paddingBottom: space.s6, paddingHorizontal: space.s4, paddingTop: space.s4 },
  slotsTitle: {
    fontFamily: font.displayBlack,
    fontSize: 22,
    lineHeight: 29,
    color: color.text1,
  },
  slotsNote: {
    ...text.small,
    fontSize: 12.5,
    lineHeight: 18,
    color: color.text3,
    marginBottom: space.s2,
  },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 56,
    paddingHorizontal: space.s4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  slotPos: { ...text.key, fontSize: 10, width: 36 },
  slotLabel: { fontFamily: font.displayBold, fontSize: 15, lineHeight: 20, color: color.text1 },
});
