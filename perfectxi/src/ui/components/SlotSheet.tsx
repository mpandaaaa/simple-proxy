import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native';
import { Sheet } from './Sheet';
import { Press } from './Press';
import { color, hue, line, positionColor, radius, space, alpha } from '../tokens';
import { font, text } from '../type';
import { canFill, placeName, posFit, type Position } from '../../engine';

/**
 * Which place he fills.
 *
 * Every empty place listed, with what it would cost him to play there.
 * Out of position is allowed, because sometimes it is the only option,
 * and the price is shown rather than hidden.
 *
 * Shared, because signing a player and promoting one out of the academy
 * are the same question asked twice and they should not answer it in two
 * different shapes.
 */
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
  const open2 = holes.filter((h) => h.index >= 11 || canFill(playerPos, h.pos));

  return (
    <Sheet visible={open} onClose={onClose}>
      <Text style={styles.sheetTitle}>{title}</Text>
      <Text style={styles.sheetSub}>{subtitle}</Text>

      {open2.length ? (
        <>
          <Text style={styles.sheetKey}>Where does he play?</Text>
          <View style={styles.slots}>
            {[...open2]
              .sort((a, b) => posFit(playerPos, b.pos) - posFit(playerPos, a.pos))
              .map((h) => {
                // A place on the bench costs a player nothing, whoever he is.
                const fit = h.index >= 11 ? 1 : posFit(playerPos, h.pos);
                const tint = h.index >= 11 ? positionColor[playerPos] : positionColor[h.pos];
                return (
                  <Press
                    key={h.index}
                    onPress={() => onPick(h.index)}
                    feel="medium"
                    scaleTo={0.98}
                    style={[
                      styles.slot,
                      {
                        borderColor: alpha(tint, fit === 1 ? 0.45 : 0.22),
                        backgroundColor: alpha(tint, fit === 1 ? 0.11 : 0.05),
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
                        {h.index >= 11 ? 'SUB' : h.pos}
                      </Text>
                    </View>
                    <View style={styles.slotBody}>
                      <Text style={styles.slotWhere}>
                        {h.index < 11 ? `In the eleven, ${placeName(h.pos)}` : 'On the bench, any position'}
                      </Text>
                      <Text
                        style={[
                          styles.slotFit,
                          {
                            color:
                              fit === 1 ? hue.emerald : fit >= 0.94 ? hue.amber : hue.crimson,
                          },
                        ]}
                      >
                        {h.index >= 11
                          ? 'Nothing lost, he is a substitute'
                          : fit === 1
                            ? 'His own position'
                            : `${Math.round((1 - fit) * 100)}% off his best`}
                      </Text>
                    </View>
                    <Text style={styles.slotArrow} allowFontScaling={false}>
                      {'\u203a'}
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
    borderColor: line.card,
  },
  badge: {
    width: 36,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...text.key, fontSize: 8.5 },
  slotBody: { flex: 1, minWidth: 0 },
  slotWhere: { fontFamily: font.bodySemi, fontSize: 14, lineHeight: 19, color: color.text1 },
  slotFit: { fontFamily: font.body, fontSize: 11, lineHeight: 15 },
  slotArrow: { fontSize: 18, color: color.text3 },
});
