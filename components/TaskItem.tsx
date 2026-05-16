// One row in the Tasks list on the dashboard.
//
// Per the spec, the row has two tap targets:
//   - the checkbox: toggles completion
//   - the name area: opens the options sheet (Rename / Delete / Toggle)

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Task } from '@/lib/types';

export interface TaskItemProps {
  task:         Task;
  primaryColor: string;
  mutedColor:   string;
  accentColor:  string;
  surfaceColor: string;
  onToggle:     (task: Task) => void;
  onOpenMenu:   (task: Task) => void;
}

export function TaskItem({
  task,
  primaryColor,
  mutedColor,
  accentColor,
  surfaceColor,
  onToggle,
  onOpenMenu,
}: TaskItemProps) {
  const done = task.is_completed;

  return (
    <View style={[styles.row, { backgroundColor: surfaceColor }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        onPress={() => onToggle(task)}
        hitSlop={8}
        style={({ pressed }) => [
          styles.checkbox,
          {
            borderColor:     done ? accentColor : mutedColor,
            backgroundColor: done ? accentColor : 'transparent',
            opacity:         pressed ? 0.6 : 1,
          },
        ]}
      >
        {done ? <Text style={styles.check}>{'✓'}</Text> : null}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => onOpenMenu(task)}
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
          {task.name}
        </Text>
      </Pressable>

      <Text style={[styles.xp, { color: done ? mutedColor : accentColor }]}>
        +{task.xp_value} XP
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius:   12,
    gap:            12,
  },
  checkbox: {
    width:           24,
    height:          24,
    borderRadius:    12,
    borderWidth:     2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  check:    { color: '#000', fontWeight: '900', fontSize: 14 },
  nameWrap: { flex: 1 },
  name:     { fontSize: 16, fontWeight: '600' },
  xp:       { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
});
