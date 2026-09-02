import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import {
  ModeScreen,
  Button,
  Press,
  Pitch,
  PlayerCard,
  EraCard,
  OverallStrip,
} from '../../src/ui/components';
import { color, space, radius, positionColor, gradient, line } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic, useReduceMotion } from '../../src/ui/feel';
import {
  POSITION_LABEL,
  canPlay,
  chemBonus,
  clubSeasons,
  lastName,
  slotsForPlayer,
  squadAvg,
  squadChem,
  visibleBoard,
  type Pick,
  type Position,
  type SpinResult,
} from '../../src/engine';
import { doSpin, pickPlayer, settleSpin, spendReroll, useRun } from '../../src/game/run';

/** A player, or the rule that separates the ones you can use from the rest. */
type Row =
  | { kind: 'player'; player: Pick; playable: boolean }
  | { kind: 'divider' };

const ORDER: Position[] = ['GK', 'DEF', 'MID', 'ATT'];

export default function DraftBoard() {
  const run = useRun();
  const reduceMotion = useReduceMotion();
  const [pending, setPending] = useState<SpinResult | null>(null);
  const [chooser, setChooser] = useState<{ player: Pick; slots: number[] } | null>(null);
  const [reveal, setReveal] = useState<{ player: Pick; pos: Position } | null>(null);

  // Scenery for the reel: every club-season in the era being drafted, so
  // the cards flying past are real sides rather than invented ones.
  const cfg = run?.state.config;
  const pool = useMemo(
    () => (cfg ? clubSeasons(cfg.eraFrom, cfg.eraTo) : []),
    [cfg?.eraFrom, cfg?.eraTo],
  );

  useEffect(() => {
    if (!run) router.replace('/draft');
  }, [run]);

  // The club is decided before the reel draws a frame. The spin shows the
  // result, it never chooses it, so a seeded run still replays exactly.
  const onSpin = useCallback(() => {
    const result = doSpin();
    if (!result) return;
    setPending(result);
  }, []);

  /**
   * Auto spin after a pick, so the draft is one continuous loop rather than
   * eleven presses of the same button. The site waits 420ms from the pick;
   * here the wait starts when the signing card clears, because spinning
   * behind it would hide the spin.
   *
   * The first board is still a deliberate press. Nothing should start
   * moving before the player has asked it to.
   */
  useEffect(() => {
    if (!run || run.board || pending || reveal) return;
    if (run.state.filled === 0 || run.state.filled >= run.state.total) return;
    const t = setTimeout(onSpin, 420);
    return () => clearTimeout(t);
  }, [run, pending, reveal, onSpin]);

  const onSettled = useCallback(() => {
    setPending((p) => {
      if (p) settleSpin(p);
      return null;
    });
  }, []);

  const sign = useCallback(
    (player: Pick, slotIndex: number) => {
      if (!run) return;
      const pos = run.state.squad[slotIndex].pos;
      pickPlayer(player, slotIndex);
      setReveal({ player, pos });
    },
    [run],
  );

  const onPick = useCallback(
    (player: Pick) => {
      if (!run) return;
      const slots = slotsForPlayer(run.state, player);
      if (!slots.length) {
        haptic('warning');
        return;
      }
      if (slots.length === 1) {
        sign(player, slots[0]);
        return;
      }
      haptic('light');
      setChooser({ player, slots });
    },
    [run, sign],
  );

  const state = run?.state;
  const board = run?.board ?? null;
  const shown = useMemo(
    () => (board && state ? visibleBoard(board, state.config.blitz) : []),
    [board, state],
  );

  /**
   * Playable first, then the rest under a rule.
   *
   * The web build leaves unusable players in rating order, so a 92 rated
   * striker you have no room for sits above every player you can actually
   * sign. They stay on the list, because seeing what you turned down is
   * part of it, but they never sit above what you can use.
   */
  const rows = useMemo<Row[]>(() => {
    if (!state || !shown.length) return [];
    const yes: Row[] = [];
    const no: Row[] = [];
    for (const p of shown) {
      (canPlay(state, p) ? yes : no).push({ kind: 'player', player: p, playable: canPlay(state, p) });
    }
    return no.length ? [...yes, { kind: 'divider' }, ...no] : yes;
  }, [state, shown]);

  if (!run || !state) return null;

  const { club, season } = run;
  const left = state.total - state.filled;
  const complete = state.filled === state.total;
  const avg = squadAvg(state.squad);
  const rerollsLeft = state.rerollsMax - state.rerolls;
  const hideRatings = state.config.diff === 'hard';
  const boardAvg = shown.length
    ? Math.round(shown.reduce((n, p) => n + p.rtg, 0) / shown.length)
    : 0;

  const lines = {
    GK: squadAvg(state.squad, 'GK'),
    DEF: squadAvg(state.squad, 'DEF'),
    MID: squadAvg(state.squad, 'MID'),
    ATT: squadAvg(state.squad, 'ATT'),
  } as Record<Position, number>;

  // What is still missing, so the list can be read against the shape.
  const need = ORDER.map((p) => ({
    pos: p,
    n: state.squad.filter((s) => !s.player && s.pos === p).length,
  })).filter((x) => x.n > 0);

  const header = (
    <View style={styles.header}>
      <OverallStrip overall={avg} lines={lines} />

      <View style={styles.block}>
        <Pitch
          squad={state.squad}
          formation={state.config.formation}
          highlight={chooser?.slots}
        />
      </View>

      {/* Hidden until the first spin, exactly as the site hides it. */}
      {board || pending ? (
        <View style={styles.block}>
          <EraCard
            pick={Math.min(state.filled + 1, state.total)}
            total={state.total}
            club={board ? club : null}
            season={board ? season : null}
            strength={boardAvg}
            target={pending ? { club: pending.club, season: pending.season } : null}
            pool={pool}
            allTime={state.config.mode === 'alltime'}
            onSettled={onSettled}
          />
        </View>
      ) : null}

      {state.rerollsMax > 0 ? (
        <View style={styles.rerollRow}>
          <Press
            onPress={() => {
              if (spendReroll()) haptic('warning');
            }}
            feel="none"
            scaleTo={0.94}
            disabled={rerollsLeft === 0 || !board}
            style={[
              styles.rerollBtn,
              (rerollsLeft === 0 || !board) && styles.rerollSpent,
            ]}
          >
            <Text style={styles.rerollText}>Reroll</Text>
          </Press>
          <View style={styles.dots}>
            {Array.from({ length: state.rerollsMax }).map((_, i) => (
              <View key={i} style={[styles.dot, i < state.rerolls && styles.dotUsed]} />
            ))}
          </View>
          <Text style={styles.rerollsLeft}>
            {rerollsLeft} reroll{rerollsLeft === 1 ? '' : 's'} left
          </Text>
        </View>
      ) : null}

      {!board ? (
        <Button
          label={pending ? 'Spinning' : 'Start spinning'}
          onPress={onSpin}
          style={styles.spinBtn}
        />
      ) : null}

      {board ? (
        <>

          {need.length ? (
            <View style={styles.needRow}>
              <Text style={styles.needLabel}>You need</Text>
              {need.map((x) => (
                <View
                  key={x.pos}
                  style={[
                    styles.needChip,
                    {
                      borderColor: positionColor[x.pos] + '66',
                      backgroundColor: positionColor[x.pos] + '1c',
                    },
                  ]}
                >
                  <Text style={[styles.needText, { color: positionColor[x.pos] }]}>
                    {x.n} {x.pos}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.listHead}>
            <Text style={styles.listTitle}>Pick a player</Text>
            <Text style={styles.listCount}>{shown.length} in squad</Text>
          </View>
        </>
      ) : null}
    </View>
  );

  return (
    <ModeScreen
      overline={complete ? 'Draft complete' : `${left} left to fill`}
      title={`${state.filled} of ${state.total} picked`}
      scroll={false}
      right={
        avg > 0 ? (
          <View style={styles.avgChip}>
            <Text style={styles.avgValue}>{Math.round(avg)}</Text>
          </View>
        ) : undefined
      }
    >
      {complete ? (
        <View style={styles.doneWrap}>
          <Pitch squad={state.squad} formation={state.config.formation} />
          <View style={styles.done}>
            <Text style={styles.doneTitle}>Your XI is ready</Text>
            <Text style={[text.small, styles.doneMeta]}>
              Average {Math.round(avg)} · chemistry {squadChem(state.squad)}% · worth +
              {chemBonus(state.squad).toFixed(2)}
            </Text>
          </View>
          <Button
            label="Simulate the season"
            onPress={() => router.push('/draft/season')}
          />
        </View>
      ) : (
        // One list for the whole page, exactly as the site scrolls. Anything
        // above the players rides in the header rather than in its own
        // scroll view, so there is never a scroll inside a scroll.
        <FlashList
          data={rows}
          keyExtractor={(row, i) =>
            row.kind === 'divider' ? 'divider' : row.player.n + row.player.club + i
          }
          renderItem={({ item }) =>
            item.kind === 'divider' ? (
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Cannot fill your open positions</Text>
                <View style={styles.dividerLine} />
              </View>
            ) : (
              <PlayerRow
                player={item.player}
                playable={item.playable}
                hideRatings={hideRatings}
                onPress={onPick}
              />
            )
          }
          ListHeaderComponent={header}
          ListFooterComponent={<View style={styles.footer} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={!!chooser}
        transparent
        animationType={reduceMotion ? 'fade' : 'slide'}
        onRequestClose={() => setChooser(null)}
      >
        <Press onPress={() => setChooser(null)} feel="none" scaleTo={1} style={styles.backdrop}>
          <View />
        </Press>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>
            Where does {chooser ? lastName(chooser.player.n) : ''} play?
          </Text>
          {chooser?.slots.map((si) => {
            const pos = state.squad[si].pos;
            const tint = positionColor[pos];
            return (
              <Press
                key={si}
                onPress={() => {
                  const c = chooser;
                  setChooser(null);
                  sign(c.player, si);
                }}
                feel="none"
                style={[styles.sheetRow, { borderColor: tint + '66' }]}
              >
                <View
                  style={[styles.posBadge, { backgroundColor: tint + '24', borderColor: tint + '77' }]}
                >
                  <Text style={[styles.posText, { color: tint }]}>{pos}</Text>
                </View>
                <Text style={styles.sheetRowText}>{POSITION_LABEL[pos]}</Text>
              </Press>
            );
          })}
          <Button
            label="Cancel"
            variant="ghost"
            style={styles.sheetCancel}
            onPress={() => setChooser(null)}
          />
        </View>
      </Modal>

      <PlayerCard
        player={reveal?.player ?? null}
        slotPos={reveal?.pos ?? null}
        onDone={() => setReveal(null)}
      />
    </ModeScreen>
  );
}

function PlayerRow({
  player,
  playable,
  hideRatings,
  onPress,
}: {
  player: Pick;
  playable: boolean;
  hideRatings: boolean;
  onPress: (p: Pick) => void;
}) {
  const pos = player.pos[0] as Position;
  const tint = positionColor[pos] ?? color.text3;
  const fill = ratingFill(player.rtg);

  return (
    <Press
      onPress={() => onPress(player)}
      feel="none"
      scaleTo={0.98}
      disabled={!playable}
      style={[styles.player, !playable && styles.playerOff]}
      accessibilityLabel={`${player.n}, rated ${player.rtg}, ${POSITION_LABEL[pos] ?? pos}`}
    >
      <View style={[styles.posBadge, { backgroundColor: tint + '20', borderColor: tint + '77' }]}>
        <Text style={[styles.posText, { color: tint }]}>{pos}</Text>
      </View>

      <View style={styles.playerBody}>
        <Text style={styles.playerName} numberOfLines={1}>
          {player.n}
        </Text>
        <Text style={styles.playerMeta} numberOfLines={1}>
          {player.nat} - {player.club} {player.season}
        </Text>
      </View>

      <View
        style={[
          styles.ratingPill,
          hideRatings ? styles.ratingHidden : { backgroundColor: fill },
        ]}
      >
        <Text
          style={[styles.ratingText, hideRatings && { color: color.text3 }]}
          allowFontScaling={false}
        >
          {hideRatings ? '?' : player.rtg}
        </Text>
      </View>
    </Press>
  );
}

/**
 * The rating ramp, read off the site: emerald at the top, through
 * yellow-green in the mid eighties, to tan at eighty-two and below. Colour
 * carries the number, so the list is skimmable without reading a digit.
 */
function ratingFill(rtg: number): string {
  if (rtg >= 90) return '#35D07F';
  if (rtg >= 87) return '#57D46E';
  if (rtg >= 85) return '#7FD35F';
  if (rtg >= 83) return '#9BD75F';
  if (rtg >= 80) return '#D9BE77';
  return '#C0A579';
}

const styles = StyleSheet.create({
  header: { gap: space.s3, paddingBottom: space.s2 },
  block: {},
  footer: { height: space.s8 },

  avgChip: {
    minWidth: 42,
    paddingHorizontal: space.s2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: color.accentWeak,
    borderWidth: 1,
    borderColor: line.accent,
    alignItems: 'center',
  },
  avgValue: {
    fontFamily: font.displayBold,
    fontSize: 16,
    color: color.accent,
    fontVariant: ['tabular-nums'],
  },

  spinBtn: { marginTop: space.s2 },

  rerollRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  rerollBtn: {
    paddingHorizontal: space.s5,
    paddingVertical: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  rerollSpent: { opacity: 0.4 },
  rerollText: { fontFamily: font.bodySemi, fontSize: 15, color: color.text1 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: color.gold },
  dotUsed: { backgroundColor: 'rgba(255,255,255,0.16)' },
  rerollsLeft: { fontFamily: font.body, fontSize: 13.5, color: color.text2 },

  needRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.s2 },
  needLabel: { ...text.key, fontSize: 9.5, color: color.text3 },
  needChip: {
    paddingHorizontal: space.s2 + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  needText: {
    fontFamily: font.displayBold,
    fontSize: 11,
    letterSpacing: 0.6,
    fontVariant: ['tabular-nums'],
  },

  listHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: space.s2,
  },
  listTitle: { ...text.label, color: color.accent, fontSize: 13 },
  listCount: { fontFamily: font.body, fontSize: 13, color: color.text3 },

  player: {
    minHeight: 58,
    marginBottom: space.s2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow: 'inset 0px 1px 0px rgba(255,255,255,0.05)',
  },
  playerOff: { opacity: 0.32 },
  posBadge: {
    width: 50,
    height: 30,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posText: {
    fontFamily: font.displayBold,
    fontSize: 11.5,
    letterSpacing: 0.8,
  },
  playerBody: { flex: 1, minWidth: 0 },
  playerName: {
    fontFamily: font.bodyBold,
    fontSize: 16,
    lineHeight: 21,
    color: color.text1,
  },
  playerMeta: {
    fontFamily: font.body,
    fontSize: 12.5,
    lineHeight: 16,
    color: color.text3,
  },
  ratingPill: {
    minWidth: 46,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingHidden: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: line.card,
  },
  ratingText: {
    fontFamily: font.displayBlack,
    fontSize: 19,
    color: '#08160D',
    fontVariant: ['tabular-nums'],
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    marginVertical: space.s3,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: line.card },
  dividerText: { ...text.key, fontSize: 9, color: color.text3 },

  doneWrap: { flex: 1, justifyContent: 'center', gap: space.s5, paddingBottom: space.s6 },
  done: { alignItems: 'center', gap: space.s2 },
  doneTitle: {
    fontFamily: font.displayBlack,
    fontSize: 30,
    lineHeight: 34,
    color: color.text1,
  },
  doneMeta: { textAlign: 'center' },

  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.surfaceModal,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space.s5,
    paddingBottom: space.s8,
    gap: space.s2,
  },
  sheetTitle: {
    fontFamily: font.displayBold,
    fontSize: 21,
    lineHeight: 24,
    color: color.text1,
    marginBottom: space.s2,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: color.surface2,
  },
  sheetRowText: { fontFamily: font.bodySemi, fontSize: 15, color: color.text1 },
  sheetCancel: { marginTop: space.s3 },
});
