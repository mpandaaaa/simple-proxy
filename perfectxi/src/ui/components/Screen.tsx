import { ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { READABLE, color, space, gap } from '../tokens';
import { useLayout } from '../layout';
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
  wide,
}: {
  children: ReactNode;
  contentTop?: number;
  /** grids and tables rather than prose: use the room on a tablet */
  wide?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const L = useLayout();
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{
          paddingTop: insets.top + contentTop,
          paddingBottom: insets.bottom + space.s7,
          paddingHorizontal: space.s4,
          width: '100%',
          maxWidth: wide && L.wide ? L.wideCap : READABLE,
          alignSelf: 'center',
        }}
        /*
         * The first tap after typing must reach what it hit.
         *
         * A ScrollView swallows it by default: the tap dismisses the
         * keyboard and goes nowhere, so typing a duel code and then
         * pressing Play does nothing the first time, and searching for a
         * club and tapping it does nothing the first time. Every screen
         * with a field had this and none of them looked wrong.
         *
         * "handled" keeps the tap for anything that can take it and still
         * dismisses the keyboard on a tap that lands on nothing.
         */
        keyboardShouldPersistTaps="handled"
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
