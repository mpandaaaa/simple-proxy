import { View, Text, StyleSheet } from 'react-native';
import { color, radius, space, positionColor } from '../tokens';
import { font, text } from '../type';
import { FORMATIONS } from '../../engine';
import type { Slot } from '../../engine';

/**
 * The XI as a shape rather than as a list.
 *
 * Drawn back to front the way a formation is written but rendered top to
 * bottom the way a pitch is watched, so the attack is at the top of the
 * screen. Empty slots keep their position colour at low opacity, which is
 * what makes it obvious at a glance which line still needs filling.
 */
export function Pitch({
  squad,
  formation,
  highlight,
}: {
  squad: Slot[];
  formation: string;
  /** slot indexes a player being placed could go into */
  highlight?: number[];
}) {
  const fm = FORMATIONS[formation];
  if (!fm) return null;

  const rows: number[][] = [];
  let i = 0;
  for (const row of fm.rows) {
    const indexes: number[] = [];
    for (let c = 0; c < row.length; c++) indexes.push(i++);
    rows.push(indexes);
  }

  return (
    <View style={styles.pitch}>
      <View style={styles.halfway} />
      {rows
        .slice()
        .reverse()
        .map((indexes, r) => (
          <View key={r} style={styles.row}>
            {indexes.map((si) => {
              const slot = squad[si];
              const on = positionColor[slot.pos];
              const filled = !!slot.player;
              const lit = highlight?.includes(si);
              return (
                <View
                  key={si}
                  style={[
                    styles.slot,
                    { borderColor: filled ? on : on + '44' },
                    filled && { backgroundColor: on + '1f' },
                    lit && styles.lit,
                  ]}
                >
                  {filled ? (
                    <>
                      <Text style={[styles.rating, { color: on }]}>
                        {slot.player!.rtg}
                      </Text>
                      <Text style={styles.name} numberOfLines={1}>
                        {surname(slot.player!.n)}
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.empty, { color: on + 'aa' }]}>
                      {slot.pos}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
    </View>
  );
}

/** Enough of a name to recognise a player in a 60 point wide box. */
export function surname(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : full;
}

const styles = StyleSheet.create({
  pitch: {
    backgroundColor: color.surface1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    borderTopColor: color.topHighlight,
    paddingVertical: space.s3,
    paddingHorizontal: space.s2,
    gap: space.s2,
    overflow: 'hidden',
  },
  halfway: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.s2,
  },
  slot: {
    flex: 1,
    maxWidth: 74,
    minHeight: 42,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  lit: { borderWidth: 2, backgroundColor: color.accentWeak },
  rating: {
    fontFamily: font.displayBold,
    fontSize: 16,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  name: {
    fontFamily: font.bodyMed,
    fontSize: 9.5,
    lineHeight: 12,
    color: color.text2,
  },
  empty: {
    ...text.key,
    fontSize: 11,
  },
});
