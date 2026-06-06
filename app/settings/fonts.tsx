// Fonts (themes) screen.
//
// Each row resolves to one of four states:
//   - active:        currently selected
//   - available:     level >= unlock AND (free OR subscribed)
//   - needs-pro:     level >= unlock, paid theme, not subscribed
//   - locked:        level < unlock
//
// Tapping an `available` theme applies it immediately via setTheme.
// `needs-pro` routes to the subscription paywall. `locked` shows
// a one-line hint.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { THEMES, type Theme } from '@/constants/themes';
import { useAppStore } from '@/store/useAppStore';

type Status = 'active' | 'available' | 'needs-pro' | 'locked';

export default function FontsScreen() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);
  const setTheme = useAppStore((s) => s.setTheme);

  const level = profile?.level ?? 1;
  const subscribed = profile?.is_subscribed ?? false;

  const rows = useMemo(() => {
    return THEMES.map((t) => {
      let status: Status;
      if (t.id === theme.id)                  status = 'active';
      else if (level < t.unlockLevel)         status = 'locked';
      else if (t.isPaid && !subscribed)       status = 'needs-pro';
      else                                    status = 'available';
      return { theme: t, status };
    });
  }, [theme.id, level, subscribed]);

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

      <ScrollView contentContainerStyle={styles.scroll}>
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
                {statusLabel(status, t.unlockLevel)}
              </Text>
            </View>

            <View style={styles.iconCell}>
              {status === 'active'    ? <Ionicons name="checkmark-circle" size={22} color={theme.colors.accent}  /> : null}
              {status === 'locked'    ? <Ionicons name="lock-closed"      size={20} color={theme.colors.muted}   /> : null}
              {status === 'needs-pro' ? <Ionicons name="sparkles"          size={20} color={theme.colors.accent}  /> : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function statusLabel(status: Status, unlockLevel: number): string {
  switch (status) {
    case 'active':    return 'Active';
    case 'available': return 'Tap to use';
    case 'needs-pro': return 'Unlocked - requires Pro';
    case 'locked':    return `Unlocks at Level ${unlockLevel}`;
  }
}

function statusColor(status: Status, colors: ReturnType<typeof useAppStore.getState>['theme']['colors']): string {
  switch (status) {
    case 'active':    return colors.accent;
    case 'available': return colors.success;
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
