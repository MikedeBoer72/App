// Single-screen "tabs" group. The spec doesn't actually use a bottom
// tab bar - the dashboard is the only top-level destination - so this
// is just a headerless Stack acting as a slot for the dashboard.

import { Stack } from 'expo-router';

export default function TabsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
