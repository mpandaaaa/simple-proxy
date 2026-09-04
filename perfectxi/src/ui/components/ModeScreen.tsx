import { ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { color, space, radius, line, gradient } from '../tokens';
import { font, text } from '../type';
import { IconBack } from '../icons';
import { Press } from './Press';

/**
 * Back, and home if there is no back.
 *
 * A screen can end up as the only route in the stack, and asking a stack
 * of one to go back throws GO_BACK straight into the player's face. Home
 * is the honest destination when there is nowhere to return to.
 */
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

const BAR = 56;
/**
 * How far the page dissolves under the bar rather than being cut by it.
 *
 * Short and quick. At 26pt starting from full opacity it was not softening
 * the edge, it was wiping out the first line of content: the chip values on
 * Squad Complete were nearly gone while their labels underneath survived.
 * The point is to take the hard line off, not to hide anything.
 */
const FALLOFF = 16;

/**
 * Every screen that is not Home sits on this.
 *
 * The bar is the one component the whole app shares, so it is worth more
 * than a chevron on a hairline. Three things make the difference:
 *
 * Back is a real button. A bare glyph is a small target and reads as
 * unfinished; this is the same material as every other card in the app,
 * with a press state and a haptic, on a 44 point target.
 *
 * The page dissolves under the bar instead of being cut by it. A hairline
 * with opaque black above it draws a hard line across the screen and makes
 * the content look clipped. A gradient falloff below the bar means content
 * fades out as it passes, which is what makes it read as one surface.
 *
 * The title block carries a hierarchy rather than two similar greys: a
 * small wide tracked overline for where you are, and the display face
 * underneath for what this screen is.
 *
 * Back always goes back one step, and the iOS edge swipe does the same
 * thing for free because this is a real native stack, so the gesture is
 * not reimplemented here and cannot drift out of step with the button.
 */
export function ModeScreen({
  overline,
  title,
  right,
  children,
  scroll = true,
  onBack,
}: {
  overline: string;
  title: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  /** override where back goes, for a screen that should not simply pop */
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + BAR;

  const body = (
    <View style={[styles.pad, !scroll && styles.padFill]}>{children}</View>
  );

  return (
    <View style={styles.root}>
      {scroll ? (
        <ScrollView
          style={styles.root}
          contentContainerStyle={{
            paddingTop: headerHeight + space.s4,
            paddingBottom: insets.bottom + space.s7,
          }}
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
        >
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingTop: headerHeight }}>{body}</View>
      )}

      {/* the page fading out under the bar rather than stopping at a line */}
      <View
        style={[styles.falloff, { top: headerHeight }]}
        pointerEvents="none"
      />

      <View style={[styles.bar, { paddingTop: insets.top, height: headerHeight }]}>
        <Press
          onPress={onBack ?? goBack}
          feel="light"
          scaleTo={0.9}
          style={styles.backHit}
          accessibilityLabel="Back"
        >
          <View style={styles.back}>
            <IconBack color={color.text1} size={20} />
          </View>
        </Press>

        <View style={styles.heading}>
          <Text style={styles.overline} numberOfLines={1}>
            {overline}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={styles.right}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  pad: { paddingHorizontal: space.s4 },
  padFill: { flex: 1 },

  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingHorizontal: space.s4,
    backgroundColor: color.bg,
  },
  /*
   * The falloff was almost opaque where it met the bar, which is fine
   * over a long page sliding past and much too heavy over anything that
   * sits still directly underneath: a row of tabs came out looking
   * greyed rather than softened. Half the strength does the job, because
   * the job is only to stop the bar cutting a hard line across the page.
   */
  falloff: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: FALLOFF,
    experimental_backgroundImage:
      'linear-gradient(180deg, rgba(10,15,12,0.42) 0%, rgba(10,15,12,0.1) 55%, rgba(10,15,12,0) 100%)',
  },

  // 44 point target around a 40 point face, so the button is easy to hit
  // without looking oversized.
  backHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -space.s1,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.cardLift,
    boxShadow:
      '0px 4px 12px rgba(0,0,0,0.4), inset 0px 1px 0px rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  heading: { flex: 1, minWidth: 0 },
  overline: {
    ...text.key,
    fontSize: 9.5,
    letterSpacing: 1.9,
    color: color.text3,
  },
  title: {
    fontFamily: font.displayBlack,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: 0.2,
    color: color.text1,
    marginTop: -1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
    justifyContent: 'flex-end',
  },
});
