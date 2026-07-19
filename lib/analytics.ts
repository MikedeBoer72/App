// PostHog analytics — thin, crash-proof wrapper.
//
// Everything is a silent no-op until EXPO_PUBLIC_POSTHOG_KEY is set
// (eas.json), so the app behaves identically with analytics off.
// Events are the minimum needed to see the funnel:
//   app_open, onboarding_completed, tutorial_finished, task_completed,
//   bad_habit_logged, level_up, font_applied, map_opened, share_card,
//   subscribe_success, referral_redeemed

import PostHog from 'posthog-react-native';

let client: PostHog | null = null;

export function initAnalytics(): void {
  if (client) return;
  const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!key || key.length < 10 || key.startsWith('your_')) return;
  try {
    client = new PostHog(key, { host: 'https://us.i.posthog.com' });
  } catch (err) {
    console.warn('[analytics] init failed', err);
    client = null;
  }
}

/** Tie events to the Supabase user id (call after sign-in). */
export function identifyUser(userId: string): void {
  try {
    client?.identify(userId);
  } catch {
    // never let analytics break the app
  }
}

/** Clear identity on sign-out. */
export function resetAnalytics(): void {
  try {
    client?.reset();
  } catch {
    // ignore
  }
}

export function track(event: string, props?: Record<string, string | number | boolean>): void {
  try {
    client?.capture(event, props);
  } catch {
    // ignore
  }
}
