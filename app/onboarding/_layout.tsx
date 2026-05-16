import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  // No back gesture - onboarding can't be skipped.
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />;
}
