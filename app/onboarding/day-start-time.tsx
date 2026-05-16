// First-login onboarding: pick the time of day when your day "resets".
// Required - the guard in app/_layout.tsx redirects here until
// profile.onboarding_completed = true.
//
// The settings/day-start-time screen (step 12) is a slightly fancier
// version of this that enforces a 2-changes-per-month cap. Onboarding
// doesn't have that cap (it's the user's first time setting it).

import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
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
import { useAppStore } from '@/store/useAppStore';
import type { Profile } from '@/lib/types';

export default function OnboardingDayStartTime() {
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);

  const [time, setTime] = useState<Date>(() => initialDate(profile?.day_start_time));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!profile) return;
    setSaving(true);
    const hh = String(time.getHours()).padStart(2, '0');
    const mm = String(time.getMinutes()).padStart(2, '0');
    const day_start_time = `${hh}:${mm}:00`;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          day_start_time,
          onboarding_completed: true,
        })
        .eq('id', profile.id)
        .select('*')
        .single<Profile>();
      if (error || !data) throw error ?? new Error('Failed to save');
      setProfile(data);
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.colors.primary }]}>When does your day start?</Text>
        <Text style={[styles.body_text, { color: theme.colors.secondary }]}>
          Your tasks reset and your streak ticks over at this time every day. Pick what fits your
          schedule. You can change it later (twice a month).
        </Text>

        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={time}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_e, d) => d && setTime(d)}
            textColor={theme.colors.primary}
          />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={save}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: theme.colors.accent, opacity: pressed ? 0.85 : saving ? 0.6 : 1 },
        ]}
      >
        {saving ? (
          <ActivityIndicator color={theme.colors.background} />
        ) : (
          <Text style={[styles.ctaText, { color: theme.colors.background }]}>Save and continue</Text>
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
  root:       { flex: 1, padding: 24, justifyContent: 'space-between' },
  body:       { gap: 12, marginTop: 32 },
  title:      { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  body_text:  { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  pickerWrap: { marginTop: 16, alignItems: 'center' },
  cta:        { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  ctaText:    { fontSize: 16, fontWeight: '700' },
});
