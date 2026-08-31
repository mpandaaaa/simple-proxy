import { Pressable, View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { color, radius, space } from '../tokens';
import { text } from '../type';
import { Pill, PillTone } from './Pill';
import { IconChevron } from '../icons';

/**
 * The tappable row used for a game mode or a menu entry.
 * Keyed rows carry a coloured word pill on the left, never a number.
 */
export function Tile({
  title,
  subtitle,
  tag,
  tone = 'neutral',
  onPress,
  soon,
}: {
  title: string;
  subtitle?: string;
  tag?: string;
  tone?: PillTone;
  onPress?: () => void;
  soon?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={styles.body}>
        {tag ? (
          <View style={styles.tagRow}>
            <Pill tone={tone}>{tag}</Pill>
            {soon ? <Pill tone="neutral">Not wired yet</Pill> : null}
          </View>
        ) : null}
        <Text style={[text.heading, styles.title]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={text.small} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <IconChevron color={color.text3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    backgroundColor: color.surface1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    borderTopColor: color.topHighlight,
    padding: space.s4,
    marginBottom: space.s2,
  },
  pressed: { backgroundColor: color.surface2, transform: [{ scale: 0.994 }] },
  body: { flex: 1, minWidth: 0, gap: space.s1 },
  tagRow: { flexDirection: 'row', gap: space.s2, marginBottom: space.s1 },
  title: { marginBottom: 0 },
});
