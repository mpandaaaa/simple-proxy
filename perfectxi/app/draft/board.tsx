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
import { ModeScreen, Button, Press, Pitch, PlayerCard } from '../../src/ui/components';
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
  AT20_CLUBS,
  POSITION_LABEL,
  canPlay,
  chemBonus,
  clubCode,
  clubColour,
  lastName,
  slotsForPlayer,
  squadAvg,
  squadChem,
  visibleBoard,
  type Pick,
  type Position,
} from '../../src/engine';
import { doSpin, pickPlayer, settleSpin, spendReroll, useRun } from '../../src/game/run';

const ROW_HEIGHT = 66;

export default function DraftBoard() {
  const run = useRun();
  const reduceMotion = useReduceMotion();
  const [reel, setReel] = useState<string | null>(null);
  const [chooser, setChooser] = useState<{ player: Pick; slots: number[] } | null>(null);
  const [reveal, setReveal] = useState<{ player: Pick; pos: Position } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  // A run only exists while the draft is in flight. Coming back here without
  // one means the stack was restored from a cold start, so go back rather
  // than draw a screen with nothing behind it.
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

  const { state, board, club, season, spinning } = run;
  const left = state.total - state.filled;
  const complete = state.filled === state.total;
  const avg = squadAvg(state.squad);
  const shown = board ? visibleBoard(board, state.config.blitz) : [];
  const rerollsLeft = state.rerollsMax - state.rerolls;
  const hideRatings = state.config.diff === 'hard';

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
          <Text
            style={[styles.ratingText, { color: hideRatings ? color.text3 : rt }]}
          >
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
      ) : board ? (
        <>
          <View style={styles.clubCard}>
            <View
              style={[
                styles.disc,
                {
                  backgroundColor: clubColour(club),
                  experimental_backgroundImage: `linear-gradient(145deg, ${clubColour(club)} 0%, rgba(0,0,0,0.55) 100%)`,
                },
              ]}
            >
              <Text style={styles.discText}>{clubCode(club)}</Text>
            </View>

            <View style={styles.clubBody}>
              <Text style={styles.pickLabel}>
                Pick {state.filled + 1} of {state.total}
              </Text>
              <Text style={styles.clubName} numberOfLines={1}>
                {club}
              </Text>
              <Text style={styles.clubSeason}>{season}</Text>
            </View>

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
          </View>

          <View style={styles.listHead}>
            <Text style={styles.listTitle}>Pick a player</Text>
            <Text style={styles.listCount}>{shown.length} in squad</Text>
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
                Nobody left from this squad who fits. Spin again.
              </Text>
            }
          />
        </>
      ) : (
        <View style={styles.spinWrap}>
          <Text style={styles.reelLabel}>
            {spinning ? 'Finding a club' : 'Next board'}
          </Text>
          <Text style={styles.reelText} numberOfLines={1} adjustsFontSizeToFit>
            {reel ?? (spinning ? '' : 'Spin for a club')}
          </Text>
          <Button label="Spin" onPress={onSpin} style={styles.spinBtn} />
        </View>
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

  spinWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s3 },
  reelLabel: { ...text.key, color: color.text3 },
  reelText: {
    fontFamily: font.displayBlack,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: 0.4,
    color: color.text1,
    minHeight: 42,
    textAlign: 'center',
  },
  spinBtn: { alignSelf: 'stretch', marginTop: space.s4 },

  clubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    marginTop: space.s4,
    marginBottom: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.cardLift,
    boxShadow: shadow.card,
  },
  disc: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discText: {
    fontFamily: font.displayBold,
    fontSize: 14,
    letterSpacing: 0.4,
    color: '#FFFFFF',
  },
  clubBody: { flex: 1, minWidth: 0 },
  pickLabel: { ...text.key, fontSize: 10, color: color.accent },
  clubName: {
    fontFamily: font.displayBlack,
    fontSize: 23,
    lineHeight: 26,
    letterSpacing: 0.3,
    color: color.text1,
    marginTop: 1,
  },
  clubSeason: { fontFamily: font.bodySemi, fontSize: 12, color: color.text3 },
  reroll: {
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: 'rgba(214,178,94,0.10)',
  },
  rerollText: { ...text.key, fontSize: 10, color: color.gold },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.gold },
  dotUsed: { backgroundColor: 'rgba(214,178,94,0.25)' },

  listHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.s2,
  },
  listTitle: { ...text.label, color: color.accent, fontSize: 12.5 },
  listCount: { ...text.key, fontSize: 10.5, color: color.text3 },

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
