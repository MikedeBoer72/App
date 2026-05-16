// Day Starting Time settings.
//
// Capped at 2 changes per calendar month. The cap auto-resets when
// last_day_start_change rolls into a new month - no scheduled job
// needed, we just look at the timestamp.

import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { useAppStore } from '@/store/useAppStore';

const MAX_CHANGES_PER_MONTH = 2;

export default function DayStartTimeScreen() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);

  const [time, setTime] = useState<Date>(() => initialDate(profile?.day_start_time));
  const [saving, setSaving] = useState(false);

  // Has last_day_start_change rolled into a new calendar month since
  // we last incremented? If so, the change counter is "stale" and the
  // effective count for this month is 0.
  const { remaining, resetText } = useMemo(() => {
    if (!profile) return { remaining: MAX_CHANGES_PER_MONTH, resetText: '' };
    const last = profile.last_day_start_change ? new Date(profile.last_day_start_change) : null;
    const now = new Date();
    const isNewMonth = !last || last.getFullYear() !== now.getFullYear() || last.getMonth() !== now.getMonth();
    const effective = isNewMonth ? 0 : profile.day_start_changes_this_month;
    const rem = Math.max(0, MAX_CHANGES_PER_MONTH - effective);

    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const text = nextMonth.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return { remaining: rem, resetText: text };
  }, [profile]);

  const canSave = remaining > 0;

  async function save() {
    if (!profile || !canSave) return;
    setSaving(true);

    const hh = String(time.getHours()).padStart(2, '0');
    const mm = String(time.getMinutes()).padStart(2, '0');
    const day_start_time = `${hh}:${mm}:00`;

    // Compute the new counter respecting the "new month" reset.
    const last = profile.last_day_start_change ? new Date(profile.last_day_start_change) : null;
    const now = new Date();
    const isNewMonth = !last || last.getFullYear() !== now.getFullYear() || last.getMonth() !== now.getMonth();
    const day_start_changes_this_month = isNewMonth ? 1 : profile.day_start_changes_this_month + 1;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          day_start_time,
          day_start_changes_this_month,
          last_day_start_change: now.toISOString(),
        })
        .eq('id', profile.id)
        .select('*')
        .single<Profile>();
      if (error || !data) throw error ?? new Error('Save failed');
      setProfile(data);
      router.back();
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : String(err));
      setSaving(false);
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
        <Text style={[styles.title, { color: theme.colors.primary }]}>Day Starting Time</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.copy, { color: theme.colors.secondary }]}>
          Pick what time your day resets. Tasks clear and your streak updates at this time each day.
        </Text>

        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <DateTimePicker
            value={time}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_e, d) => d && setTime(d)}
            textColor={theme.colors.primary}
          />
        </View>

        {canSave ? (
          <Text style={[styles.meta, { color: theme.colors.secondary }]}>
            {remaining === MAX_CHANGES_PER_MONTH
              ? `You have ${MAX_CHANGES_PER_MONTH} changes this month.`
              : `You have ${remaining} change${remaining === 1 ? '' : 's'} remaining this month.`}
          </Text>
        ) : (
          <Text style={[styles.meta, { color: theme.colors.danger }]}>
            You've used both changes for this month. Resets on {resetText}.
          </Text>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!canSave || saving}
        onPress={save}
        style={({ pressed }) => [
          styles.cta,
          {
            backgroundColor: theme.colors.accent,
            opacity: !canSave ? 0.4 : saving ? 0.6 : pressed ? 0.8 : 1,
          },
        ]}
      >
        {saving ? (
          <ActivityIndicator color={theme.colors.background} />
        ) : (
          <Text style={[styles.ctaText, { color: theme.colors.background }]}>Save</Text>
        )}
      </Pressable>
    </SafeAreaView>
  );
}

function initialDate(hms: string | undefined): Date {
  const d = new Date();
  if (!hms) {
    d.setHours(6, 0, 0, 0);
    return d;
  }
  const [h = '6', m = '0'] = hms.split(':');
  d.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
  return d;
}

const styles = StyleSheet.create({
  root:     { flex: 1 },
  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:    { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  body:     { flex: 1, paddingHorizontal: 24, gap: 16, marginTop: 16 },
  copy:     { fontSize: 14, lineHeight: 20 },
  card:     { padding: 12, borderRadius: 16, alignItems: 'center' },
  meta:     { fontSize: 13, textAlign: 'center', marginTop: 8 },
  cta:      { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginHorizontal: 24, marginBottom: 24 },
  ctaText:  { fontSize: 16, fontWeight: '700' },
});
