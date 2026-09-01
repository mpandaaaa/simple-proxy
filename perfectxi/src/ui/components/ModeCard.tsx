import { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { color, radius, space, gradient, shadow, line } from '../tokens';
import { font, text } from '../type';
import { IconChevron } from '../icons';
import { Press } from './Press';

export type ModeTone = 'accent' | 'gold' | 'purple';

const TONES = {
  accent: {
    grad: gradient.hero,
    solid: color.accent,
    border: color.accentHi,
    ink: '#06130C',
    dim: 'rgba(6, 19, 12, 0.72)',
    faint: 'rgba(6, 19, 12, 0.62)',
    ring: 'rgba(255, 255, 255, 0.10)',
    badge: 'rgba(6, 19, 12, 0.14)',
    badgeLine: 'rgba(6, 19, 12, 0.22)',
    shade: shadow.hero,
  },
  gold: {
    grad: gradient.gold,
    solid: '#141D15',
    border: line.gold,
    ink: color.text1,
    dim: color.text2,
    faint: color.gold,
    ring: 'rgba(214, 178, 94, 0.10)',
    badge: 'rgba(214, 178, 94, 0.13)',
    badgeLine: line.gold,
    shade: shadow.lift,
  },
  purple: {
    grad: gradient.purple,
    solid: '#14141F',
    border: line.purple,
    ink: color.text1,
    dim: color.text2,
    faint: color.purple,
    ring: 'rgba(185, 140, 242, 0.10)',
    badge: 'rgba(185, 140, 242, 0.13)',
    badgeLine: line.purple,
    shade: shadow.lift,
  },
} as const;

/**
 * One of the three modes the game is actually about: the draft, the World
 * Cup, and Dynasty. Everything else on the home screen is a row or lives
 * behind a disclosure, so these three carry the screen.
 *
 * The ring bleeding out of the top right corner is the web build's
 * signature and the reason its hero does not read as a rectangle. It is
 * decorative only, and it is clipped by the card rather than sized to it,
 * so it stays put whatever the card grows to.
 */
export function ModeCard({
  tone,
  kicker,
  title,
  subtitle,
  status,
  icon,
  big,
  onPress,
}: {
  tone: ModeTone;
  kicker: string;
  title: string;
  subtitle: string;
  /** live save data, shown instead of the subtitle when there is any */
  status?: string | null;
  icon?: (props: { color: string; size?: number }) => ReactNode;
  big?: boolean;
  onPress?: () => void;
}) {
  const t = TONES[tone];

  return (
    <Press
      onPress={onPress}
      feel="medium"
      scaleTo={big ? 0.975 : 0.98}
      style={[
        styles.card,
        {
          backgroundColor: t.solid,
          experimental_backgroundImage: t.grad,
          borderColor: t.border,
          boxShadow: t.shade,
        },
        big && styles.cardBig,
      ]}
      accessibilityLabel={`${title}. ${status ?? subtitle}`}
    >
      <View
        pointerEvents="none"
        style={[styles.ring, { borderColor: t.ring }]}
      />

      {icon ? (
        <View
          style={[
            styles.badge,
            { backgroundColor: t.badge, borderColor: t.badgeLine },
          ]}
        >
          {icon({ color: t.faint, size: 22 })}
        </View>
      ) : null}

      <View style={styles.body}>
        <Text style={[styles.kicker, { color: t.faint }]} numberOfLines={1}>
          {kicker}
        </Text>
        <Text
          style={[big ? styles.titleBig : styles.title, { color: t.ink }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {title}
        </Text>
        <Text style={[styles.sub, { color: t.dim }]} numberOfLines={2}>
          {status ?? subtitle}
        </Text>
      </View>

      <IconChevron color={t.faint} size={big ? 22 : 19} />
    </Press>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: space.s4,
    paddingHorizontal: space.s4,
    marginBottom: space.s3,
    overflow: 'hidden',
  },
  cardBig: {
    paddingVertical: space.s5 - 2,
    paddingHorizontal: space.s5 - 4,
  },
  ring: {
    position: 'absolute',
    right: -46,
    top: -46,
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 26,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  kicker: {
    ...text.key,
    fontSize: 10.5,
    letterSpacing: 1.8,
  },
  title: {
    fontFamily: font.displayBlack,
    fontSize: 23,
    lineHeight: 26,
    letterSpacing: 0.3,
    marginTop: 3,
  },
  titleBig: {
    fontFamily: font.displayBlack,
    fontSize: 34,
    lineHeight: 34,
    letterSpacing: 0.4,
    marginTop: 4,
  },
  sub: {
    fontFamily: font.bodyMed,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 4,
  },
});
