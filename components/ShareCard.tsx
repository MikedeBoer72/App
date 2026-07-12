// Off-screen card rendered only to be captured (react-native-view-shot)
// and pushed into the iOS share sheet. Styled in the active theme so
// every share is a mini-ad for the player's current world.
//
// Parent positions it off-screen (absolute, far left) and calls
// captureRef on the forwarded ref.

import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { useAppStore } from '@/store/useAppStore';

export interface ShareCardProps {
  level:     number;
  levelName: string;
  streak:    number;
  theme:     ReturnType<typeof useAppStore.getState>['theme'];
}

export const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(
  { level, levelName, streak, theme },
  ref,
) {
  const c = theme.colors;
  return (
    <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: c.background }]}>
      <Text style={[styles.brand, { color: c.secondary, fontFamily: theme.fonts.bold }]}>
        YOURLEVEL
      </Text>
      <View style={styles.center}>
        <Text style={[styles.kicker, { color: c.accent }]}>LEVEL</Text>
        <Text style={[styles.level, { color: c.primary, fontFamily: theme.fonts.heavy }]}>
          {level}
        </Text>
        <Text style={[styles.name, { color: c.accent, fontFamily: theme.fonts.bold }]}>
          {levelName.toUpperCase()}
        </Text>
        {streak > 0 ? (
          <Text style={[styles.streak, { color: c.primary }]}>🔥 {streak}-day streak</Text>
        ) : null}
      </View>
      <Text style={[styles.footer, { color: c.secondary }]}>
        Level up your habits · YourLevel
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card:   { width: 360, height: 480, borderRadius: 0, padding: 28, justifyContent: 'space-between', alignItems: 'center' },
  brand:  { fontSize: 14, fontWeight: '800', letterSpacing: 4 },
  center: { alignItems: 'center', gap: 4 },
  kicker: { fontSize: 13, fontWeight: '800', letterSpacing: 4 },
  level:  { fontSize: 120, fontWeight: '900', includeFontPadding: false },
  name:   { fontSize: 22, fontWeight: '800', letterSpacing: 2 },
  streak: { fontSize: 16, fontWeight: '700', marginTop: 10 },
  footer: { fontSize: 12, fontWeight: '600' },
});
