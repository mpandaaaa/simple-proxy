import { View, Text, StyleSheet } from 'react-native';
import { color, radius, space } from '../tokens';
import { font, text } from '../type';
import { IconChevron } from '../icons';
import { Press } from './Press';
import { Shine } from './Shine';

/**
 * The one thing the home screen is asking you to do. It is the largest
 * element on the screen and the only solid accent block, so it is the
 * first thing the eye lands on and nothing else has to compete with it.
 */
export function Hero({
  kicker,
  title,
  subtitle,
  onPress,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
}) {
  return (
    <Press
      onPress={onPress}
      feel="medium"
      scaleTo={0.975}
      style={styles.hero}
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <Shine radius={radius.lg} group="feature" bevel={false} />

      <View style={styles.body}>
        <Text style={styles.kicker} numberOfLines={1}>
          {kicker}
        </Text>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {title}
        </Text>
        <Text style={styles.sub} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <IconChevron color="rgba(6,18,12,0.55)" size={20} />
    </Press>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    backgroundColor: color.accent,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.accentHi,
    paddingVertical: space.s4 + 2,
    paddingHorizontal: space.s5,
  },
  body: { flex: 1, minWidth: 0 },
  kicker: {
    ...text.key,
    color: 'rgba(6,18,12,0.62)',
  },
  title: {
    fontFamily: font.displayBlack,
    fontSize: 34,
    lineHeight: 41,
    letterSpacing: 0.4,
    color: '#06120C',
    marginTop: 2,
  },
  sub: {
    fontFamily: font.bodyMed,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(6,18,12,0.72)',
    marginTop: 3,
  },
});
