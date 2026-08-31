import { ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, space } from '../tokens';
import { text } from '../type';

/**
 * Every tab sits on this. Handles the notch, the home indicator and the
 * space the tab bar takes out of the bottom of the scroll view.
 */
export function Screen({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{
          paddingTop: insets.top + space.s4,
          paddingBottom: insets.bottom + space.s8 + space.s7,
          paddingHorizontal: space.s4,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          {kicker ? <Text style={text.label}>{kicker}</Text> : null}
          <Text style={[text.title, styles.title]}>{title}</Text>
        </View>
        {children}
      </ScrollView>
    </View>
  );
}

/** A group separator. Real air between groups, per the 8pt rule. */
export function Section({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      {label ? <Text style={[text.label, styles.sectionLabel]}>{label}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  head: { marginBottom: space.s5 },
  title: { marginTop: space.s1 },
  section: { marginTop: space.s7 },
  sectionLabel: { marginBottom: space.s3 },
});
