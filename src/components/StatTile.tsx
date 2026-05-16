import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

interface Props {
  label: string;
  value: string;
  unit?: string;
  accent?: string;
  hint?: string;
}

export function StatTile({ label, value, unit, accent = theme.colors.primary, hint }: Props) {
  return (
    <View style={styles.tile}>
      <View style={[styles.bar, { backgroundColor: accent }]} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    overflow: 'hidden',
  },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  label: { color: theme.colors.textDim, fontSize: theme.font.tiny, textTransform: 'uppercase', letterSpacing: 0.6 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  value: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '700' },
  unit: { color: theme.colors.textDim, fontSize: theme.font.small, marginLeft: 4 },
  hint: { color: theme.colors.textMuted, fontSize: theme.font.tiny, marginTop: 4 },
});
