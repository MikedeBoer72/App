// Login screen. Two OAuth paths:
//
//   - Google: Supabase signInWithOAuth + expo-web-browser. The user
//     only needs to flip on the Google provider in the Supabase Auth
//     dashboard - Supabase issues the redirect URL itself.
//
//   - Apple: native expo-apple-authentication. Returns an identity
//     token that's exchanged for a Supabase session via
//     signInWithIdToken. Requires Apple Developer setup + an Apple
//     provider configured in Supabase. Wired but won't work until
//     that's set up - currently scaffolded only.

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

  // Dev helper: print the exact OAuth redirect URI so it can be
  // copy-pasted into Supabase's allowed Redirect URLs. Remove with
  // the guest button before release. Look for this line in the
  // Expo / Metro terminal.
  useEffect(() => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(
        '\n=== Supabase Redirect URL to allowlist ===\n' +
          Linking.createURL('auth-callback') +
          '\n==========================================\n',
      );
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

  // TODO: remove before App Store submission. Gated by __DEV__ so it
  // auto-hides in production builds even if we forget.
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

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token:    idToken,
      });
      if (error) throw error;
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
        <Text style={[styles.title, { color: theme.colors.primary }]}>YourLevel</Text>
        <Text style={[styles.tagline, { color: theme.colors.secondary }]}>
          Self-improvement, gamified.
        </Text>
      </View>

      <View style={styles.actions}>
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

        {appleAvailable ? (
          <Pressable
            accessibilityRole="button"
            disabled={pending !== null}
            onPress={handleApple}
            style={({ pressed }) => [
              styles.button,
              styles.appleButton,
              {
                opacity: pending !== null && pending !== 'apple' ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {pending === 'apple' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                Continue with Apple
              </Text>
            )}
          </Pressable>
        ) : null}

        {/* TODO: remove before App Store submission. __DEV__ hides it in
            production builds even if forgotten. Requires anonymous
            sign-ins to be enabled in Supabase Auth settings. */}
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

const styles = StyleSheet.create({
  root:        { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingVertical: 48 },
  hero:        { alignItems: 'center', marginTop: 64 },
  title:       { fontSize: 44, fontWeight: '800', letterSpacing: 0.5 },
  tagline:     { fontSize: 16, marginTop: 8 },
  actions:     { gap: 12 },
  button:      { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  appleButton: { backgroundColor: '#000000', borderWidth: StyleSheet.hairlineWidth, borderColor: '#FFFFFF22' },
  guestButton: { backgroundColor: 'transparent', borderWidth: 1 },
  buttonText:  { fontSize: 16, fontWeight: '600' },
  fine:        { fontSize: 12, textAlign: 'center' },
});
