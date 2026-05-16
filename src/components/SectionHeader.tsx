import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, right }: Props) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md, marginTop: theme.spacing.lg },
  title: { color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '700' },
  subtitle: { color: theme.colors.textDim, fontSize: theme.font.small, marginTop: 2 },
});
