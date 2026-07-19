// First-run onboarding. A small step machine:
//   welcome -> xp -> streaks -> habits -> name -> day-start time
//
// The tutorial slides explain the core loop. The name step fixes the
// "Guest" problem (OAuth providers — especially Apple — often don't
// return a display name, so we ask). The final step sets the day's
// reset time. Finishing writes username + day_start_time and flips
// onboarding_completed=true, which the root layout uses to route the
// user into the app.

import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { currentDayFor } from '@/lib/daily-reset';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { TUTORIAL_DONE_KEY, TUTORIAL_PENDING_KEY, useAppStore } from '@/store/useAppStore';

// Kept intentionally short: welcome -> name -> day-start. The game
// rules are taught by the interactive walkthrough on the dashboard
// (see TUTORIAL_STEPS in app/(tabs)/index.tsx), which starts right
// after onboarding via the TUTORIAL_PENDING_KEY flag.
type StepId = 'welcome' | 'name' | 'time';

const SLIDES: Record<
  Exclude<StepId, 'name' | 'time'>,
  { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }
> = {
  welcome: {
    icon: 'sparkles',
    title: 'Welcome to YourLevel',
    body: 'Turn self-improvement into a game. Earn XP, level up, and unlock new looks by building good habits and dropping bad ones. We’ll show you around in a minute.',
  },
};

const ORDER: StepId[] = ['welcome', 'name', 'time'];

export default function Onboarding() {
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);

  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState(profile?.username ?? '');
  const [time, setTime] = useState<Date>(() => initialDate(profile?.day_start_time));
  const [saving, setSaving] = useState(false);

  const step = ORDER[stepIndex]!;
  const isLast = stepIndex === ORDER.length - 1;
  const canAdvance = step !== 'name' || name.trim().length > 0;

  function next() {
    if (isLast) {
      void finish();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, ORDER.length - 1));
  }

  function back() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function finish() {
    if (!profile) return;
    setSaving(true);
    const hh = String(time.getHours()).padStart(2, '0');
    const mm = String(time.getMinutes()).padStart(2, '0');
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          username: name.trim() || profile.username || null,
          day_start_time: `${hh}:${mm}:00`,
          onboarding_completed: true,
          // Stamp the active day from the DEVICE clock + chosen
          // day-start. The DB default is the server's UTC date, which
          // can sit a day ahead for users west of UTC and stretch
          // their first day to ~48h before the first close-out.
          last_active_date: currentDayFor(new Date(), `${hh}:${mm}:00`),
        })
        .eq('id', profile.id)
        .select('*')
        .single<Profile>();
      if (error || !data) throw error ?? new Error('Could not save');
      // Queue the interactive dashboard walkthrough for this fresh
      // account. Also clear the device-level "done" flag: it survives
      // sign-outs and previously blocked every subsequent account on
      // the same phone from ever seeing the tutorial.
      await Promise.all([
        AsyncStorage.setItem(TUTORIAL_PENDING_KEY, 'true'),
        AsyncStorage.removeItem(TUTORIAL_DONE_KEY),
      ]).catch(() => {});
      setProfile(data);
      // Root layout routes into the app once onboarding_completed flips.
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* Progress dots */}
      <View style={styles.dots}>
        {ORDER.map((s, i) => (
          <View
            key={s}
            style={[
              styles.dot,
              {
                backgroundColor: i <= stepIndex ? theme.colors.accent : theme.colors.muted,
                width: i === stepIndex ? 22 : 8,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.body}>
        {step === 'name' ? (
          <View style={styles.center}>
            <Ionicons name="person-circle-outline" size={84} color={theme.colors.accent} />
            <Text style={[styles.title, { color: theme.colors.primary, fontFamily: theme.fonts.heavy }]}>
              What should we call you?
            </Text>
            <Text style={[styles.bodyText, { color: theme.colors.secondary }]}>
              This is the name shown on your profile.
            </Text>
            <TextInput
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={theme.colors.muted}
              maxLength={32}
              returnKeyType="done"
              onSubmitEditing={() => canAdvance && next()}
              style={[
                styles.input,
                {
                  color: theme.colors.primary,
                  borderColor: theme.colors.muted,
                  backgroundColor: theme.colors.surface,
                },
              ]}
            />
          </View>
        ) : step === 'time' ? (
          <View style={styles.center}>
            <Ionicons name="time-outline" size={84} color={theme.colors.accent} />
            <Text style={[styles.title, { color: theme.colors.primary, fontFamily: theme.fonts.heavy }]}>
              When does your day start?
            </Text>
            <Text style={[styles.bodyText, { color: theme.colors.secondary }]}>
              Your tasks reset and your streak updates at this time every day. You can change it later.
            </Text>
            <View style={[styles.pickerWrap, { backgroundColor: theme.colors.surface }]}>
              <DateTimePicker
                value={time}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_e, d) => d && setTime(d)}
                textColor={theme.colors.primary}
              />
            </View>
          </View>
        ) : (
          <View style={styles.center}>
            <Ionicons name={SLIDES[step].icon} size={96} color={theme.colors.accent} />
            <Text style={[styles.title, { color: theme.colors.primary, fontFamily: theme.fonts.heavy }]}>
              {SLIDES[step].title}
            </Text>
            <Text style={[styles.bodyText, { color: theme.colors.secondary }]}>
              {SLIDES[step].body}
            </Text>
          </View>
        )}
      </View>

      {/* Nav buttons */}
      <View style={styles.nav}>
        {stepIndex > 0 ? (
          <Pressable
            onPress={back}
            disabled={saving}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.5 : 1 }]}
          >
            <Text style={[styles.backText, { color: theme.colors.secondary }]}>Back</Text>
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}

        <Pressable
          onPress={next}
          disabled={!canAdvance || saving}
          style={({ pressed }) => [
            styles.nextBtn,
            {
              backgroundColor: theme.colors.accent,
              opacity: !canAdvance ? 0.4 : pressed ? 0.85 : 1,
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.background} />
          ) : (
            <Text style={[styles.nextText, { color: theme.colors.background }]}>
              {isLast ? 'Start' : 'Next'}
            </Text>
          )}
        </Pressable>
      </View>
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
  root:       { flex: 1, paddingHorizontal: 24 },
  dots:       { flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', paddingTop: 16 },
  dot:        { height: 8, borderRadius: 4 },
  body:       { flex: 1, justifyContent: 'center' },
  center:     { alignItems: 'center', gap: 16 },
  title:      { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  bodyText:   { fontSize: 16, lineHeight: 24, textAlign: 'center', paddingHorizontal: 8 },
  input:      { width: '85%', height: 52, borderRadius: 12, paddingHorizontal: 16, fontSize: 18, borderWidth: 1, textAlign: 'center', marginTop: 8 },
  pickerWrap: { marginTop: 8, borderRadius: 16, paddingHorizontal: 12, alignItems: 'center', alignSelf: 'stretch' },
  nav:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 24, gap: 12 },
  backBtn:    { minWidth: 64, height: 52, justifyContent: 'center' },
  backText:   { fontSize: 16, fontWeight: '600' },
  nextBtn:    { flex: 1, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  nextText:   { fontSize: 16, fontWeight: '700' },
});
