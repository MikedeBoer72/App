import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';
import { xpProgress } from '../gamification';

interface Props {
  totalXp: number;
  showLabels?: boolean;
}

export function XPBar({ totalXp, showLabels = true }: Props) {
  const p = xpProgress(totalXp);
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.levelChip}>
          <Text style={styles.levelChipText}>LVL {p.level}</Text>
        </View>
        {showLabels && (
          <Text style={styles.xpText}>
            {p.xpIntoLevel} / {p.nextLevelXp - p.currentLevelXp} XP
          </Text>
        )}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${p.fraction * 100}%` }]} />
      </View>
      {showLabels && (
        <Text style={styles.subtle}>{p.xpToNext} XP to level {p.level + 1}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm },
  levelChip: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  levelChipText: { color: theme.colors.text, fontWeight: '700', fontSize: theme.font.small, letterSpacing: 0.5 },
  xpText: { color: theme.colors.xp, fontWeight: '700', fontSize: theme.font.small },
  track: {
    height: 12,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  fill: { height: '100%', backgroundColor: theme.colors.xp, borderRadius: 6 },
  subtle: { color: theme.colors.textDim, fontSize: theme.font.tiny, marginTop: 6 },
});
