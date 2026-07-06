// Confetti burst rendered with plain Animated — no dependency.
//
// Spawns N small rectangles above the visible area that fall, drift
// sideways, and spin, fading out near the end. Each particle gets a
// randomized delay / duration / drift / spin so the burst reads
// organic. Runs once on mount; parent unmounts it with the modal.

import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export interface ConfettiProps {
  /** Particle colors — pass theme colors so it matches the palette. */
  colors: string[];
  count?: number;
}

interface Particle {
  progress:  Animated.Value;
  x:         number;   // start x
  drift:     number;   // horizontal drift over the fall
  size:      number;
  color:     string;
  spin:      number;   // total rotations (can be negative)
  delay:     number;
  duration:  number;
  isRound:   boolean;
}

export function Confetti({ colors, count = 36 }: ConfettiProps) {
  const particles = useRef<Particle[]>(
    Array.from({ length: count }, (_, i) => ({
      progress: new Animated.Value(0),
      x:        Math.random() * SCREEN_W,
      drift:    (Math.random() - 0.5) * 160,
      size:     6 + Math.random() * 8,
      color:    colors[i % colors.length] ?? '#FFFFFF',
      spin:     (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3),
      delay:    Math.random() * 350,
      duration: 1400 + Math.random() * 1200,
      isRound:  Math.random() < 0.3,
    })),
  ).current;

  useEffect(() => {
    const anims = particles.map((p) =>
      Animated.timing(p.progress, {
        toValue:         1,
        duration:        p.duration,
        delay:           p.delay,
        easing:          Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    );
    Animated.parallel(anims).start();
  }, [particles]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => {
        const translateY = p.progress.interpolate({
          inputRange:  [0, 1],
          outputRange: [-40, SCREEN_H * 0.9],
        });
        const translateX = p.progress.interpolate({
          inputRange:  [0, 1],
          outputRange: [0, p.drift],
        });
        const rotate = p.progress.interpolate({
          inputRange:  [0, 1],
          outputRange: ['0deg', `${p.spin * 360}deg`],
        });
        const opacity = p.progress.interpolate({
          inputRange:  [0, 0.1, 0.75, 1],
          outputRange: [0, 1, 1, 0],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position:        'absolute',
              left:            p.x,
              top:             0,
              width:           p.size,
              height:          p.isRound ? p.size : p.size * 1.8,
              borderRadius:    p.isRound ? p.size / 2 : 2,
              backgroundColor: p.color,
              opacity,
              transform:       [{ translateY }, { translateX }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}
