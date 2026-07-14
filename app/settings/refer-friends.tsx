// Refer Friends screen.
//
// On mount we look for the user's referral row; if none exists we
// generate a short code and insert one. The code (not a URL) is what
// the friend enters in-app. Conversion + free-month accounting is a
// future server-side step once a subscription webhook exists.

import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';

// We don't own yourlevel.app, so the share points at the real App
// Store page (this is the ascAppId from eas.json). The referral code
// travels in the message text; the friend enters it in the app. The
// link 404s until the app is live, but it never sends people to a
// domain we don't control.
const APP_STORE_URL = 'https://apps.apple.com/app/id6782592411';

interface Stats {
  total:      number;
  converted:  number;
}

export default function ReferFriendsScreen() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);

  const [code, setCode] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, converted: 0 });
  const [busy, setBusy] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const uid = profile?.id;
    if (!uid) return;
    (async () => {
      try {
        // Look for an existing code for this user.
        const { data: existing } = await supabase
          .from('referrals')
          .select('referral_code')
          .eq('referrer_id', uid)
          .limit(1)
          .maybeSingle();

        let mine = existing?.referral_code ?? null;
        if (!mine) {
          mine = generateCode();
          const { error } = await supabase
            .from('referrals')
            .insert({ referrer_id: uid, referral_code: mine });
          if (error) {
            // Unique violation = race; refetch.
            const { data: again } = await supabase
              .from('referrals')
              .select('referral_code')
              .eq('referrer_id', uid)
              .limit(1)
              .maybeSingle();
            mine = again?.referral_code ?? null;
          }
        }
        setCode(mine);

        // Pull stats: every referral_code -> referred_id -> count.
        // We count rows where the referrer is the user and referred_id is set.
        const { count: total } = await supabase
          .from('referrals')
          .select('*', { count: 'exact', head: true })
          .eq('referrer_id', uid)
          .not('referred_id', 'is', null);
        const { count: converted } = await supabase
          .from('referrals')
          .select('*', { count: 'exact', head: true })
          .eq('referrer_id', uid)
          .eq('is_converted', true);
        setStats({ total: total ?? 0, converted: converted ?? 0 });
      } catch (err) {
        console.warn('refer-friends load failed', err);
      } finally {
        setBusy(false);
      }
    })();
  }, [profile?.id]);

  const shareMessage = code
    ? `Join me on YourLevel and level up your habits! Download: ${APP_STORE_URL} — and enter my referral code ${code} when you subscribe to get me a free month.`
    : '';

  async function copy() {
    if (!code) return;
    try {
      await Clipboard.setStringAsync(shareMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      Alert.alert('Could not copy', err instanceof Error ? err.message : String(err));
    }
  }

  async function share() {
    if (!code) return;
    try {
      await Share.share({
        message: shareMessage,
        url:     APP_STORE_URL,
      });
    } catch (err) {
      Alert.alert('Could not share', err instanceof Error ? err.message : String(err));
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
        <Text style={[styles.title, { color: theme.colors.primary }]}>Refer Friends</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.headline, { color: theme.colors.primary }]}>
          Refer Friends, Get 1 Free Month
        </Text>
        <Text style={[styles.copy, { color: theme.colors.secondary }]}>
          Share your code. When a friend downloads YourLevel and subscribes with it, your next month is on us.
        </Text>

        {/* Code card */}
        <View style={[styles.codeCard, { backgroundColor: theme.colors.surface }]}>
          {busy ? (
            <ActivityIndicator color={theme.colors.accent} />
          ) : (
            <>
              <Text style={[styles.codeLabel, { color: theme.colors.secondary }]}>YOUR CODE</Text>
              <Text style={[styles.code, { color: theme.colors.primary }]}>{code ?? '—'}</Text>
              <Text style={[styles.codeUrl, { color: theme.colors.muted }]} numberOfLines={1}>
                Friends enter this when they subscribe
              </Text>
            </>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            disabled={!code}
            onPress={copy}
            style={({ pressed }) => [
              styles.btn,
              {
                backgroundColor: copied ? theme.colors.success : theme.colors.surface,
                borderColor:     theme.colors.muted,
                opacity:         !code ? 0.4 : pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={18}
              color={copied ? theme.colors.background : theme.colors.primary}
            />
            <Text
              style={[
                styles.btnText,
                { color: copied ? theme.colors.background : theme.colors.primary },
              ]}
            >
              {copied ? 'Copied' : 'Copy'}
            </Text>
          </Pressable>

          <Pressable
            disabled={!code}
            onPress={share}
            style={({ pressed }) => [
              styles.btn,
              {
                backgroundColor: theme.colors.accent,
                borderColor:     'transparent',
                opacity:         !code ? 0.4 : pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="share-outline" size={18} color={theme.colors.background} />
            <Text style={[styles.btnText, { color: theme.colors.background }]}>Share</Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View style={[styles.statRow, { backgroundColor: theme.colors.surface }]}>
          <Stat label="Referred"  value={stats.total}     theme={theme} />
          <View style={[styles.statDivider, { backgroundColor: theme.colors.muted }]} />
          <Stat label="Converted" value={stats.converted} theme={theme} />
        </View>

        {/* How it works */}
        <Text style={[styles.howTitle, { color: theme.colors.primary }]}>How it works</Text>
        <Step n={1} text='Tap "Share" and send your code to a friend.'           theme={theme} />
        <Step n={2} text="Your friend downloads YourLevel and enters your code."      theme={theme} />
        <Step n={3} text="When they subscribe, your next month is free."         theme={theme} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, theme }: { label: string; value: number; theme: ReturnType<typeof useAppStore.getState>['theme'] }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: theme.colors.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.colors.secondary }]}>{label}</Text>
    </View>
  );
}

function Step({ n, text, theme }: { n: number; text: string; theme: ReturnType<typeof useAppStore.getState>['theme'] }) {
  return (
    <View style={styles.step}>
      <View style={[styles.stepNum, { backgroundColor: theme.colors.accent }]}>
        <Text style={[styles.stepNumText, { color: theme.colors.background }]}>{n}</Text>
      </View>
      <Text style={[styles.stepText, { color: theme.colors.primary }]}>{text}</Text>
    </View>
  );
}

function generateCode(): string {
  // 6-char alphanumeric, no ambiguous characters.
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

const styles = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  scroll:       { padding: 20, gap: 16 },
  headline:     { fontSize: 24, fontWeight: '800' },
  copy:         { fontSize: 14, lineHeight: 20 },
  codeCard:     { borderRadius: 16, padding: 24, alignItems: 'center', gap: 4 },
  codeLabel:    { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  code:         { fontSize: 36, fontWeight: '900', letterSpacing: 6, marginVertical: 4 },
  codeUrl:      { fontSize: 12 },
  actions:      { flexDirection: 'row', gap: 10 },
  btn:          { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 12, borderWidth: 1 },
  btnText:      { fontSize: 14, fontWeight: '700' },
  statRow:      { flexDirection: 'row', borderRadius: 16, paddingVertical: 16 },
  stat:         { flex: 1, alignItems: 'center', gap: 2 },
  statValue:    { fontSize: 28, fontWeight: '900' },
  statLabel:    { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  statDivider:  { width: StyleSheet.hairlineWidth },
  howTitle:     { fontSize: 16, fontWeight: '800', marginTop: 8 },
  step:         { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum:      { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepNumText:  { fontSize: 14, fontWeight: '800' },
  stepText:     { flex: 1, fontSize: 14, lineHeight: 22, paddingTop: 4 },
});
