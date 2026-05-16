// Subscription paywall stub. Reached automatically when a user hits
// Level 5 without a subscription, or manually via Settings.
// RevenueCat wiring lands in step 15. For now: copy + sign-out so the
// user is never trapped.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';

export default function SubscriptionScreen() {
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.colors.primary }]}>You hit Level 5.</Text>
        <Text style={[styles.copy, { color: theme.colors.secondary }]}>
          To keep leveling up, unlock fonts at every milestone, and get every future feature, MAXING.ai Pro
          is $7.99/month.
        </Text>

        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.primary }]}>Pro</Text>
          <Text style={[styles.bullet, { color: theme.colors.secondary }]}>{`• Continue past Level 5`}</Text>
          <Text style={[styles.bullet, { color: theme.colors.secondary }]}>{`• Unlock every theme at its milestone`}</Text>
          <Text style={[styles.bullet, { color: theme.colors.secondary }]}>{`• Everything we ship from here on`}</Text>
        </View>

        <Pressable
          disabled
          style={[styles.cta, { backgroundColor: theme.colors.accent, opacity: 0.6 }]}
        >
          <Text style={[styles.ctaText, { color: theme.colors.background }]}>
            Subscribe - $7.99 / month
          </Text>
        </Pressable>
        <Text style={[styles.todo, { color: theme.colors.muted }]}>
          Purchase flow lands once RevenueCat is wired (step 15).
        </Text>
      </View>

      <Pressable
        onPress={() => supabase.auth.signOut()}
        style={({ pressed }) => [
          styles.signOut,
          { borderColor: theme.colors.muted, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text style={[styles.signOutText, { color: theme.colors.primary }]}>Sign out</Text>
      </Pressable>

      {profile ? (
        <Text style={[styles.user, { color: theme.colors.muted }]}>Signed in as {profile.username ?? profile.id.slice(0, 8)}</Text>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, padding: 24, justifyContent: 'space-between' },
  body:        { gap: 16, marginTop: 32 },
  title:       { fontSize: 30, fontWeight: '800' },
  copy:        { fontSize: 15, lineHeight: 22 },
  card:        { padding: 20, borderRadius: 16, gap: 6 },
  cardTitle:   { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  bullet:      { fontSize: 14 },
  cta:         { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ctaText:     { fontSize: 16, fontWeight: '700' },
  todo:        { fontSize: 12, textAlign: 'center' },
  signOut:     { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  signOutText: { fontSize: 14, fontWeight: '600' },
  user:        { fontSize: 11, textAlign: 'center' },
});
