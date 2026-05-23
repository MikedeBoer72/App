// One row in the Bad Habits list. Same shape as TaskItem but rendered
// in the danger color and showing a negative XP value.
//
// Polish (step 16):
//   - Checkbox does a quick spring bounce on tap.
//   - Row briefly flashes the danger color when transitioning to "done"
//     - the "ow" moment - then settles back.

import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

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

  const checkScale = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;
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
    outputRange: [surfaceColor, dangerColor + '33'],
  });

  return (
    <Animated.View style={[styles.row, { backgroundColor: animatedBg }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        onPress={() => onToggle(habit)}
        hitSlop={8}
      >
        <Animated.View
          style={[
            styles.checkbox,
            {
              borderColor:     done ? dangerColor : mutedColor,
              backgroundColor: done ? dangerColor : 'transparent',
              transform:       [{ scale: checkScale }],
            },
          ]}
        >
          {done ? <Text style={styles.cross}>{'✗'}</Text> : null}
        </Animated.View>
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
    </Animated.View>
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
