import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, hue, radius, space, alpha, positionColor } from '../tokens';
import { font, text } from '../type';
import { haptic } from '../feel';
import { landedBy, opponentDone, type Opponent } from '../../engine';

/**
 * The other one, along the top of the board.
 *
 * A live duel has to be felt while it is happening or it is not live, it
 * is two people comparing scores afterwards. So this ticks: their name,
 * how many of the eleven they have, and the last player they took, which
 * lands with a small knock so you notice it out of the corner of your eye
 * while you are looking at your own board.
 *
 * It owns its own clock on purpose. The board underneath is a long list
 * and a heavy screen, and redrawing all of it twice a second so a counter
 * can go up would make the draft feel worse than having no opponent at
 * all.
 */
export function OpponentStrip({
  opponent,
  startedAt,
  total,
  mine,
}: {
  opponent: Opponent;
  /** the wall clock moment the draft opened, or 0 before it has */
  startedAt: number;
  /** how many places there are to fill */
  total: number;
  /** how many you have filled */
  mine: number;
}) {
  const [elapsed, setElapsed] = useState(0);
  const knocked = useRef(0);

  useEffect(() => {
    if (!startedAt) return;
    setElapsed(Date.now() - startedAt);
    const t = setInterval(() => setElapsed(Date.now() - startedAt), 450);
    return () => clearInterval(t);
  }, [startedAt]);

  const done = startedAt ? landedBy(opponent, elapsed) : [];
  const last = done[done.length - 1] ?? null;
  const finished = startedAt ? opponentDone(opponent, elapsed) : false;

  /* One knock per pick they make, so a signing you did not see still
     registers. Guarded on a count rather than on the pick itself, because
     the same pick is the last one for several ticks. */
  useEffect(() => {
    if (done.length > knocked.current) {
      knocked.current = done.length;
      haptic('light');
    }
  }, [done.length]);

  const ahead = done.length - mine;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.who}>
          <View style={styles.dot} />
          <Text style={styles.name} numberOfLines={1}>
            {opponent.name}
          </Text>
          {opponent.bot ? <Text style={styles.bot}>THE MACHINE</Text> : null}
          <Text style={styles.live}>{finished ? 'DONE' : 'DRAFTING'}</Text>
        </View>
        <Text style={styles.count} allowFontScaling={false}>
          {done.length}
          <Text style={styles.countOf}> / {total}</Text>
        </Text>
      </View>

      {/* eleven pips, theirs on top of yours, so who is ahead reads in a
          glance rather than needing to be worked out */}
      <View style={styles.pips}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[
              styles.pip,
              i < done.length ? styles.pipThem : null,
              i < mine && i >= done.length ? styles.pipMe : null,
            ]}
          />
        ))}
      </View>

      <Text style={styles.line} numberOfLines={1}>
        {last ? (
          <>
            <Text style={{ color: positionColor[posOf(last.player.pos)] }}>
              {posOf(last.player.pos)}
            </Text>
            <Text>{`  ${last.player.n}`}</Text>
            <Text style={styles.club}>{`  ${last.player.club}`}</Text>
          </>
        ) : startedAt ? (
          'Looking at the first board.'
        ) : (
          'Waiting for you to start.'
        )}
      </Text>

      {done.length ? (
        <Text
          style={[
            styles.state,
            {
              color:
                ahead > 0 ? hue.crimson : ahead < 0 ? hue.emerald : color.text3,
            },
          ]}
        >
          {ahead > 0
            ? `${ahead} ahead of you`
            : ahead < 0
              ? `${-ahead} behind you`
              : 'Level with you'}
        </Text>
      ) : null}
    </View>
  );
}

function posOf(pos: string | string[]): 'GK' | 'DEF' | 'MID' | 'ATT' {
  const p = Array.isArray(pos) ? pos[0] : pos;
  return p === 'GK' || p === 'DEF' || p === 'MID' || p === 'ATT' ? p : 'MID';
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: space.s3,
    paddingVertical: space.s3,
    paddingHorizontal: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(hue.crimson, 0.3),
    backgroundColor: '#150C0E',
    experimental_backgroundImage:
      'linear-gradient(180deg, #221316 0%, #140C0E 70%, #0A0607 100%)',
    gap: 6,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: hue.crimson,
    boxShadow: '0px 0px 8px rgba(229,72,77,0.9)',
  },
  name: {
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 20,
    color: color.text1,
    flexShrink: 1,
  },
  live: { ...text.key, fontSize: 7.5, color: hue.crimson },
  bot: { ...text.key, fontSize: 7.5, color: color.text3 },
  count: {
    fontFamily: font.displayBlack,
    fontSize: 21,
    lineHeight: 26,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  countOf: { fontSize: 13, color: color.text3 },

  pips: { flexDirection: 'row', gap: 3, marginTop: 1 },
  pip: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  pipThem: { backgroundColor: hue.crimson },
  pipMe: { backgroundColor: alpha(hue.emerald, 0.5) },

  line: { ...text.small, fontSize: 12, lineHeight: 17, color: color.text2, marginTop: 2 },
  club: { color: color.text3 },
  state: { ...text.key, fontSize: 8 },
});
