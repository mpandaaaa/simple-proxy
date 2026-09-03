import { Text, View, StyleSheet } from 'react-native';
import { Sheet } from './Sheet';
import { Press } from './Press';
import { color, hue, positionColor, radius, space, alpha } from '../tokens';
import { font, text } from '../type';
import { canFill, placeName, posFit, type Position } from '../../engine';

/**
 * Which place he fills.
 *
 * Grouped by line, because that is the decision. A 4-3-3 with three
 * defenders missing used to list three identical rows saying "in the
 * eleven, in defence", then two identical rows for midfield, then three
 * identical benches: ten choices where there were only four. Whichever of
 * the three empty defensive shirts he takes, he is a defender.
 *
 * Out of position is allowed, because sometimes it is the only option, and
 * the price is shown rather than hidden. The bench takes anybody and costs
 * nobody anything.
 */

type Group = {
  key: string;
  /** the roster place he actually goes into */
  index: number;
  pos: Position;
  bench: boolean;
  places: number;
  fit: number;
};

export function SlotSheet({
  open,
  title,
  subtitle,
  holes,
  playerPos,
  onClose,
  onPick,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  holes: { index: number; pos: Position }[];
  playerPos: Position;
  onClose: () => void;
  onPick: (slot: number) => void;
}) {
  /* A keeper only goes in goal, and only a keeper goes in goal. Places he
     cannot fill are not shown at all rather than shown and refused. */
  const allowed = holes.filter((h) => h.index >= 11 || canFill(playerPos, h.pos));

  const groups: Group[] = [];
  for (const h of allowed) {
    const bench = h.index >= 11;
    const key = bench ? 'bench' : h.pos;
    const found = groups.find((g) => g.key === key);
    if (found) {
      found.places++;
      // Always offer the first of the identical shirts.
      found.index = Math.min(found.index, h.index);
      continue;
    }
    groups.push({
      key,
      index: h.index,
      pos: bench ? playerPos : h.pos,
      bench,
      places: 1,
      fit: bench ? 1 : posFit(playerPos, h.pos),
    });
  }

  /* His own position first, then whatever costs him least, and the bench
     last because it is not really a choice about football. */
  groups.sort((a, b) => Number(a.bench) - Number(b.bench) || b.fit - a.fit);

  return (
    <Sheet visible={open} onClose={onClose}>
      <Text style={styles.sheetTitle}>{title}</Text>
      <Text style={styles.sheetSub}>{subtitle}</Text>

      {groups.length ? (
        <>
          <Text style={styles.sheetKey}>Where does he play?</Text>
          <View style={styles.slots}>
            {groups.map((g) => {
              const tint = positionColor[g.pos];
              const perfect = !g.bench && g.fit === 1;
              return (
                <Press
                  key={g.key}
                  onPress={() => onPick(g.index)}
                  feel="medium"
                  scaleTo={0.98}
                  style={[
                    styles.slot,
                    {
                      borderColor: alpha(tint, perfect ? 0.45 : 0.22),
                      backgroundColor: alpha(tint, perfect ? 0.11 : 0.05),
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: alpha(tint, 0.16), borderColor: alpha(tint, 0.4) },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: tint }]}>
                      {g.bench ? 'SUB' : g.pos}
                    </Text>
                  </View>

                  <View style={styles.body}>
                    <Text style={styles.where}>
                      {g.bench
                        ? 'On the bench'
                        : `In the eleven, ${placeName(g.pos)}`}
                    </Text>
                    <Text
                      style={[
                        styles.fit,
                        {
                          color: g.bench
                            ? color.text3
                            : g.fit === 1
                              ? hue.emerald
                              : g.fit >= 0.94
                                ? hue.amber
                                : hue.crimson,
                        },
                      ]}
                    >
                      {g.bench
                        ? 'Any position, nothing lost'
                        : g.fit === 1
                          ? 'His own position'
                          : `${Math.round((1 - g.fit) * 100)}% off his best`}
                    </Text>
                  </View>

                  {g.places > 1 ? (
                    <Text style={styles.places} allowFontScaling={false}>
                      {g.places} open
                    </Text>
                  ) : null}
                  <Text style={styles.arrow} allowFontScaling={false}>
                    {'›'}
                  </Text>
                </Press>
              );
            })}
          </View>
        </>
      ) : (
        <Text style={styles.sheetNone}>
          {playerPos === 'GK'
            ? 'There is no place in goal for him. You already have a keeper.'
            : holes.length
              ? 'The only place open is in goal, and he is not a keeper.'
              : 'There is nowhere to put him. Sell somebody first.'}
        </Text>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheetTitle: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 30,
    color: color.text1,
  },
  sheetSub: { ...text.small, fontSize: 12.5, marginTop: 2 },
  sheetKey: {
    ...text.key,
    fontSize: 9,
    color: color.text3,
    marginTop: space.s4,
    marginBottom: space.s2,
  },
  sheetNone: { ...text.body, color: color.text2, marginTop: space.s4 },
  slots: { gap: space.s2, marginBottom: space.s3 },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  badge: {
    width: 38,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...text.key, fontSize: 8.5 },
  body: { flex: 1, minWidth: 0 },
  where: { fontFamily: font.bodySemi, fontSize: 15, lineHeight: 20, color: color.text1 },
  fit: { fontFamily: font.body, fontSize: 11.5, lineHeight: 16 },
  places: { ...text.key, fontSize: 8.5, color: color.text3 },
  arrow: { fontSize: 18, color: color.text3 },
});
