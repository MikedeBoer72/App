// Start Over.
//
// Two-step confirm: a soft "are you sure" then a typed RESET. Wipes
// the user's gameplay data (tasks, bad_habits, daily_logs) and resets
// the profile's progression fields. The auth account itself is
// untouched - the user can keep using it, just from level 1 again.
//
// We deliberately preserve a few profile fields:
//   - day_start_time + day_start_changes_this_month (user already set
//     them, no point making them redo onboarding)
//   - onboarding_completed (same reason - just a reset, not a wipe)
//   - selected_font / is_subscribed (entitlement isn't gameplay)

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmModal } from '@/components/ConfirmModal';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { useAppStore } from '@/store/useAppStore';

type Step = 'idle' | 'ask' | 'type';

export default function StartOverScreen() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const setTasks = useAppStore((s) => s.setTasks);
  const setBadHabits = useAppStore((s) => s.setBadHabits);

  const [step, setStep] = useState<Step>('idle');
  const [busy, setBusy] = useState(false);

  async function performReset() {
    if (!profile) return;
    setBusy(true);
    try {
      const userId = profile.id;
      await Promise.all([
        supabase.from('tasks').delete().eq('user_id', userId),
        supabase.from('bad_habits').delete().eq('user_id', userId),
        supabase.from('daily_logs').delete().eq('user_id', userId),
      ]);

      const { data: updated, error } = await supabase
        .from('profiles')
        .update({
          level:                          1,
          total_xp:                       0,
          current_xp:                     0,
          day_streak:                     0,
          highest_streak:                 0,
          second_chance_active:           false,
          second_chance_days_remaining:   0,
          // A true wipe: banked freezes, queued milestone celebrations
          // and today's XP caps must not survive into the fresh start.
          streak_freezes:                 0,
          pending_streak_milestone:       null,
          daily_task_xp_earned:           0,
          daily_bad_habit_xp_lost:        0,
          bad_habits_penalized_today:     [],
        })
        .eq('id', userId)
        .select('*')
        .single<Profile>();
      if (error || !updated) throw error ?? new Error('Reset failed');

      setProfile(updated);
      setTasks([]);
      setBadHabits([]);
      setStep('idle');
      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert('Could not reset', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
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
        <Text style={[styles.title, { color: theme.colors.primary }]}>Start Over</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.body}>
        <Ionicons name="warning-outline" size={64} color={theme.colors.danger} />
        <Text style={[styles.headline, { color: theme.colors.primary }]}>
          This wipes all your progress.
        </Text>
        <Text style={[styles.copy, { color: theme.colors.secondary }]}>
          Levels, XP, streaks, tasks, bad habits, and daily logs are deleted permanently. Your
          account, subscription, and day-start time stay. This cannot be undone.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => setStep('ask')}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: theme.colors.danger, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="trash-outline" size={18} color={theme.colors.background} />
          <Text style={[styles.ctaText, { color: theme.colors.background }]}>
            Delete everything & start over
          </Text>
        </Pressable>
      </View>

      <ConfirmModal
        visible={step === 'ask'}
        title="Are you sure?"
        message="This will delete all your progress and reset you to level 1."
        confirmLabel="Yes, continue"
        cancelLabel="Cancel"
        destructive
        colors={theme.colors}
        onConfirm={() => setStep('type')}
        onCancel={() => setStep('idle')}
      />

      <ConfirmModal
        visible={step === 'type'}
        title="Type RESET to confirm"
        message="Final check. There is no undo."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        destructive
        requireTyping="RESET"
        loading={busy}
        colors={theme.colors}
        onConfirm={performReset}
        onCancel={() => setStep('idle')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1 },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:     { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  body:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  headline:  { fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 16 },
  copy:      { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 24 },
  cta:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 14, paddingHorizontal: 24, alignSelf: 'stretch' },
  ctaText:   { fontSize: 16, fontWeight: '700' },
});
