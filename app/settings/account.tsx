// Account screen.
//
// Switch Account = sign out, back to login.
//
// Delete Account = wipe the user's profile row. Foreign keys on tasks,
// bad_habits, task_history, daily_logs, referrals all CASCADE so a
// single delete cleans the data. We also sign the user out so they
// return to the login screen.
//
// We do NOT call admin.deleteUser - that requires the service-role
// key, which we can't ship to a client. The auth row stays. If the
// user signs back in with the same provider, loadForUser creates a
// fresh profile (handled in store/useAppStore.ts).

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ConfirmModal } from '@/components/ConfirmModal';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';

export default function AccountScreen() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);
  const reset = useAppStore((s) => s.reset);

  const [email, setEmail] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setProvider(data.user?.app_metadata?.provider ?? null);
    });
  }, []);

  async function signOut() {
    try {
      reset();
      await supabase.auth.signOut();
      // Auth guard in root layout will redirect to /(auth)/login.
    } catch (err) {
      Alert.alert('Sign out failed', err instanceof Error ? err.message : String(err));
    }
  }

  async function deleteAccount() {
    if (!profile) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
      if (error) throw error;
      reset();
      await supabase.auth.signOut();
    } catch (err) {
      Alert.alert('Could not delete account', err instanceof Error ? err.message : String(err));
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

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
        <Text style={[styles.title, { color: theme.colors.primary }]}>Account</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.body}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Field label="Email" value={email ?? '—'} theme={theme} />
          <Divider color={theme.colors.muted} />
          <Field label="Username" value={profile?.username ?? '—'} theme={theme} />
          <Divider color={theme.colors.muted} />
          <Field
            label="Signed in with"
            value={provider ? capitalize(provider) : '—'}
            theme={theme}
          />
        </View>

        <Pressable
          onPress={signOut}
          style={({ pressed }) => [
            styles.btn,
            { borderColor: theme.colors.muted, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="log-out-outline" size={18} color={theme.colors.primary} />
          <Text style={[styles.btnText, { color: theme.colors.primary }]}>Switch account</Text>
        </Pressable>

        <Pressable
          onPress={() => setConfirmDelete(true)}
          style={({ pressed }) => [
            styles.btn,
            styles.dangerBtn,
            { borderColor: theme.colors.danger, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
          <Text style={[styles.btnText, { color: theme.colors.danger }]}>Delete account</Text>
        </Pressable>
      </View>

      <ConfirmModal
        visible={confirmDelete}
        title="Delete your account?"
        message="Your profile, tasks, bad habits, daily logs, and referrals will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        colors={theme.colors}
        onConfirm={deleteAccount}
        onCancel={() => setConfirmDelete(false)}
      />
    </SafeAreaView>
  );
}

function Field({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useAppStore.getState>['theme'] }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.colors.secondary }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: theme.colors.primary }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color }} />;
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s;
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:       { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  body:        { flex: 1, padding: 24, gap: 16 },
  card:        { borderRadius: 16, paddingVertical: 4 },
  field:       { paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  fieldLabel:  { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  fieldValue:  { fontSize: 16, fontWeight: '600' },
  btn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 12, borderWidth: 1 },
  dangerBtn:   { marginTop: 'auto' },
  btnText:     { fontSize: 15, fontWeight: '700' },
});
