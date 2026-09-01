import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Modal,
  StyleSheet,
  type ListRenderItemInfo,
} from 'react-native';
import { router } from 'expo-router';
import { ModeScreen, Button, Press, Pitch, surname } from '../../src/ui/components';
import { color, space, radius, positionColor, gradient, shadow, line } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic, useReduceMotion } from '../../src/ui/feel';
import {
  AT20_CLUBS,
  POSITION_LABEL,
  canPlay,
  chemBonus,
  slotsForPlayer,
  squadAvg,
  squadChem,
  visibleBoard,
  type Pick,
} from '../../src/engine';
import {
  doSpin,
  pickPlayer,
  settleSpin,
  spendReroll,
  useRun,
} from '../../src/game/run';

const ROW_HEIGHT = 62;

export default function DraftBoard() {
  const run = useRun();
  const reduceMotion = useReduceMotion();
  const [reel, setReel] = useState<string | null>(null);
  const [chooser, setChooser] = useState<{ player: Pick; slots: number[] } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  // A run only exists while the draft is in flight. Coming back to this
  // screen without one means the stack was restored from a cold start, so
  // send them back rather than drawing a screen with nothing behind it.
  useEffect(() => {
    if (!run) router.replace('/draft');
  }, [run]);

  const onSpin = useCallback(() => {
    const result = doSpin();
    if (!result) return;
    haptic('medium');

    if (reduceMotion) {
      settleSpin(result);
      return;
    }

    // A short reel of club names. It is only there to make the landing feel
    // earned; the club was already decided before the first frame.
    let ticks = 0;
    timer.current = setInterval(() => {
      ticks++;
      setReel(AT20_CLUBS[Math.floor(Math.random() * AT20_CLUBS.length)]);
      if (ticks >= 11) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setReel(null);
        settleSpin(result);
        haptic('success');
      }
    }, 55);
  }, [reduceMotion]);

  const onPick = useCallback(
    (player: Pick) => {
      if (!run) return;
      const slots = slotsForPlayer(run.state, player);
      if (!slots.length) {
        haptic('warning');
        return;
      }
      if (slots.length === 1) {
        haptic('success');
        pickPlayer(player, slots[0]);
        return;
      }
      haptic('light');
      setChooser({ player, slots });
    },
    [run],
  );

  if (!run) return null;

  const { state, board, club, season, spinning } = run;
  const left = state.total - state.filled;
  const complete = state.filled === state.total;
  const avg = squadAvg(state.squad);
  const shown = board ? visibleBoard(board, state.config.blitz) : [];
  const rerollsLeft = state.rerollsMax - state.rerolls;

  const renderRow = ({ item }: ListRenderItemInfo<Pick>) => {
    const playable = canPlay(state, item);
    const pos = item.pos[0];
    const tint = positionColor[pos as keyof typeof positionColor] ?? color.text3;
    return (
      <Press
        onPress={() => onPick(item)}
        feel="none"
        scaleTo={0.98}
        disabled={!playable}
        style={[styles.player, !playable && styles.playerOff]}
        accessibilityLabel={`${item.n}, rated ${item.rtg}, ${POSITION_LABEL[pos as 'GK'] ?? pos}`}
      >
        <View style={[styles.posBadge, { backgroundColor: tint + '28', borderColor: tint + '55' }]}>
          <Text style={[styles.posText, { color: tint }]}>{pos}</Text>
        </View>
        <View style={styles.playerBody}>
          <Text style={styles.playerName} numberOfLines={1}>
            {item.n}
          </Text>
          <Text style={styles.playerMeta} numberOfLines={1}>
            {item.nat}
            {item.pos.length > 1 ? ' · ' + item.pos.join('/') : ''}
          </Text>
        </View>
        <Text style={[styles.rating, playable && item.rtg >= 90 && styles.ratingGold]}>
          {item.rtg}
        </Text>
      </Press>
    );
  };

  return (
    <ModeScreen
      overline={complete ? 'Draft complete' : `${left} to fill`}
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
      />

      {complete ? (
        <View style={styles.done}>
          <Text style={[text.heading, styles.doneTitle]}>Your XI is ready</Text>
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
      ) : board ? (
        <>
          <View style={styles.boardHead}>
            <View style={styles.boardWho}>
              <Text style={styles.boardClub} numberOfLines={1}>
                {club}
              </Text>
              <Text style={styles.boardSeason}>{season}</Text>
            </View>
            {rerollsLeft > 0 ? (
              <Press
                onPress={() => {
                  if (spendReroll()) haptic('warning');
                }}
                feel="none"
                scaleTo={0.94}
                style={styles.reroll}
              >
                <Text style={styles.rerollText}>
                  Reroll · {rerollsLeft}
                </Text>
              </Press>
            ) : null}
          </View>

          <FlatList
            data={shown}
            keyExtractor={(p) => p.n + p.club + p.season}
            renderItem={renderRow}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
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
                Nobody left from this squad who fits. Spin again.
              </Text>
            }
          />
        </>
      ) : (
        <View style={styles.spinWrap}>
          <Text style={styles.reelText} numberOfLines={1}>
            {reel ?? (spinning ? '' : 'Spin for a club')}
          </Text>
          <Button
            label={spinning ? 'Spinning' : 'Spin'}
            onPress={onSpin}
            style={styles.spinBtn}
          />
        </View>
      )}

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
          <Text style={[text.heading, styles.sheetTitle]}>
            Where does {chooser ? surname(chooser.player.n) : ''} play?
          </Text>
          {chooser?.slots.map((si) => {
            const pos = run.state.squad[si].pos;
            const tint = positionColor[pos];
            return (
              <Press
                key={si}
                onPress={() => {
                  haptic('success');
                  pickPlayer(chooser.player, si);
                  setChooser(null);
                }}
                feel="none"
                style={[styles.sheetRow, { borderColor: tint + '55' }]}
              >
                <View style={[styles.posBadge, { backgroundColor: tint + '28', borderColor: tint + '55' }]}>
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
    </ModeScreen>
  );
}

const styles = StyleSheet.create({
  avgChip: {
    minWidth: 40,
    paddingHorizontal: space.s2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: color.accentWeak,
    alignItems: 'center',
  },
  avgValue: {
    fontFamily: font.displayBold,
    fontSize: 16,
    color: color.accent,
    fontVariant: ['tabular-nums'],
  },

  spinWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s5 },
  reelText: {
    fontFamily: font.displayBlack,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: 0.4,
    color: color.text1,
    minHeight: 42,
    textAlign: 'center',
  },
  spinBtn: { alignSelf: 'stretch' },

  boardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s3,
    marginTop: space.s4,
    marginBottom: space.s2,
  },
  boardWho: { flex: 1, minWidth: 0 },
  boardClub: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 27,
    letterSpacing: 0.3,
    color: color.text1,
  },
  boardSeason: { ...text.key, color: color.accent, marginTop: 1 },
  reroll: {
    paddingHorizontal: space.s4,
    paddingVertical: space.s2 + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: line.cardHot,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.cardLift,
    boxShadow: shadow.card,
  },
  rerollText: { ...text.key, color: color.text2 },

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
  playerOff: { opacity: 0.34 },
  posBadge: {
    width: 34,
    height: 34,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posText: { ...text.key, fontSize: 11 },
  playerBody: { flex: 1, minWidth: 0 },
  playerName: {
    fontFamily: font.bodySemi,
    fontSize: 15,
    lineHeight: 19,
    color: color.text1,
  },
  playerMeta: {
    fontFamily: font.body,
    fontSize: 11.5,
    lineHeight: 15,
    color: color.text3,
  },
  rating: {
    fontFamily: font.displayBold,
    fontSize: 22,
    color: color.text1,
    fontVariant: ['tabular-nums'],
    minWidth: 30,
    textAlign: 'right',
  },
  ratingGold: { color: color.gold },

  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s2 },
  doneTitle: { fontSize: 26, lineHeight: 30 },
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
  sheetTitle: { marginBottom: space.s2 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: color.surface2,
  },
  sheetRowText: {
    fontFamily: font.bodySemi,
    fontSize: 15,
    color: color.text1,
  },
  sheetCancel: { marginTop: space.s3 },
});
