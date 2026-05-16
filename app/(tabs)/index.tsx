// Dashboard stub. Full implementation lands in step 8.
// Right now it just renders enough state to confirm the auth + store
// loop works end-to-end and gives us a sign-out button to test it.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';

export default function DashboardStub() {
  const profile = useAppStore((s) => s.profile);
  const theme = useAppStore((s) => s.theme);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.primary }]}>MAXING.ai</Text>
      <View style={styles.card}>
        <Text style={[styles.label, { color: theme.colors.secondary }]}>Level</Text>
        <Text style={[styles.value, { color: theme.colors.accent }]}>{profile?.level ?? '-'}</Text>
      </View>
      <View style={styles.card}>
        <Text style={[styles.label, { color: theme.colors.secondary }]}>Total XP</Text>
        <Text style={[styles.value, { color: theme.colors.primary }]}>{profile?.total_xp ?? 0}</Text>
      </View>
      <View style={styles.card}>
        <Text style={[styles.label, { color: theme.colors.secondary }]}>Day streak</Text>
        <Text style={[styles.value, { color: theme.colors.primary }]}>{profile?.day_streak ?? 0}</Text>
      </View>
      <Text style={[styles.note, { color: theme.colors.muted }]}>
        Dashboard placeholder - real UI in step 8.
      </Text>
      <Pressable
        onPress={() => supabase.auth.signOut()}
        style={({ pressed }) => [
          styles.signOut,
          { borderColor: theme.colors.muted, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text style={[styles.signOutText, { color: theme.colors.primary }]}>Sign out</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, padding: 24, gap: 16 },
  title:       { fontSize: 28, fontWeight: '800', marginBottom: 12 },
  card:        { padding: 16, borderRadius: 12, backgroundColor: '#FFFFFF10' },
  label:       { fontSize: 13, marginBottom: 4 },
  value:       { fontSize: 24, fontWeight: '700' },
  note:        { fontSize: 12, marginTop: 24 },
  signOut:     { marginTop: 'auto', alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, borderWidth: 1 },
  signOutText: { fontSize: 14, fontWeight: '600' },
});
