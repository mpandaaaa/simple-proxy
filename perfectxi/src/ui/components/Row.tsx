import { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { color, radius, space, hit } from '../tokens';
import { text } from '../type';
import { IconChevron } from '../icons';
import { Press } from './Press';

export type RowTone = 'accent' | 'gold' | 'blue' | 'danger' | 'purple' | 'neutral';

const TONES: Record<RowTone, { fg: string; bg: string }> = {
  accent: { fg: color.accent, bg: 'rgba(31,197,126,0.13)' },
  gold: { fg: color.gold, bg: 'rgba(214,178,94,0.13)' },
  blue: { fg: color.blue, bg: 'rgba(76,160,255,0.13)' },
  danger: { fg: color.danger, bg: 'rgba(229,72,77,0.13)' },
  purple: { fg: color.purple, bg: 'rgba(185,140,242,0.13)' },
  neutral: { fg: color.text2, bg: color.surface3 },
};

/**
 * The one row shape the whole app uses for "go somewhere": an icon on the
 * left, a title with an optional key beside it, one line of subtitle, and
 * a chevron. Every mode entry is one of these, so the home screen reads as
 * a single list rather than a pile of differently shaped cards.
 *
 * The subtitle is locked to one line. These lines carry live save data,
 * and a status that grows to two lines would jog every row below it.
 */
export function Row({
  icon,
  title,
  subtitle,
  tag,
  tone = 'neutral',
  onPress,
}: {
  icon: (props: { color: string; size?: number }) => ReactNode;
  title: string;
  subtitle: string;
  tag?: string;
  tone?: RowTone;
  onPress?: () => void;
}) {
  const t = TONES[tone];
  return (
    <Press
      onPress={onPress}
      feel="light"
      style={styles.row}
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <View style={[styles.badge, { backgroundColor: t.bg }]}>
        {icon({ color: t.fg, size: 20 })}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[text.heading, styles.title]} numberOfLines={1}>
            {title}
          </Text>
          {tag ? (
            <View style={[styles.tag, { backgroundColor: t.bg }]}>
              <Text style={[text.key, { color: t.fg }]}>{tag}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[text.small, styles.sub]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <IconChevron color={color.text3} size={17} />
    </Press>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: hit.button + space.s3,
    backgroundColor: color.surface1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    borderTopColor: color.topHighlight,
    paddingVertical: space.s3,
    paddingHorizontal: space.s4,
    marginBottom: space.s2,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  title: { flexShrink: 1, fontSize: 18, lineHeight: 21 },
  tag: {
    paddingHorizontal: space.s2,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  sub: { marginTop: 1 },
});
