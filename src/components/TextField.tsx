import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../theme';

interface Props {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}

export function TextField({ label, value, onChangeText, placeholder }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  label: { color: theme.colors.textDim, fontSize: theme.font.tiny, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  input: {
    color: theme.colors.text,
    fontSize: theme.font.body,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
});
