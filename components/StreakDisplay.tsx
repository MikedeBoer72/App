// Fire-emoji + streak number. If the user is currently inside their
// second-chance redemption window, a small warning glyph is shown
// next to the number.

import { StyleSheet, Text, View } from 'react-native';

export interface StreakDisplayProps {
  streak:               number;
  secondChanceActive:   boolean;
  color:                string;
  warnColor:            string;
}

export function StreakDisplay({ streak, secondChanceActive, color, warnColor }: StreakDisplayProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.flame}>🔥</Text>
      <Text style={[styles.num, { color }]}>{streak}</Text>
      {secondChanceActive ? (
        <Text style={[styles.warn, { color: warnColor }]} accessibilityLabel="Second chance active">
          {'⚠'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flame: { fontSize: 18 },
  num:   { fontSize: 18, fontWeight: '700' },
  warn:  { fontSize: 14, marginLeft: 2 },
});
