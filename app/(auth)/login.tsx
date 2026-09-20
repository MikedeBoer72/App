// Login screen. Two OAuth paths:
//
//   - Google: Supabase signInWithOAuth + expo-web-browser. The user
//     only needs to flip on the Google provider in the Supabase Auth
//     dashboard - Supabase issues the redirect URL itself.
//
//   - Apple: native expo-apple-authentication. Returns an identity
//     token that's exchanged for a Supabase session via
//     signInWithIdToken. Requires Apple Developer setup + an Apple
//     provider configured in Supabase.
//
// The Apple button MUST be AppleAuthenticationButton (Apple's own
// native view). A hand-styled button has no  logo artwork and is
// rejected under App Review guideline 4 (Design) — that happened on
// build 31.

import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
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

import { DEFAULT_THEME_ID, getTheme } from '@/constants/themes';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';

WebBrowser.maybeCompleteAuthSession();

type Pending = 'google' | 'apple' | 'guest' | null;

export default function LoginScreen() {
  const theme = getTheme(DEFAULT_THEME_ID);
  const [pending, setPending] = useState<Pending>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  async function handleGoogle() {
    setPending('google');
    try {
      const redirectTo = Linking.createURL('auth-callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data?.url) throw error ?? new Error('No OAuth URL from Supabase');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') return;

      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('OAuth redirect result url:', result.url);
      }

      // Params can live in the query (?code=... for PKCE) or the
      // fragment (#access_token=... for implicit). Expo Go also wraps
      // the deep link as exp://host/--/path?...; Linking.parse handles
      // the query side of that, and we hand-parse the fragment.
      const parsed = Linking.parse(result.url);
      const q = parsed.queryParams ?? {};
      const fragment = result.url.includes('#') ? result.url.split('#')[1]! : '';
      const hash = new URLSearchParams(fragment);

      const code =
        (typeof q.code === 'string' ? q.code : null) ?? hash.get('code');
      const access_token =
        (typeof q.access_token === 'string' ? q.access_token : null) ?? hash.get('access_token');
      const refresh_token =
        (typeof q.refresh_token === 'string' ? q.refresh_token : null) ?? hash.get('refresh_token');

      if (code) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exErr) throw exErr;
        return;
      }
      if (access_token && refresh_token) {
        const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
        if (setErr) throw setErr;
        return;
      }
      throw new Error('Missing tokens in OAuth redirect');
    } catch (err: unknown) {
      Alert.alert('Sign-in failed', describe(err));
    } finally {
      setPending(null);
    }
  }

  // Dev-only anonymous sign-in. Wrapped in __DEV__ so it's stripped
  // out of production builds and only useful when running under
  // Expo Go where real OAuth flows are flaky.
  async function handleGuest() {
    setPending('guest');
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    } catch (err: unknown) {
      Alert.alert('Guest sign-in failed', describe(err));
    } finally {
      setPending(null);
    }
  }

  async function handleApple() {
    setPending('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const idToken = credential.identityToken;
      if (!idToken) throw new Error('Apple did not return an identity token');

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token:    idToken,
      });
      if (error) throw error;

      // Apple hands us the user's name — but ONLY on the very first
      // authorization, and only in this credential object (it is never
      // in the identity token). Capture it now or it is gone forever.
      // App Review guideline 4 requires that we do NOT then ask the
      // user to type a name onboarding already has.
      const appleName = [
        credential.fullName?.givenName?.trim(),
        credential.fullName?.familyName?.trim(),
      ].filter(Boolean).join(' ');

      const uid = data.user?.id;
      if (uid && appleName) {
        await persistAppleName(uid, appleName);
        // Refresh the store so onboarding sees the name and skips its
        // name step (loadForUser is serialized, so this lands after any
        // load already kicked off by the auth state change).
        await useAppStore.getState().loadForUser(uid);
      }
    } catch (err: unknown) {
      // Cancellation isn't an error worth surfacing.
      const code = (err as { code?: string }).code;
      if (code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert('Sign-in failed', describe(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={styles.hero}>
        <Text style={[styles.title, { color: theme.colors.primary, fontFamily: theme.fonts.heavy }]}>YourLevel</Text>
        <Text style={[styles.tagline, { color: theme.colors.secondary }]}>
          Self-improvement, gamified.
        </Text>
      </View>

      <View style={styles.actions}>
        {/* Sign in with Apple uses Apple's OWN native button component,
            which supplies the  logo, typography, corner radius and
            localized label. A custom-styled button is rejected under
            App Review guideline 4 (Design). It is listed first so it is
            never less prominent than other providers.
            The native button has no disabled prop, so the wrapper
            handles the busy state. */}
        {appleAvailable ? (
          <View
            style={[
              styles.appleWrap,
              { opacity: pending !== null && pending !== 'apple' ? 0.4 : 1 },
            ]}
            pointerEvents={pending !== null ? 'none' : 'auto'}
          >
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={14}
              style={styles.appleButton}
              onPress={handleApple}
            />
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={pending !== null}
          onPress={handleGoogle}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: theme.colors.primary,
              opacity: pending !== null && pending !== 'google' ? 0.4 : pressed ? 0.85 : 1,
            },
          ]}
        >
          {pending === 'google' ? (
            <ActivityIndicator color={theme.colors.background} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.colors.background }]}>
              Continue with Google
            </Text>
          )}
        </Pressable>

        {/* Dev-only escape hatch. __DEV__ strips this in production
            builds (EAS Build profile=production), so the App Store
            build never exposes anonymous sign-in. Useful when Expo
            Go's OAuth redirect dance breaks. */}
        {__DEV__ ? (
          <Pressable
            accessibilityRole="button"
            disabled={pending !== null}
            onPress={handleGuest}
            style={({ pressed }) => [
              styles.button,
              styles.guestButton,
              {
                borderColor: theme.colors.muted,
                opacity: pending !== null && pending !== 'guest' ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {pending === 'guest' ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <Text style={[styles.buttonText, { color: theme.colors.primary }]}>
                Continue as guest (dev)
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>

      <Text style={[styles.fine, { color: theme.colors.muted }]}>
        By continuing you agree to fewer bad habits and more wins.
      </Text>
    </SafeAreaView>
  );
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Stores the name Apple supplied on first sign-in.
 *
 * The profile row is created by a database trigger when the auth user
 * is inserted, which can land a moment after sign-in returns — hence
 * the short retry. `.is('username', null)` means a name the user has
 * already chosen is never overwritten.
 */
async function persistAppleName(userId: string, fullName: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ username: fullName })
      .eq('id', userId)
      .is('username', null)
      .select('id');
    if (!error && data && data.length > 0) return;
    if (error) console.warn('[login] could not save the Apple name', error);
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

const styles = StyleSheet.create({
  root:        { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingVertical: 48 },
  hero:        { alignItems: 'center', marginTop: 64 },
  title:       { fontSize: 44, fontWeight: '800', letterSpacing: 0.5 },
  tagline:     { fontSize: 16, marginTop: 8 },
  actions:     { gap: 12 },
  button:      { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  // Apple's native button is a real UIView: it needs explicit size.
  appleWrap:   { height: 52 },
  appleButton: { width: '100%', height: 52 },
  guestButton: { backgroundColor: 'transparent', borderWidth: 1 },
  buttonText:  { fontSize: 16, fontWeight: '600' },
  fine:        { fontSize: 12, textAlign: 'center' },
});
