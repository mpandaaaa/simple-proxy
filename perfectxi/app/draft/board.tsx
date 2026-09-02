import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Modal,
  StyleSheet,
  type ListRenderItemInfo,
} from 'react-native';
import { router } from 'expo-router';
import {
  ModeScreen,
  Button,
  Press,
  Pitch,
  PlayerCard,
  SpinReel,
  EraCard,
} from '../../src/ui/components';
import {
  color,
  space,
  radius,
  positionColor,
  gradient,
  shadow,
  line,
} from '../../src/ui/tokens';
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

const ROW_HEIGHT = 66;

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

  // A run only exists while the draft is in flight. Coming back here without
  // one means the stack was restored from a cold start, so go back rather
  // than draw a screen with nothing behind it.
  useEffect(() => {
    if (!run) router.replace('/draft');
  }, [run]);

  // The club is decided before the reel draws a single frame. The spin is
  // how the result is shown, never how it is chosen, so a seeded run still
  // replays exactly.
  const onSpin = useCallback(() => {
    const result = doSpin();
    if (!result) return;
    haptic('medium');
    setPending(result);
  }, []);

  const onSettled = useCallback(() => {
    setPending((p) => {
      if (p) settleSpin(p);
      return null;
    });
  }, []);

  /** Place the player, then give the pick the reveal it has earned. */
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

  if (!run) return null;

  const { state, board, club, season } = run;
  const left = state.total - state.filled;
  const complete = state.filled === state.total;
  const avg = squadAvg(state.squad);
  const shown = board ? visibleBoard(board, state.config.blitz) : [];
  const rerollsLeft = state.rerollsMax - state.rerolls;
  const hideRatings = state.config.diff === 'hard';
  const boardAvg = shown.length
    ? Math.round(shown.reduce((n, p) => n + p.rtg, 0) / shown.length)
    : 0;

  const renderRow = ({ item }: ListRenderItemInfo<Pick>) => {
    const playable = canPlay(state, item);
    const pos = item.pos[0] as Position;
    const tint = positionColor[pos] ?? color.text3;
    const rt = ratingTint(item.rtg);
    return (
      <Press
        onPress={() => onPick(item)}
        feel="none"
        scaleTo={0.975}
        disabled={!playable}
        style={[styles.player, !playable && styles.playerOff]}
        accessibilityLabel={`${item.n}, rated ${item.rtg}, ${POSITION_LABEL[pos] ?? pos}`}
      >
        <View
          style={[
            styles.posBadge,
            { backgroundColor: tint + '24', borderColor: tint + '66' },
          ]}
        >
          <Text style={[styles.posText, { color: tint }]}>{pos}</Text>
        </View>

        <View style={styles.playerBody}>
          <Text style={styles.playerName} numberOfLines={1}>
            {item.n}
          </Text>
          <Text style={styles.playerMeta} numberOfLines={1}>
            {item.nat} · {item.club} {item.season}
          </Text>
        </View>

        <View
          style={[
            styles.ratingBadge,
            hideRatings
              ? styles.ratingHidden
              : { backgroundColor: rt + '1f', borderColor: rt + '77' },
          ]}
        >
          <Text style={[styles.ratingText, { color: hideRatings ? color.text3 : rt }]}>
            {hideRatings ? '?' : item.rtg}
          </Text>
        </View>
      </Press>
    );
  };

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
      <Pitch
        squad={state.squad}
        formation={state.config.formation}
        highlight={chooser?.slots}
        compact={!complete}
      />

      {complete ? (
        <View style={styles.done}>
          <Text style={styles.doneTitle}>Your XI is ready</Text>
          <Text style={[text.small, styles.doneMeta]}>
            Average {Math.round(avg)} · chemistry {squadChem(state.squad)}% · worth +
            {chemBonus(state.squad).toFixed(2)}
          </Text>
          <Button
            label="Simulate the season"
            style={styles.doneBtn}
            onPress={() => router.push('/draft/season')}
          />
        </View>
      ) : (
        <>
          {/* The reel only exists while there is a spin to show. Once the
              board has landed the era card carries the club instead. */}
          {!board ? (
            <View style={styles.reelWrap}>
              <SpinReel
                target={pending ? { club: pending.club, season: pending.season } : null}
                pool={pool}
                onSettled={onSettled}
              />
            </View>
          ) : null}

          <View style={styles.eraWrap}>
            <EraCard
              pick={state.filled + 1}
              total={state.total}
              club={board ? club : null}
              season={board ? season : null}
              strength={boardAvg}
            />
          </View>

          {board ? (
            <>
              <View style={styles.listHead}>
                <Text style={styles.listTitle}>Pick a player</Text>
                <View style={styles.listRight}>
                  {rerollsLeft > 0 ? (
                    <Press
                      onPress={() => {
                        if (spendReroll()) haptic('warning');
                      }}
                      feel="none"
                      scaleTo={0.93}
                      style={styles.reroll}
                    >
                      <Text style={styles.rerollText}>Reroll</Text>
                      <View style={styles.dots}>
                        {Array.from({ length: state.rerollsMax }).map((_, i) => (
                          <View
                            key={i}
                            style={[styles.dot, i >= rerollsLeft && styles.dotUsed]}
                          />
                        ))}
                      </View>
                    </Press>
                  ) : null}
                  <Text style={styles.listCount}>{shown.length} in squad</Text>
                </View>
              </View>

              <FlatList
                data={shown}
                keyExtractor={(p) => p.n + p.club + p.season}
                renderItem={renderRow}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
                initialNumToRender={12}
                windowSize={9}
                removeClippedSubviews
                getItemLayout={(_, index) => ({
                  length: ROW_HEIGHT,
                  offset: ROW_HEIGHT * index,
                  index,
                })}
                ListEmptyComponent={
                  <Text style={[text.small, styles.emptyBoard]}>
                    No players left from this squad. Spin again.
                  </Text>
                }
              />
            </>
          ) : (
            <Button
              label={pending ? 'Spinning' : 'Spin'}
              onPress={onSpin}
              style={styles.spinBtn}
            />
          )}
        </>
      )}

      {/* Asked only when a player could fill more than one open slot */}
      <Modal
        visible={!!chooser}
        transparent
        animationType={reduceMotion ? 'fade' : 'slide'}
        onRequestClose={() => setChooser(null)}
      >
        <Press
          onPress={() => setChooser(null)}
          feel="none"
          scaleTo={1}
          style={styles.backdrop}
        >
          <View />
        </Press>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>
            Where does {chooser ? lastName(chooser.player.n) : ''} play?
          </Text>
          {chooser?.slots.map((si) => {
            const pos = run.state.squad[si].pos;
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
                  style={[
                    styles.posBadge,
                    { backgroundColor: tint + '24', borderColor: tint + '66' },
                  ]}
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

/** Gold for the ones worth shouting about, green for the rest. */
function ratingTint(rtg: number): string {
  if (rtg >= 88) return color.gold;
  if (rtg >= 78) return color.accent;
  return color.text2;
}

const styles = StyleSheet.create({
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

  reelWrap: { marginTop: space.s3 },
  eraWrap: { marginTop: space.s3 },
  spinBtn: { marginTop: space.s4, marginBottom: space.s4 },

  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.s4,
    marginBottom: space.s2,
  },
  listTitle: { ...text.label, color: color.accent, fontSize: 12.5 },
  listRight: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  listCount: { ...text.key, fontSize: 10.5, color: color.text3 },
  reroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingHorizontal: space.s3,
    paddingVertical: space.s1 + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: 'rgba(214,178,94,0.10)',
  },
  rerollText: { ...text.key, fontSize: 10, color: color.gold },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: color.gold },
  dotUsed: { backgroundColor: 'rgba(214,178,94,0.25)' },

  list: { flex: 1, marginHorizontal: -space.s1 },
  listContent: { paddingBottom: space.s5 },
  emptyBoard: { textAlign: 'center', paddingVertical: space.s6 },

  player: {
    height: ROW_HEIGHT - space.s2,
    marginBottom: space.s2,
    marginHorizontal: space.s1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingHorizontal: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow: shadow.card,
  },
  playerOff: { opacity: 0.32 },
  posBadge: {
    width: 40,
    height: 34,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posText: { ...text.key, fontSize: 10.5 },
  playerBody: { flex: 1, minWidth: 0 },
  playerName: {
    fontFamily: font.bodySemi,
    fontSize: 15.5,
    lineHeight: 20,
    color: color.text1,
  },
  playerMeta: {
    fontFamily: font.body,
    fontSize: 11.5,
    lineHeight: 15,
    color: color.text3,
  },
  ratingBadge: {
    minWidth: 44,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingHidden: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: line.card,
  },
  ratingText: {
    fontFamily: font.displayBlack,
    fontSize: 19,
    fontVariant: ['tabular-nums'],
  },

  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s2 },
  doneTitle: {
    fontFamily: font.displayBlack,
    fontSize: 30,
    lineHeight: 34,
    color: color.text1,
  },
  doneMeta: { textAlign: 'center' },
  doneBtn: { alignSelf: 'stretch', marginTop: space.s4 },

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
