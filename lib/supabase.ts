// Supabase client for MAXING.ai.
//
// - URL polyfill is required for React Native's stripped-down URL impl.
// - AsyncStorage backs the auth session (survives app restarts).
// - autoRefreshToken keeps the JWT fresh in the background.
// - detectSessionInUrl is off: RN has no browser URL to parse.
//
// Run-time env validation throws a clear error during dev rather than
// failing later with a confusing "fetch failed" once a query runs.

import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.startsWith('your_')) {
    throw new Error(
      `Missing ${name}. Set it in .env (see .env.example) and restart Expo with --clear.`,
    );
  }
  return value;
}

const SUPABASE_URL      = requireEnv('EXPO_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON_KEY = requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage:           AsyncStorage,
    autoRefreshToken:  true,
    persistSession:    true,
    detectSessionInUrl: false,
  },
});

/** Convenience: returns the current user id or null. */
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
