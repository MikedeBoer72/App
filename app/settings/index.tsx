// Placeholder settings menu. Full version (with all 8 rows wired up)
// lands in step 11.

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppStore } from '@/store/useAppStore';

export default function SettingsIndexStub() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.primary }]}>Settings</Text>
      <Text style={[styles.body, { color: theme.colors.secondary }]}>
        Menu and sub-screens land in steps 11-12.
      </Text>
      <Pressable
        onPress={() => router.push('/settings/subscription')}
        style={[styles.btn, { borderColor: theme.colors.muted }]}
      >
        <Text style={[styles.btnText, { color: theme.colors.primary }]}>Subscription (stub)</Text>
      </Pressable>
      <Pressable
        onPress={() => router.back()}
        style={[styles.btn, { borderColor: theme.colors.muted }]}
      >
        <Text style={[styles.btnText, { color: theme.colors.primary }]}>Back</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, padding: 24, gap: 12 },
  title:   { fontSize: 28, fontWeight: '800' },
  body:    { fontSize: 14, marginBottom: 16 },
  btn:     { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1 },
  btnText: { fontSize: 14, fontWeight: '600' },
});
