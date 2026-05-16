// Shared "this screen lands in step N" placeholder used by every
// settings sub-screen that hasn't been built yet. Underscore prefix
// keeps it out of expo-router's route table.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppStore } from '@/store/useAppStore';

export function SettingsStub({ title, step }: { title: string; step: number }) {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Ionicons name="chevron-back" size={26} color={theme.colors.primary} />
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.primary }]}>{title}</Text>
        <View style={styles.iconBtn} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.headline, { color: theme.colors.primary }]}>Coming soon</Text>
        <Text style={[styles.subtext, { color: theme.colors.secondary }]}>
          This screen lands in step {step}.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1 },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:     { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  body:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 24 },
  headline:  { fontSize: 22, fontWeight: '700' },
  subtext:   { fontSize: 14 },
});
