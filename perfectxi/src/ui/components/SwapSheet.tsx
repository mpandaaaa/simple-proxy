import { Text, View, StyleSheet } from 'react-native';
import { Sheet } from './Sheet';
import { Press } from './Press';
import { color, hue, positionColor, radius, space, alpha } from '../tokens';
import { font, text } from '../type';
import { posFit, type DynastyPlayer, type Position } from '../../engine';

export type SwapOption = {
  index: number;
  player: DynastyPlayer;
  /** the place he is standing in now */
  slot: Position;
};

/**
 * Who does he come on for?
 *
 * A substitution is two decisions and the app used to only let you make
 * one: it picked the man coming off for you. Here you choose him, and
 * every option says what the change is worth so it is a decision rather
 * than a guess.
 */
export function SwapSheet({
  open,
  title,
  subtitle,
  incoming,
  incomingSlot,
  options,
  onClose,
  onPick,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  incoming: DynastyPlayer | null;
  /** the place the incoming player is standing in now */
  incomingSlot: Position;
  options: SwapOption[];
  onClose: () => void;
  onPick: (index: number) => void;
}) {
  return (
    <Sheet visible={open} onClose={onClose}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{subtitle}</Text>

      {options.length ? (
        <>
          <Text style={styles.key}>Who makes way?</Text>
          <View style={styles.list}>
            {options.map((o) => {
              const tint = positionColor[o.slot];
              /* What the eleven gains: the man coming on, at how well he
                 suits the place, less the man going off where he stands. */
              const gain = incoming
                ? Math.round(
                    incoming.rtg * posFit(incoming.pos, o.slot) -
                      o.player.rtg * posFit(o.player.pos, o.slot),
                  )
                : 0;
              return (
                <Press
                  key={o.index}
                  onPress={() => onPick(o.index)}
                  feel="medium"
                  scaleTo={0.98}
                  style={[
                    styles.row,
                    {
                      borderColor: alpha(tint, 0.24),
                      backgroundColor: alpha(tint, 0.05),
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: alpha(tint, 0.16), borderColor: alpha(tint, 0.4) },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: tint }]}>{o.slot}</Text>
                  </View>
                  <View style={styles.body}>
                    <Text style={styles.name} numberOfLines={1}>
                      {o.player.n}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {o.player.pos} {'\u00b7'} rated {o.player.rtg}
                      {o.player.daysOut >= 30 ? ` \u00b7 ${o.player.daysOut} days out` : ''}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.gain,
                      {
                        color: gain > 0 ? hue.emerald : gain < 0 ? hue.crimson : color.text3,
                      },
                    ]}
                    allowFontScaling={false}
                  >
                    {gain > 0 ? '+' : ''}
                    {gain}
                  </Text>
                </Press>
              );
            })}
          </View>
        </>
      ) : (
        <Text style={styles.none}>
          {incomingSlot === 'GK'
            ? 'There is nobody he can replace. A keeper only comes on for a keeper.'
            : 'There is nobody he can replace.'}
        </Text>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.displayBlack, fontSize: 24, lineHeight: 30, color: color.text1 },
  sub: { ...text.small, fontSize: 12.5, marginTop: 2 },
  key: {
    ...text.key,
    fontSize: 9,
    color: color.text3,
    marginTop: space.s4,
    marginBottom: space.s2,
  },
  none: { ...text.body, color: color.text2, marginTop: space.s4 },
  list: { gap: space.s2, marginBottom: space.s3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
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
  body: { flex: 1, minWidth: 0 },
  name: { fontFamily: font.bodySemi, fontSize: 15, lineHeight: 20, color: color.text1 },
  meta: { fontFamily: font.body, fontSize: 11, lineHeight: 15, color: color.text3 },
  gain: {
    fontFamily: font.displayBold,
    fontSize: 17,
    lineHeight: 21,
    fontVariant: ['tabular-nums'],
  },
});
