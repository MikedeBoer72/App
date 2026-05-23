// One row in the Tasks list on the dashboard.
//
// Per the spec, the row has two tap targets:
//   - the checkbox: toggles completion
//   - the name area: opens the options sheet (Rename / Delete / Toggle)
//
// Polish (step 16):
//   - Checkbox does a quick spring bounce on tap.
//   - Row briefly flashes the accent color when going un-checked -> checked
//     (the "win" moment), then settles back to the surface color.

import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

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

  // Scale bounce on the checkbox.
  const checkScale = useRef(new Animated.Value(1)).current;
  // 0 -> idle (surface color), 1 -> celebrating (accent tint).
  const flash = useRef(new Animated.Value(0)).current;
  // Tracks the *previous* completion state so we only flash on a real
  // un-checked -> checked transition (not on initial render of a row
  // that's already done).
  const prevDone = useRef(done);

  useEffect(() => {
    if (done !== prevDone.current) {
      Animated.sequence([
        Animated.spring(checkScale, { toValue: 1.35, friction: 4, useNativeDriver: true }),
        Animated.spring(checkScale, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]).start();

      if (done && !prevDone.current) {
        Animated.sequence([
          Animated.timing(flash, { toValue: 1, duration: 180, useNativeDriver: false }),
          Animated.timing(flash, { toValue: 0, duration: 600, useNativeDriver: false }),
        ]).start();
      }
    }
    prevDone.current = done;
  }, [done, checkScale, flash]);

  const animatedBg = flash.interpolate({
    inputRange:  [0, 1],
    outputRange: [surfaceColor, accentColor + '33'], // accent with ~20% alpha
  });

  return (
    <Animated.View style={[styles.row, { backgroundColor: animatedBg }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        onPress={() => onToggle(task)}
        hitSlop={8}
      >
        <Animated.View
          style={[
            styles.checkbox,
            {
              borderColor:     done ? accentColor : mutedColor,
              backgroundColor: done ? accentColor : 'transparent',
              transform:       [{ scale: checkScale }],
            },
          ]}
        >
          {done ? <Text style={styles.check}>{'✓'}</Text> : null}
        </Animated.View>
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
    </Animated.View>
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
