// Subscription paywall.
//
// Loads RevenueCat offerings on mount and renders the available
// packages with their localized price strings. The Subscribe button
// opens the App Store purchase sheet; on success the entitlement is
// synced back to Supabase and profile.is_subscribed flips.
//
// Cancel is intentionally an "open App Store subscriptions" deep
// link rather than a button in-app - Apple requires cancellation to
// go through the App Store.

import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PurchasesPackage } from 'react-native-purchases';

import {
  getOfferingPackages,
  isRevenueCatConfigured,
  purchasePackage,
  restorePurchases,
} from '@/lib/revenuecat';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';

const APP_STORE_MANAGE_SUBS_URL = 'https://apps.apple.com/account/subscriptions';

export default function SubscriptionScreen() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const configured = isRevenueCatConfigured();
  const isSubscribed = profile?.is_subscribed ?? false;
  const expiresAt = profile?.subscription_expires_at
    ? new Date(profile.subscription_expires_at)
    : null;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const pkgs = await getOfferingPackages();
      setPackages(pkgs);
      setLoading(false);
    })();
  }, []);

  async function onBuy(pkg: PurchasesPackage) {
    if (!profile) return;
    setBuyingId(pkg.identifier);
    const result = await purchasePackage(pkg, profile.id);
    setBuyingId(null);

    if (result.success) {
      // Reload profile so the dashboard / guard see the new is_subscribed.
      await useAppStore.getState().loadForUser(profile.id);
      // RevenueCat confirmed the entitlement. If the Supabase write is
      // lagging (network blip), the stale refetch must not re-lock a
      // paying user behind the paywall — assert it in the live store.
      const st = useAppStore.getState();
      if (st.profile && !st.profile.is_subscribed) {
        useAppStore.setState({
          profile:      { ...st.profile, is_subscribed: true },
          isSubscribed: true,
        });
      }
      Alert.alert('Welcome to Pro', 'Thanks for supporting YourLevel.');
    } else if (!result.cancelled && result.error) {
      Alert.alert('Purchase failed', result.error);
    }
  }

  async function onRestore() {
    if (!profile) return;
    setRestoring(true);
    const ok = await restorePurchases(profile.id);
    if (ok) await useAppStore.getState().loadForUser(profile.id);
    setRestoring(false);
    Alert.alert(
      ok ? 'Restored' : 'Nothing to restore',
      ok
        ? 'Your Pro subscription is active on this device again.'
        : 'No active purchases found for the Apple ID signed in to the App Store on this device.',
    );
  }

  function openManage() {
    void Linking.openURL(APP_STORE_MANAGE_SUBS_URL).catch(() => {
      Alert.alert(
        'Cannot open',
        'Open the App Store app, tap your profile, then Subscriptions to manage.',
      );
    });
  }

  async function onSignOut() {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      Alert.alert('Sign out failed', err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Ionicons name="chevron-back" size={26} color={theme.colors.primary} />
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.primary }]}>Subscription</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Status pill */}
        <View
          style={[
            styles.status,
            {
              backgroundColor: theme.colors.surface,
              borderColor: isSubscribed ? theme.colors.accent : theme.colors.muted,
            },
          ]}
        >
          <Text style={[styles.statusKicker, { color: theme.colors.secondary }]}>STATUS</Text>
          <Text style={[styles.statusValue, { color: theme.colors.primary }]}>
            {isSubscribed ? 'Pro' : 'Free'}
          </Text>
          {isSubscribed && expiresAt ? (
            <Text style={[styles.statusSub, { color: theme.colors.secondary }]}>
              Active until {expiresAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </Text>
          ) : null}
        </View>

        {/* What you get */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.primary }]}>What you get with Pro</Text>
          <Bullet color={theme.colors.secondary}>Continue leveling past Level 5</Bullet>
          <Bullet color={theme.colors.secondary}>Unlock every theme at its milestone</Bullet>
          <Bullet color={theme.colors.secondary}>Premium fonts (Green Vibes and future themes)</Bullet>
          <Bullet color={theme.colors.secondary}>Everything we ship from here on</Bullet>
        </View>

        {/* Plans */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : packages.length === 0 ? (
          __DEV__ ? (
            // Visual-only mock used in Expo Go so the App Store
            // review screenshot shows the price and the call-to-
            // action. Tap is intentionally inert; real builds use
            // RevenueCat-loaded packages above this branch.
            <View
              style={[
                styles.plan,
                { backgroundColor: theme.colors.accent, opacity: 0.95 },
              ]}
            >
              <Text style={[styles.planText, { color: theme.colors.background }]}>
                Subscribe — $7.99 / monthly
              </Text>
            </View>
          ) : (
            <View style={[styles.unavailable, { backgroundColor: theme.colors.surface }]}>
              <Ionicons name="cloud-offline-outline" size={20} color={theme.colors.muted} />
              <Text style={[styles.unavailableText, { color: theme.colors.secondary }]}>
                {configured
                  ? 'No subscription products available yet. Set up the product in App Store Connect and offering in RevenueCat.'
                  : 'Subscriptions unavailable. RevenueCat is not configured for this build (Expo Go does not include native modules; this works in EAS builds).'}
              </Text>
            </View>
          )
        ) : (
          packages.map((pkg) => (
            <Pressable
              key={pkg.identifier}
              accessibilityRole="button"
              disabled={buyingId !== null || isSubscribed}
              onPress={() => onBuy(pkg)}
              style={({ pressed }) => [
                styles.plan,
                {
                  backgroundColor: theme.colors.accent,
                  opacity: isSubscribed ? 0.4 : buyingId !== null && buyingId !== pkg.identifier ? 0.4 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {buyingId === pkg.identifier ? (
                <ActivityIndicator color={theme.colors.background} />
              ) : (
                <Text style={[styles.planText, { color: theme.colors.background }]}>
                  {isSubscribed
                    ? `Subscribed — ${pkg.product.priceString} / ${pkg.packageType.toLowerCase()}`
                    : `Subscribe — ${pkg.product.priceString} / ${pkg.packageType.toLowerCase()}`}
                </Text>
              )}
            </Pressable>
          ))
        )}

        {/* Manage / restore */}
        <View style={styles.footerActions}>
          {isSubscribed ? (
            <Pressable
              onPress={openManage}
              style={({ pressed }) => [
                styles.ghost,
                { borderColor: theme.colors.muted, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.ghostText, { color: theme.colors.primary }]}>
                Manage in App Store
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            disabled={restoring}
            onPress={onRestore}
            style={({ pressed }) => [
              styles.ghost,
              { borderColor: theme.colors.muted, opacity: restoring ? 0.6 : pressed ? 0.6 : 1 },
            ]}
          >
            {restoring ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <Text style={[styles.ghostText, { color: theme.colors.primary }]}>
                Restore purchases
              </Text>
            )}
          </Pressable>
        </View>

        {/* If the user got bounced here by the paywall guard, give them
            a way out (sign out) so they're never trapped. */}
        {!isSubscribed && (profile?.level ?? 1) >= 5 ? (
          <Pressable
            onPress={onSignOut}
            style={({ pressed }) => [
              styles.signOut,
              { borderColor: theme.colors.muted, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[styles.signOutText, { color: theme.colors.primary }]}>Sign out</Text>
          </Pressable>
        ) : null}

        <Text style={[styles.legal, { color: theme.colors.muted }]}>
          Payment is charged to your Apple ID and renews automatically unless cancelled at least 24
          hours before the end of the current period. Manage or cancel anytime in Settings → Apple
          ID → Subscriptions.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Bullet({ children, color }: { children: string; color: string }) {
  return <Text style={[styles.bullet, { color }]}>{`•  ${children}`}</Text>;
}

const styles = StyleSheet.create({
  root:           { flex: 1 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn:        { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:          { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  scroll:         { padding: 20, gap: 16 },
  status:         { borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1 },
  statusKicker:   { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  statusValue:    { fontSize: 32, fontWeight: '900', marginVertical: 4 },
  statusSub:      { fontSize: 12 },
  card:           { borderRadius: 16, padding: 20, gap: 6 },
  cardTitle:      { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  bullet:         { fontSize: 14, lineHeight: 22 },
  center:         { paddingVertical: 24, alignItems: 'center' },
  unavailable:    { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 12 },
  unavailableText:{ flex: 1, fontSize: 13, lineHeight: 18 },
  plan:           { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  planText:       { fontSize: 16, fontWeight: '700' },
  footerActions:  { gap: 10 },
  ghost:          { height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ghostText:      { fontSize: 14, fontWeight: '700' },
  signOut:        { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, borderWidth: 1, marginTop: 16 },
  signOutText:    { fontSize: 14, fontWeight: '600' },
  legal:          { fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 12 },
});
