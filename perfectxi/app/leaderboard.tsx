import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ModeScreen, Press, Rise } from '../src/ui/components';
import { back } from '../src/game/nav';
import { alpha, color, hue, line, radius, space } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { haptic } from '../src/ui/feel';
import { me } from '../src/save';
import { ONLINE_CONFIGURED } from '../src/net/client';
import { fetchBoard, type BoardRow } from '../src/net/leaderboard';

/**
 * How everybody did on one puzzle.
 *
 * Everything on this board was checked before it was written. The server
 * replays each run with the same engine that played it and works out the
 * score itself, so no row here is a number somebody typed. That is worth
 * saying on the screen, because a leaderboard nobody trusts is worse
 * than no leaderboard: it is a wall of strangers claiming things.
 *
 * The board is never required. The Daily is played, scored and kept on
 * the phone whatever the network is doing, and this page is somewhere to
 * look afterwards. Every state it can be in says plainly what happened,
 * because a spinner that never stops is the worst answer of the lot.
 */
export default function Leaderboard() {
  const { board, title } = useLocalSearchParams<{ board?: string; title?: string }>();
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'offline'>('loading');

  const load = useCallback(async () => {
    if (!board || !ONLINE_CONFIGURED) {
      setState('offline');
      return;
    }
    setState('loading');
    const got = await fetchBoard(board, me().id);
    if (got === null) {
      setState('offline');
      return;
    }
    setRows(got);
    setState('ready');
  }, [board]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ModeScreen
      wide
      overline="Everyone who played"
      title={title || 'Leaderboard'}
      onBack={() => back()}
    >
      <Rise delay={0}>
        <View style={styles.note}>
          <Text style={styles.noteText}>
            Every run here was replayed on the server before it was
            counted. Nothing on this board is a score somebody typed.
          </Text>
        </View>
      </Rise>

      {state === 'loading' ? (
        <View style={styles.middle}>
          <ActivityIndicator color={hue.emerald} />
        </View>
      ) : null}

      {state === 'offline' ? (
        <View style={styles.middle}>
          <Text style={styles.emptyKey}>No connection</Text>
          <Text style={styles.emptyText}>
            The board needs the internet. Your season is saved on this
            phone either way.
          </Text>
          <Press
            onPress={() => {
              haptic('light');
              void load();
            }}
            feel="none"
            scaleTo={0.96}
            style={styles.retry}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Press>
        </View>
      ) : null}

      {state === 'ready' && rows && rows.length === 0 ? (
        <View style={styles.middle}>
          <Text style={styles.emptyKey}>Nobody yet</Text>
          <Text style={styles.emptyText}>
            Nobody has finished this one. Play it and you are top.
          </Text>
        </View>
      ) : null}

      {state === 'ready' && rows && rows.length > 0 ? (
        <>
          <View style={styles.head}>
            <Text style={[styles.headCell, styles.colPos]}>#</Text>
            <Text style={[styles.headCell, styles.colName]}>Manager</Text>
            <Text style={[styles.headCell, styles.colNum]}>Rtg</Text>
            <Text style={[styles.headCell, styles.colNum]}>GD</Text>
            <Text style={[styles.headCell, styles.colNum]}>Pts</Text>
          </View>

          {rows.map((r, i) => (
            <View
              key={`${r.handle}-${i}`}
              style={[styles.row, r.you && styles.rowYou]}
            >
              <Text style={[styles.pos, styles.colPos, r.you && styles.youText]}>
                {i + 1}
              </Text>
              <Text
                style={[styles.name, styles.colName, r.you && styles.youText]}
                numberOfLines={1}
              >
                {r.handle}
                {r.you ? ' · you' : ''}
              </Text>
              <Text style={[styles.num, styles.colNum]}>{r.rating}</Text>
              <Text style={[styles.num, styles.colNum]}>
                {r.gf - r.ga > 0 ? '+' : ''}
                {r.gf - r.ga}
              </Text>
              <Text style={[styles.pts, styles.colNum, r.you && styles.youText]}>
                {r.pts}
              </Text>
            </View>
          ))}

          <Text style={styles.foot}>
            {rows.length === 50
              ? 'The top fifty'
              : `${rows.length} ${rows.length === 1 ? 'manager' : 'managers'}`}
          </Text>
        </>
      ) : null}
    </ModeScreen>
  );
}

const styles = StyleSheet.create({
  note: {
    padding: space.s3,
    marginBottom: space.s4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.emerald, 0.32),
    backgroundColor: alpha(hue.emerald, 0.07),
  },
  noteText: { ...text.small, fontSize: 12.5, lineHeight: 18, color: color.text2 },

  middle: { alignItems: 'center', paddingVertical: space.s7, gap: space.s2 },
  emptyKey: { ...text.label, fontSize: 13, color: color.text2 },
  emptyText: {
    ...text.small,
    fontSize: 13,
    lineHeight: 19,
    color: color.text3,
    textAlign: 'center',
    maxWidth: 300,
  },
  retry: {
    marginTop: space.s3,
    paddingHorizontal: space.s4,
    paddingVertical: space.s2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.emerald, 0.4),
  },
  retryText: { ...text.button, fontSize: 14, color: hue.emerald },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingBottom: space.s2,
    borderBottomWidth: 1,
    borderBottomColor: line.card,
  },
  headCell: { ...text.key, fontSize: 9.5, color: color.text3 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingVertical: space.s3,
    borderBottomWidth: 1,
    borderBottomColor: line.card,
  },
  rowYou: {
    backgroundColor: alpha(hue.emerald, 0.09),
    borderBottomColor: alpha(hue.emerald, 0.28),
  },

  /* one set of widths, used by the head and every row, so they line up */
  colPos: { width: 30, textAlign: 'right' },
  colName: { flex: 1, minWidth: 0 },
  colNum: { width: 44, textAlign: 'right' },

  pos: {
    fontFamily: font.displayBold,
    fontSize: 15,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  name: { ...text.small, fontSize: 14, color: color.text1 },
  num: {
    ...text.small,
    fontSize: 13,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  pts: {
    fontFamily: font.displayBold,
    fontSize: 16,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  youText: { color: hue.emerald },

  foot: {
    ...text.small,
    fontSize: 12,
    color: color.text3,
    textAlign: 'center',
    marginTop: space.s4,
  },
});
