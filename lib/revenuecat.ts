// RevenueCat integration.
//
// Wraps the SDK with:
//   - Safe no-op fallbacks when the API key is missing / a placeholder
//     (so the app boots fine in Expo Go without a key in .env).
//   - try/catch on every native call (react-native-purchases is a
//     native module - in Expo Go it'll throw "Native module not
//     available"; we log + degrade rather than crash).
//   - Automatic sync to Supabase profile (is_subscribed +
//     subscription_expires_at) every time the customer info changes.
//
// Entitlement name and product id are conventions you'll mirror in
// RevenueCat dashboard + App Store Connect:
//   - Entitlement: "pro"
//   - Product:     "pro_monthly"

import Purchases, {
  type CustomerInfo,
  type PurchasesError,
  type PurchasesPackage,
} from 'react-native-purchases';

import { supabase } from './supabase';

/** Identifier of the entitlement to gate Pro features on. */
export const PRO_ENTITLEMENT_ID = 'pro';

/** Convention: monthly subscription product id (set this in App Store Connect). */
export const PRO_PRODUCT_ID = 'pro_monthly';

let configured = false;

/** Call once at app start. Safe to call again; we no-op on repeat. */
export function initRevenueCat(): void {
  if (configured) return;
  const key = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
  if (!key || key.startsWith('your_') || key.startsWith('test_')) {
    // No real key configured yet (or someone pasted a server/test key).
    // App still works - subscriptions just stay disabled.
    return;
  }
  try {
    Purchases.configure({ apiKey: key });
    configured = true;
  } catch (err) {
    console.warn('[revenuecat] configure failed (expected in Expo Go):', err);
  }
}

export function isRevenueCatConfigured(): boolean {
  return configured;
}

/** Associates the SDK with this Supabase user. Call after sign-in. */
export async function identifyRevenueCatUser(userId: string): Promise<void> {
  if (!configured) return;
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    await syncEntitlementToSupabase(userId, customerInfo);
  } catch (err) {
    console.warn('[revenuecat] logIn failed:', err);
  }
}

/** Call on sign-out so a future user on the same device starts fresh. */
export async function logOutRevenueCat(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch (err) {
    console.warn('[revenuecat] logOut failed:', err);
  }
}

/** Returns the packages on the current offering (usually just monthly). */
export async function getOfferingPackages(): Promise<PurchasesPackage[]> {
  if (!configured) return [];
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch (err) {
    console.warn('[revenuecat] getOfferings failed:', err);
    return [];
  }
}

export interface PurchaseResult {
  success:    boolean;
  cancelled:  boolean;
  error?:     string;
}

/** Triggers the App Store purchase sheet and syncs the result. */
export async function purchasePackage(
  pkg: PurchasesPackage,
  userId: string,
): Promise<PurchaseResult> {
  if (!configured) {
    return { success: false, cancelled: false, error: 'Purchases not configured' };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    await syncEntitlementToSupabase(userId, customerInfo);
    const success = !!customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
    return { success, cancelled: false };
  } catch (err) {
    const rcErr = err as PurchasesError & { userCancelled?: boolean };
    if (rcErr.userCancelled) {
      return { success: false, cancelled: true };
    }
    console.warn('[revenuecat] purchase failed:', err);
    return {
      success:   false,
      cancelled: false,
      error:     rcErr.message ?? String(err),
    };
  }
}

/** "Restore Purchases" entry point - required by App Store guidelines. */
export async function restorePurchases(userId: string): Promise<boolean> {
  if (!configured) return false;
  try {
    const customerInfo = await Purchases.restorePurchases();
    await syncEntitlementToSupabase(userId, customerInfo);
    return !!customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
  } catch (err) {
    console.warn('[revenuecat] restorePurchases failed:', err);
    return false;
  }
}

/**
 * Listens for entitlement changes (e.g. silent renewal, refund,
 * cross-device purchase) and syncs to Supabase automatically.
 * Returns a cleanup function to remove the listener.
 */
export function listenForEntitlementChanges(userId: string): () => void {
  if (!configured) return () => {};
  const listener = (customerInfo: CustomerInfo) => {
    void syncEntitlementToSupabase(userId, customerInfo);
  };
  try {
    Purchases.addCustomerInfoUpdateListener(listener);
  } catch (err) {
    console.warn('[revenuecat] addCustomerInfoUpdateListener failed:', err);
    return () => {};
  }
  return () => {
    try {
      Purchases.removeCustomerInfoUpdateListener(listener);
    } catch {
      // ignore
    }
  };
}

async function syncEntitlementToSupabase(
  userId: string,
  customerInfo: CustomerInfo,
): Promise<void> {
  const active = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
  const isSubscribed = !!active;
  const expiresAt = active?.expirationDate ?? null;

  try {
    await supabase
      .from('profiles')
      .update({
        is_subscribed:           isSubscribed,
        subscription_expires_at: expiresAt,
      })
      .eq('id', userId);
  } catch (err) {
    console.warn('[revenuecat] sync to supabase failed:', err);
  }
}
