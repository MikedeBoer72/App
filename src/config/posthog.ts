import PostHog from 'posthog-react-native';
import Constants from 'expo-constants';

const projectToken = Constants.expoConfig?.extra?.posthogProjectToken as string | undefined;
const host = (Constants.expoConfig?.extra?.posthogHost as string) || 'https://us.i.posthog.com';
const isPostHogConfigured = Boolean(projectToken && projectToken !== 'phc_your_project_token_here');

if (__DEV__) {
  console.log('PostHog config:', {
    projectToken: projectToken ? 'SET' : 'NOT SET',
    host,
    isConfigured: isPostHogConfigured,
  });
}

if (!isPostHogConfigured) {
  console.warn(
    'PostHog project token not configured. Set POSTHOG_PROJECT_TOKEN in your .env file.'
  );
}

export const posthog = new PostHog(projectToken || 'placeholder_key', {
  host,
  disabled: !isPostHogConfigured,
  captureAppLifecycleEvents: true,
  flushAt: 20,
  flushInterval: 10000,
  maxBatchSize: 100,
  maxQueueSize: 1000,
  preloadFeatureFlags: true,
  sendFeatureFlagEvent: true,
  featureFlagsRequestTimeoutMs: 10000,
  requestTimeout: 10000,
  fetchRetryCount: 3,
  fetchRetryDelay: 3000,
});
