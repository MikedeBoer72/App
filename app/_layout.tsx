// Root layout + auth guard.
//
// Routing rules (in order):
//   1. No session                                     -> /(auth)/login
//   2. Session, profile not yet loaded                -> splash
//   3. Session, profile load failed                   -> error screen w/ sign out
//   4. Session, profile.onboarding_completed = false  -> /onboarding
//   5. Session, level >= 5, not subscribed            -> /settings/subscription
//   6. Otherwise                                      -> /(tabs)

// Must be imported once at app entry for gesture-handler to wire up
// the native bridge. Required by react-native-draggable-flatlist.
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Slot, useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';

import { useFonts } from 'expo-font';
import { SpaceGrotesk_400Regular, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { ChakraPetch_400Regular, ChakraPetch_600SemiBold, ChakraPetch_700Bold } from '@expo-google-fonts/chakra-petch';
import { Baloo2_400Regular, Baloo2_700Bold, Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2';
import { MajorMonoDisplay_400Regular } from '@expo-google-fonts/major-mono-display';
import { AlfaSlabOne_400Regular } from '@expo-google-fonts/alfa-slab-one';
import { Cinzel_400Regular, Cinzel_700Bold, Cinzel_900Black } from '@expo-google-fonts/cinzel';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { Orbitron_400Regular, Orbitron_700Bold, Orbitron_900Black } from '@expo-google-fonts/orbitron';
import { RussoOne_400Regular } from '@expo-google-fonts/russo-one';
import { Audiowide_400Regular } from '@expo-google-fonts/audiowide';
import { JetBrainsMono_400Regular, JetBrainsMono_700Bold, JetBrainsMono_800ExtraBold } from '@expo-google-fonts/jetbrains-mono';

import { DEFAULT_THEME_ID, getTheme } from '@/constants/themes';
import { identifyUser, initAnalytics, resetAnalytics, track } from '@/lib/analytics';
import { syncWidget } from '@/lib/widget';
import { getXpProgress } from '@/lib/xp';
// Side-effect import: defines the daily-reset background task at
// module load. Keep this above the component so it runs once on
// every JS boot (including headless background launches).
import '@/lib/background-tasks';
import { currentDayFor, ensureDailyResetBackgroundFetch } from '@/lib/daily-reset';
import { disableDailyReminders } from '@/lib/notifications';
import {
  identifyRevenueCatUser,
  initRevenueCat,
  listenForEntitlementChanges,
  logOutRevenueCat,
} from '@/lib/revenuecat';
import { initSound } from '@/lib/sound';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Load theme fonts once at app start. Each name must match its
  // @expo-google-fonts export AND the string in constants/themes.ts.
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular, SpaceGrotesk_700Bold,
    Inter_400Regular, Inter_700Bold, Inter_900Black,
    Pacifico_400Regular,
    ChakraPetch_400Regular, ChakraPetch_600SemiBold, ChakraPetch_700Bold,
    Baloo2_400Regular, Baloo2_700Bold, Baloo2_800ExtraBold,
    MajorMonoDisplay_400Regular,
    AlfaSlabOne_400Regular,
    Cinzel_400Regular, Cinzel_700Bold, Cinzel_900Black,
    DMSerifDisplay_400Regular,
    Orbitron_400Regular, Orbitron_700Bold, Orbitron_900Black,
    RussoOne_400Regular,
    Audiowide_400Regular,
    JetBrainsMono_400Regular, JetBrainsMono_700Bold, JetBrainsMono_800ExtraBold,
  });

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
    // A rejection here previously left sessionChecked false forever —
    // a bare splash spinner with no UI and no way out. Always mark the
    // check done; a null session just routes to login.
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch((err) => console.warn('[layout] getSession failed', err))
      .finally(() => setSessionChecked(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (!sess) {
        reset();
        resetAnalytics();
        void logOutRevenueCat();
        void disableDailyReminders();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [reset]);

  // Configure RevenueCat + analytics once. No-op if keys are missing /
  // placeholders; falls through silently in Expo Go.
  useEffect(() => {
    initRevenueCat();
    initAnalytics();
    track('app_open');
    void initSound();
  }, []);

  // Tie analytics events to the signed-in user.
  useEffect(() => {
    const uid = session?.user?.id;
    if (uid) identifyUser(uid);
  }, [session?.user?.id]);

  // Keep the home-screen widget in sync with level/streak/theme.
  const widgetLevel = profile?.level;
  const widgetXp = profile?.total_xp;
  const widgetStreak = profile?.day_streak;
  useEffect(() => {
    if (!profile) return;
    syncWidget(profile, theme, getXpProgress(profile.total_xp).xpToNextLevel);
  }, [widgetLevel, widgetXp, widgetStreak, theme.id]);

  // Ask iOS to schedule the daily-reset background fetch once. Safe
  // to call on every launch - it's a no-op when already registered
  // and silently bails on devices where background-fetch is denied.
  useEffect(() => {
    void ensureDailyResetBackgroundFetch();
  }, []);

  // Identify the user with RevenueCat as soon as we have a session,
  // and listen for entitlement changes so a renewal / refund on
  // another device updates Supabase here too.
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    void identifyRevenueCatUser(uid);
    return listenForEntitlementChanges(uid);
  }, [session?.user?.id]);

  // Hydrate the store whenever we have a user id.
  useEffect(() => {
    const uid = session?.user?.id;
    if (uid) void loadForUser(uid);
  }, [session?.user?.id, loadForUser]);

  // Watchdog: Supabase calls have no timeout, so a stalled connection
  // (captive portal, flaky wifi) used to leave a bare splash spinner
  // forever — LoadError is only reachable once hydrated is true. After
  // 12s, surface the recoverable error screen instead.
  useEffect(() => {
    if (!session?.user?.id || hydrated) return;
    const t = setTimeout(() => {
      if (!useAppStore.getState().hydrated) {
        useAppStore.setState({
          hydrated:  true,
          loadError: 'Couldn’t reach the server. Check your connection and try again.',
        });
      }
    }, 12_000);
    return () => clearTimeout(t);
  }, [session?.user?.id, hydrated]);

  // Roll the day over WITHOUT an app restart. The reset otherwise only
  // ran inside loadForUser at startup, so an app left open (or
  // backgrounded) past day-start kept showing yesterday. Check when the
  // app returns to foreground and once a minute while active;
  // loadForUser is idempotent so extra calls are harmless.
  const lastActiveDate = profile?.last_active_date;
  const dayStartTime = profile?.day_start_time;
  // Previous logical-day value across checks, PAIRED with the
  // day-start it was computed under. Survives effect re-subscription
  // (day-start change) because it's a component ref. The pairing
  // matters: after a day-start REBASE (picking a time that already
  // passed re-stamps the day forward), the logical day jumps without
  // any boundary being crossed — comparing days computed under
  // different start times must never trigger a close-out.
  const prevLogicalDayRef = useRef<{ day: string; start: string } | null>(null);
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || !lastActiveDate || !dayStartTime) return;

    const checkRollover = () => {
      const logical = currentDayFor(new Date(), dayStartTime);
      const prev = prevLogicalDayRef.current;
      prevLogicalDayRef.current = { day: logical, start: dayStartTime };

      // Normal case: the calendar date of the logical day advanced.
      // Strictly forward (> not !==): moving day-start LATER than the
      // current time puts the computed day briefly BEHIND
      // last_active_date, which must not re-trigger loads every minute.
      if (logical > lastActiveDate) {
        void loadForUser(uid);
        return;
      }
      // Same-date crossing: the user moved day-start to later TODAY and
      // that moment just passed — logical flips yesterday -> today with
      // no date advance beyond last_active_date. Close the day in place.
      // Only when both days were computed under the SAME day-start:
      // a day-start change itself must not read as a crossing.
      if (
        prev != null &&
        prev.start === dayStartTime &&
        prev.day !== logical &&
        logical === lastActiveDate
      ) {
        void loadForUser(uid, { forceReset: true });
      }
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkRollover();
    });
    const interval = setInterval(checkRollover, 60_000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [session?.user?.id, lastActiveDate, dayStartTime, loadForUser]);

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
      if (top !== 'onboarding') router.replace('/onboarding');
      return;
    }

    const inSubscription = top === 'settings' && (segments as string[])[1] === 'subscription';
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
  if (!fontsLoaded || !sessionChecked) {
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {body}
      </SafeAreaProvider>
    </GestureHandlerRootView>
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
