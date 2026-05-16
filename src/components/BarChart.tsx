import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

interface Props {
  values: number[];
  labels: string[];
  goal?: number;
  color?: string;
  unit?: string;
}

export function BarChart({ values, labels, goal, color = theme.colors.primary, unit }: Props) {
  const max = Math.max(goal ?? 0, ...values, 1) * 1.1;
  return (
    <View>
      <View style={styles.row}>
        {values.map((v, i) => {
          const h = Math.max(2, (v / max) * 100);
          const met = goal !== undefined && v >= goal;
          return (
            <View key={i} style={styles.col}>
              <View style={styles.barWrap}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${h}%`,
                      backgroundColor: met ? theme.colors.success : color,
                    },
                  ]}
                />
                {goal !== undefined && (
                  <View
                    style={[
                      styles.goalLine,
                      { bottom: `${(goal / max) * 100}%` },
                    ]}
                  />
                )}
              </View>
              <Text style={styles.label}>{labels[i]}</Text>
              <Text style={styles.value}>
                {v > 0 ? v.toFixed(v < 10 ? 1 : 0) : '–'}
              </Text>
            </View>
          );
        })}
      </View>
      {goal !== undefined && (
        <Text style={styles.legend}>
          Goal: {goal}
          {unit ? ` ${unit}` : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 6 },
  col: { flex: 1, alignItems: 'center' },
  barWrap: {
    width: '100%',
    height: 100,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  bar: { width: '100%', borderRadius: theme.radius.sm },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: theme.colors.warning,
    opacity: 0.7,
  },
  label: { color: theme.colors.textDim, fontSize: theme.font.tiny, marginTop: 4 },
  value: { color: theme.colors.textMuted, fontSize: 10 },
  legend: { color: theme.colors.warning, fontSize: theme.font.tiny, marginTop: theme.spacing.sm, textAlign: 'right' },
});
