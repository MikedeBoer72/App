import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../theme';

interface Props {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  unit?: string;
  keyboardType?: 'numeric' | 'decimal-pad' | 'default';
}

export function NumberInput({ label, value, onChangeText, placeholder, unit, keyboardType = 'decimal-pad' }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          keyboardType={keyboardType}
        />
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  label: { color: theme.colors.textDim, fontSize: theme.font.tiny, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    paddingHorizontal: theme.spacing.md,
  },
  input: { flex: 1, color: theme.colors.text, fontSize: theme.font.body, paddingVertical: theme.spacing.md },
  unit: { color: theme.colors.textDim, fontSize: theme.font.small, marginLeft: 4 },
});
