import { View, Text, Switch, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { color, space } from '../tokens';
import { text } from '../type';

export function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.body}>
        <Text style={text.bodyStrong}>{label}</Text>
        {hint ? <Text style={text.small}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(next) => {
          Haptics.selectionAsync();
          onChange(next);
        }}
        trackColor={{ false: color.surface3, true: color.accentPress }}
        thumbColor={color.text1}
        ios_backgroundColor={color.surface3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s4,
    paddingVertical: space.s3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  body: { flex: 1, minWidth: 0, gap: 2 },
});
