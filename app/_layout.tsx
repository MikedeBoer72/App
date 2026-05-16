// Root layout + auth guard.
//
// Routing rules (in order):
//   1. No session                                     -> /(auth)/login
//   2. Session, profile not yet loaded                -> splash
//   3. Session, profile load failed                   -> error screen w/ sign out
//   4. Session, profile.onboarding_completed = false  -> /onboarding/day-start-time
//   5. Session, level >= 5, not subscribed            -> /settings/subscription
//   6. Otherwise                                      -> /(tabs)

import { Slot, useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const loadError = useAppStore((s) => s.loadError);
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

    if (!hydrated || !profile) return; // wait for the store / error screen handles failure

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

  const splashTheme = profile ? theme : getTheme(DEFAULT_THEME_ID);

  const retry = useCallback(() => {
    const uid = session?.user?.id;
    if (uid) void loadForUser(uid);
  }, [session?.user?.id, loadForUser]);

  // Decision tree for what to render:
  //   not session-checked yet       -> splash
  //   no session                    -> Slot (routing kicks user to login)
  //   session but not hydrated      -> splash
  //   session, hydrated, no profile -> error screen (load failed)
  //   session, hydrated, profile    -> Slot
  let body: React.ReactNode;
  if (!sessionChecked) {
    body = <Splash colors={splashTheme.colors} />;
  } else if (!session) {
    body = <Slot />;
  } else if (!hydrated) {
    body = <Splash colors={splashTheme.colors} />;
  } else if (!profile) {
    body = <LoadError colors={splashTheme.colors} message={loadError} onRetry={retry} />;
  } else {
    body = <Slot />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {body}
    </SafeAreaProvider>
  );
}

function Splash({ colors }: { colors: { background: string; accent: string } }) {
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

function LoadError({
  colors,
  message,
  onRetry,
}: {
  colors: {
    background: string;
    primary:    string;
    secondary:  string;
    accent:     string;
    danger:     string;
    muted:      string;
  };
  message:  string | null;
  onRetry:  () => void;
}) {
  return (
    <View style={[styles.center, styles.errorPad, { backgroundColor: colors.background }]}>
      <Text style={[styles.errorTitle, { color: colors.primary }]}>Couldn't load your profile</Text>
      <Text style={[styles.errorBody, { color: colors.secondary }]}>
        {message ?? 'Something went wrong reaching the server.'}
      </Text>
      <View style={styles.errorActions}>
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: colors.accent, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.btnPrimaryText, { color: colors.background }]}>Try again</Text>
        </Pressable>
        <Pressable
          onPress={() => supabase.auth.signOut()}
          style={({ pressed }) => [
            styles.btnGhost,
            { borderColor: colors.muted, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.btnGhostText, { color: colors.primary }]}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorPad:         { paddingHorizontal: 32, gap: 12 },
  errorTitle:       { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  errorBody:        { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  errorActions:     { flexDirection: 'row', gap: 12, marginTop: 16 },
  btn:              { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  btnPrimaryText:   { fontSize: 14, fontWeight: '700' },
  btnGhost:         { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  btnGhostText:     { fontSize: 14, fontWeight: '600' },
});
