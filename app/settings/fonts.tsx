// Fonts (themes) screen.
//
// Each row resolves to one of five states:
//   - active:        currently selected
//   - available:     level >= unlock AND (free OR subscribed)
//   - trial:         NOT owned, but the 24h font TEST DRIVE is on —
//                    selectable with a countdown
//   - needs-pro:     level >= unlock, paid theme, not subscribed
//   - locked:        level < unlock
//
// Tapping `available` or `trial` applies the theme via setTheme.
// `needs-pro` routes to the subscription paywall. `locked` shows
// a one-line hint. When the test drive lapses, the store's load
// guard reverts an un-owned selection automatically.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { THEMES, type Theme } from '@/constants/themes';
import { formatTrialTimeLeft, getFontTrial } from '@/lib/trial';
import { useAppStore } from '@/store/useAppStore';

type Status = 'active' | 'available' | 'trial' | 'needs-pro' | 'locked';

export default function FontsScreen() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);
  const setTheme = useAppStore((s) => s.setTheme);

  const level = profile?.level ?? 1;
  const subscribed = profile?.is_subscribed ?? false;

  // Re-evaluate the countdown every 30s while the screen is open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const trial = useMemo(() => getFontTrial(profile), [profile, now]);

  const rows = useMemo(() => {
    return THEMES.map((t) => {
      let status: Status;
      if (t.id === theme.id)                  status = 'active';
      else if (level < t.unlockLevel)         status = trial.active ? 'trial' : 'locked';
      else if (t.isPaid && !subscribed)       status = trial.active ? 'trial' : 'needs-pro';
      else                                    status = 'available';
      return { theme: t, status };
    });
  }, [theme.id, level, subscribed, trial.active]);

  function onPress(t: Theme, status: Status) {
    if (status === 'active') return;
    if (status === 'locked') {
      Alert.alert('Locked', `Reach Level ${t.unlockLevel} to unlock ${t.name}.`);
      return;
    }
    if (status === 'needs-pro') {
      Alert.alert(
        'Pro theme',
        `${t.name} unlocks at Level ${t.unlockLevel} and requires a Pro subscription.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'See subscription', onPress: () => router.push('/settings/subscription') },
        ],
      );
      return;
    }
    // `available` and `trial` both apply immediately.
    void setTheme(t.id);
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
        <Text style={[styles.title, { color: theme.colors.primary }]}>Fonts</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {trial.active ? (
          <View style={[styles.trialCard, { backgroundColor: theme.colors.accent }]}>
            <Text style={[styles.trialTitle, { color: theme.colors.background }]}>
              🚀 TEST DRIVE — every font unlocked
            </Text>
            <Text style={[styles.trialBody, { color: theme.colors.background }]}>
              Try them all. {formatTrialTimeLeft(trial.msLeft)} left — after that you keep what
              you’ve earned and unlock the rest by leveling up.
            </Text>
          </View>
        ) : null}
        {rows.map(({ theme: t, status }) => (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            onPress={() => onPress(t, status)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: status === 'active' ? theme.colors.accent : 'transparent',
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            {/* Preview swatch */}
            <View style={[styles.swatch, { backgroundColor: t.colors.background }]}>
              <View style={[styles.swatchBar, { backgroundColor: t.colors.accent }]} />
              <Text
                style={{
                  color:        t.colors.primary,
                  fontFamily:   t.fonts.bold,
                  fontSize:     16,
                }}
              >
                Aa
              </Text>
            </View>

            <View style={styles.meta}>
              <View style={styles.titleRow}>
                <Text style={[styles.themeName, { color: theme.colors.primary }]} numberOfLines={1}>
                  {t.name}
                </Text>
                {t.isPaid ? (
                  <View style={[styles.badge, { backgroundColor: theme.colors.accent }]}>
                    <Text style={[styles.badgeText, { color: theme.colors.background }]}>PRO</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.desc, { color: theme.colors.secondary }]} numberOfLines={2}>
                {t.description}
              </Text>
              <Text style={[styles.desc, { color: theme.colors.muted, fontFamily: t.fonts.regular }]} numberOfLines={1}>
                Font: {t.fontLabel}
              </Text>
              <Text style={[styles.statusText, { color: statusColor(status, theme.colors) }]}>
                {statusLabel(status, t.unlockLevel, trial.msLeft)}
              </Text>
            </View>

            <View style={styles.iconCell}>
              {status === 'active'    ? <Ionicons name="checkmark-circle" size={22} color={theme.colors.accent}  /> : null}
              {status === 'locked'    ? <Ionicons name="lock-closed"      size={20} color={theme.colors.muted}   /> : null}
              {status === 'trial'     ? <Ionicons name="rocket"           size={20} color={theme.colors.accent}  /> : null}
              {status === 'needs-pro' ? <Ionicons name="sparkles"          size={20} color={theme.colors.accent}  /> : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function statusLabel(status: Status, unlockLevel: number, trialMsLeft: number): string {
  switch (status) {
    case 'active':    return 'Active';
    case 'available': return 'Tap to use';
    case 'trial':     return `Test drive — ${formatTrialTimeLeft(trialMsLeft)} left`;
    case 'needs-pro': return 'Unlocked - requires Pro';
    case 'locked':    return `Unlocks at Level ${unlockLevel}`;
  }
}

function statusColor(status: Status, colors: ReturnType<typeof useAppStore.getState>['theme']['colors']): string {
  switch (status) {
    case 'active':    return colors.accent;
    case 'available': return colors.success;
    case 'trial':     return colors.accent;
    case 'needs-pro': return colors.accent;
    case 'locked':    return colors.muted;
  }
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:       { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  scroll:      { padding: 20, gap: 12 },
  trialCard:   { borderRadius: 16, padding: 16, gap: 4 },
  trialTitle:  { fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  trialBody:   { fontSize: 12.5, lineHeight: 18, opacity: 0.9 },
  card:        { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, borderWidth: 2 },
  swatch:      { width: 64, height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  swatchBar:   { position: 'absolute', bottom: 8, height: 3, width: 24, borderRadius: 2 },
  meta:        { flex: 1, gap: 2 },
  titleRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  themeName:   { fontSize: 16, fontWeight: '700' },
  badge:       { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText:   { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  desc:        { fontSize: 12 },
  statusText:  { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 2, textTransform: 'uppercase' },
  iconCell:    { width: 24, alignItems: 'center', justifyContent: 'center' },
});
