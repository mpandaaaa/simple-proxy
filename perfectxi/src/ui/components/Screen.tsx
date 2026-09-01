import { ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, space, gap } from '../tokens';
import { text } from '../type';

/**
 * The plain scrolling page. Handles the notch and the home indicator.
 *
 * There is no bottom tab bar to leave room for: navigation is a stack
 * rooted at Home, and a mode screen fills the display on its own.
 */
export function Screen({
  children,
  contentTop = space.s4,
}: {
  children: ReactNode;
  contentTop?: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{
          paddingTop: insets.top + contentTop,
          paddingBottom: insets.bottom + space.s7,
          paddingHorizontal: space.s4,
        }}
        showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** A group separator. Real air between groups, a tight stack within one. */
export function Section({
  label,
  children,
  first,
}: {
  label?: string;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <View style={[styles.section, first && styles.sectionFirst]}>
      {label ? (
        <Text style={[text.label, styles.sectionLabel]}>{label}</Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  section: { marginTop: gap.group },
  sectionFirst: { marginTop: 0 },
  sectionLabel: { marginBottom: space.s2 },
});
