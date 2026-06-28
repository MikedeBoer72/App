// Supabase client for YourLevel.
//
// - URL polyfill is required for React Native's stripped-down URL impl.
// - AsyncStorage backs the auth session (survives app restarts).
// - autoRefreshToken keeps the JWT fresh in the background.
// - detectSessionInUrl is off: RN has no browser URL to parse.
//
// IMPORTANT: env vars MUST be referenced statically as
// `process.env.EXPO_PUBLIC_*`. Expo's bundler does a literal
// find-and-replace to inline these at build time; a dynamic lookup
// like `process.env[name]` is NOT inlined and resolves to undefined
// in a production build (it only "works" in Expo Go because the dev
// server injects process.env at runtime). Spelling each name out is
// required.

import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Surfaced loudly in dev; in production this should never happen
  // because the values are inlined from eas.json `env` at build time.
  console.error(
    '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Set them in eas.json (build env) for production builds and .env for local dev.',
  );
}

export const supabase = createClient(SUPABASE_URL ?? '', SUPABASE_ANON_KEY ?? '', {
  auth: {
    storage:            AsyncStorage,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
  },
});

/** Convenience: returns the current user id or null. */
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
