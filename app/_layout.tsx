// Root layout + auth guard.
//
// Routing rules (in order):
//   1. No session                                     -> /(auth)/login
//   2. Session, profile not yet loaded                -> splash
//   3. Session, profile.onboarding_completed = false  -> /onboarding/day-start-time
//   4. Session, level >= 5, not subscribed            -> /settings/subscription
//   5. Otherwise                                      -> /(tabs)

import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';

import { DEFAULT_THEME_ID, getTheme } from '@/constants/themes';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  const router = useRouter();
  const segments = useSegments();

  const profile = useAppStore((s) => s.profile);
  const hydrated = useAppStore((s) => s.hydrated);
  const theme = useAppStore((s) => s.theme);
  const loadForUser = useAppStore((s) => s.loadForUser);
  const reset = useAppStore((s) => s.reset);

  // Subscribe to Supabase auth changes.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (!sess) reset();
    });
    return () => sub.subscription.unsubscribe();
  }, [reset]);

  // Hydrate the store whenever we have a user id.
  useEffect(() => {
    const uid = session?.user?.id;
    if (uid) void loadForUser(uid);
  }, [session?.user?.id, loadForUser]);

  // Route redirects.
  useEffect(() => {
    if (!sessionChecked) return;
    const top = segments[0] as string | undefined;

    if (!session) {
      if (top !== '(auth)') router.replace('/(auth)/login');
      return;
    }

    if (!hydrated || !profile) return; // wait for the store

    if (!profile.onboarding_completed) {
      if (top !== 'onboarding') router.replace('/onboarding/day-start-time');
      return;
    }

    const inSubscription = top === 'settings' && segments[1] === 'subscription';
    if (profile.level >= 5 && !profile.is_subscribed) {
      if (!inSubscription) router.replace('/settings/subscription');
      return;
    }

    if (top === '(auth)' || top === 'onboarding') {
      router.replace('/(tabs)');
    }
  }, [sessionChecked, session, hydrated, profile, segments, router]);

  // Show a centered splash until we've made all the routing decisions.
  const splashTheme = profile ? theme : getTheme(DEFAULT_THEME_ID);
  const isReady = sessionChecked && (!session || (hydrated && profile != null));

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {isReady ? (
        <Slot />
      ) : (
        <View style={[styles.splash, { backgroundColor: splashTheme.colors.background }]}>
          <ActivityIndicator color={splashTheme.colors.accent} size="large" />
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
