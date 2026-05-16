// Horizontal animated XP progress bar. Pairs with LevelCircle as a
// compact alternative wherever a ring is too heavy (e.g. inline
// inside a settings row, a notification, or a tooltip).

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export interface XPBarProps {
  currentXp:       number;
  xpToNextLevel:   number;
  height?:         number;
  trackColor:      string;
  progressColor:   string;
}

export function XPBar({
  currentXp,
  xpToNextLevel,
  height = 8,
  trackColor,
  progressColor,
}: XPBarProps) {
  const ratio = xpToNextLevel > 0
    ? Math.max(0, Math.min(1, currentXp / xpToNextLevel))
    : 0;

  const anim = useRef(new Animated.Value(ratio)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue:         ratio,
      duration:        600,
      useNativeDriver: false,
    }).start();
  }, [ratio, anim]);

  const widthInterp = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
  });

  const radius = height / 2;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: xpToNextLevel, now: currentXp }}
      style={[
        styles.track,
        { backgroundColor: trackColor, height, borderRadius: radius },
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: progressColor,
            height,
            borderRadius:    radius,
            width:           widthInterp,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill:  {},
});
