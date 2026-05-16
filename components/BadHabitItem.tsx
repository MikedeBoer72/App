// One row in the Bad Habits list. Same shape as TaskItem but rendered
// in the danger color and showing a negative XP value.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BadHabit } from '@/lib/types';

export interface BadHabitItemProps {
  habit:         BadHabit;
  primaryColor:  string;
  mutedColor:    string;
  dangerColor:   string;
  surfaceColor:  string;
  onToggle:      (habit: BadHabit) => void;
  onOpenMenu:    (habit: BadHabit) => void;
}

export function BadHabitItem({
  habit,
  primaryColor,
  mutedColor,
  dangerColor,
  surfaceColor,
  onToggle,
  onOpenMenu,
}: BadHabitItemProps) {
  const done = habit.is_done;

  return (
    <View style={[styles.row, { backgroundColor: surfaceColor }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        onPress={() => onToggle(habit)}
        hitSlop={8}
        style={({ pressed }) => [
          styles.checkbox,
          {
            borderColor:     done ? dangerColor : mutedColor,
            backgroundColor: done ? dangerColor : 'transparent',
            opacity:         pressed ? 0.6 : 1,
          },
        ]}
      >
        {done ? <Text style={styles.cross}>{'✗'}</Text> : null}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => onOpenMenu(habit)}
        style={({ pressed }) => [styles.nameWrap, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.name,
            {
              color: done ? mutedColor : primaryColor,
              textDecorationLine: done ? 'line-through' : 'none',
            },
          ]}
        >
          {habit.name}
        </Text>
      </Pressable>

      <Text style={[styles.xp, { color: dangerColor }]}>
        -{habit.xp_penalty} XP
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   12,
    paddingHorizontal: 14,
    borderRadius:      12,
    gap:               12,
  },
  checkbox: {
    width:           24,
    height:          24,
    borderRadius:    12,
    borderWidth:     2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  cross:    { color: '#FFF', fontWeight: '900', fontSize: 14 },
  nameWrap: { flex: 1 },
  name:     { fontSize: 16, fontWeight: '600' },
  xp:       { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
});
