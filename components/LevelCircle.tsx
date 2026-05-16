// Animated circular progress ring with the level number + tier name
// centered inside. Ring fills clockwise starting at 12 o'clock and
// animates when XP changes.

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface LevelCircleProps {
  level:           number;
  currentXp:       number;
  xpToNextLevel:   number;
  levelName:       string;
  size?:           number;
  strokeWidth?:    number;
  trackColor:      string;
  progressColor:   string;
  textColor:       string;
  subTextColor:    string;
}

export function LevelCircle({
  level,
  currentXp,
  xpToNextLevel,
  levelName,
  size = 240,
  strokeWidth = 14,
  trackColor,
  progressColor,
  textColor,
  subTextColor,
}: LevelCircleProps) {
  const radius = size / 2 - strokeWidth;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = xpToNextLevel > 0
    ? Math.max(0, Math.min(1, currentXp / xpToNextLevel))
    : 0;

  const anim = useRef(new Animated.Value(ratio)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue:         ratio,
      duration:        700,
      useNativeDriver: false,
    }).start();
  }, [ratio, anim]);

  const dashoffset = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          // Start at 12 o'clock.
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
      <View style={styles.inner} pointerEvents="none">
        <Text style={[styles.level, { color: textColor }]}>{level}</Text>
        <Text style={[styles.name, { color: subTextColor }]}>{levelName.toUpperCase()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:  { alignItems: 'center', justifyContent: 'center' },
  inner: { position: 'absolute', alignItems: 'center' },
  level: { fontSize: 64, fontWeight: '800', includeFontPadding: false },
  name:  { fontSize: 12, fontWeight: '700', letterSpacing: 2, marginTop: 2 },
});
