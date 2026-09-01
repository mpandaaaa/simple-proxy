import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ModeScreen, Surface } from '../src/ui/components';
import { color, space } from '../src/ui/tokens';
import { text } from '../src/ui/type';

/**
 * The holding screen for a mode that is on the plan but not built yet.
 *
 * It exists so the home screen can carry the full set of modes without
 * wearing a "not wired" mark on any of them, and so a tap always leads
 * somewhere real. Each mode passes its own description in, taken from the
 * live site, so this never says anything the website does not.
 */
export default function Soon() {
  const { overline, title, blurb } = useLocalSearchParams<{
    overline: string;
    title: string;
    blurb: string;
  }>();

  return (
    <ModeScreen overline={overline ?? 'Perfect XI'} title={title ?? ''}>
      <Surface level={2} style={styles.card}>
        <Text style={text.body}>{blurb}</Text>
      </Surface>
      <View style={styles.note}>
        <Text style={[text.small, styles.noteText]}>
          Being built now. The draft is wired first.
        </Text>
      </View>
    </ModeScreen>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.s5 },
  note: { marginTop: space.s4, alignItems: 'center' },
  noteText: { color: color.text3 },
});
