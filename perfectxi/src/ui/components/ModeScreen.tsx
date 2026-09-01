import { ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { color, space, radius } from '../tokens';
import { text } from '../type';
import { IconBack } from '../icons';
import { Press } from './Press';

const BAR = 54;

/**
 * Every screen that is not Home sits on this.
 *
 * Back is on the left and always goes back one step, which on a stack
 * rooted at Home means Home from a mode and the Dynasty hub from a
 * Dynasty section. The iOS edge swipe does the same thing for free
 * because this is a real native stack, so the gesture is not reimplemented
 * here and cannot drift out of step with the button.
 *
 * The bar is opaque and fixed. Content scrolls underneath it rather than
 * pushing it up, so the mode name stays readable the whole way down.
 */
export function ModeScreen({
  overline,
  title,
  right,
  children,
  scroll = true,
}: {
  overline: string;
  title: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + BAR;

  // A non scrolling screen has to pass its height down, or a child asking
  // for flex:1 (a list, a centred block) collapses to nothing.
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
        >
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingTop: headerHeight }}>{body}</View>
      )}

      <View style={[styles.bar, { paddingTop: insets.top, height: headerHeight }]}>
        <Press
          onPress={() => router.back()}
          feel="light"
          scaleTo={0.9}
          style={styles.back}
          accessibilityLabel="Back"
        >
          <IconBack color={color.text1} size={22} />
        </Press>

        <View style={styles.heading}>
          <Text style={text.key} numberOfLines={1}>
            {overline}
          </Text>
          <Text style={[text.heading, styles.title]} numberOfLines={1}>
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
    gap: space.s2,
    paddingHorizontal: space.s3,
    backgroundColor: color.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { flex: 1, minWidth: 0 },
  title: { fontSize: 19, lineHeight: 22, marginTop: -1 },
  right: { flexDirection: 'row', alignItems: 'center', minWidth: 44, justifyContent: 'flex-end' },
});
