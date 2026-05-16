// Placeholder. Real implementation in step 9.

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppStore } from '@/store/useAppStore';

export default function AddTasksStub() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.primary }]}>Add Task</Text>
      <Text style={[styles.body, { color: theme.colors.secondary }]}>
        Search + suggestions land in step 9.
      </Text>
      <Pressable onPress={() => router.back()} style={[styles.btn, { borderColor: theme.colors.muted }]}>
        <Text style={[styles.btnText, { color: theme.colors.primary }]}>Back</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, padding: 24, gap: 16 },
  title:   { fontSize: 24, fontWeight: '800' },
  body:    { fontSize: 14 },
  btn:     { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, marginTop: 'auto' },
  btnText: { fontSize: 14, fontWeight: '600' },
});
