// Decorations picker. Mirrors the Fonts screen exactly: status
// resolves to active / available / needs-pro / locked; in __DEV__
// the level + pro gates are bypassed so every decoration is
// previewable.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DecorationLayer } from '@/components/DecorationLayer';
import { DECORATIONS, type Decoration } from '@/constants/decorations';
import { useAppStore } from '@/store/useAppStore';

type Status = 'active' | 'available' | 'needs-pro' | 'locked';

export default function DecorationsScreen() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);
  const setDecoration = useAppStore((s) => s.setDecoration);

  const level = profile?.level ?? 1;
  const subscribed = profile?.is_subscribed ?? false;
  const currentId = profile?.selected_decoration ?? 'none';

  const rows = useMemo(() => {
    return DECORATIONS.map((d) => {
      let status: Status;
      if (d.id === currentId)                  status = 'active';
      else if (level < d.unlockLevel)          status = 'locked';
      else if (d.isPaid && !subscribed)        status = 'needs-pro';
      else                                     status = 'available';
      return { decoration: d, status };
    });
  }, [currentId, level, subscribed]);

  function onPress(d: Decoration, status: Status) {
    if (status === 'active') return;
    if (status === 'locked') {
      Alert.alert('Locked', `Reach Level ${d.unlockLevel} to unlock ${d.name}.`);
      return;
    }
    if (status === 'needs-pro') {
      Alert.alert(
        'Pro decoration',
        `${d.name} unlocks at Level ${d.unlockLevel} and requires a Pro subscription.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'See subscription', onPress: () => router.push('/settings/subscription') },
        ],
      );
      return;
    }
    void setDecoration(d.id);
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
        <Text style={[styles.title, { color: theme.colors.primary }]}>Decorations</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {rows.map(({ decoration: d, status }) => (
          <Pressable
            key={d.id}
            accessibilityRole="button"
            onPress={() => onPress(d, status)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: status === 'active' ? theme.colors.accent : 'transparent',
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            {/* Live preview swatch in the user's current theme colors. */}
            <View style={[styles.preview, { backgroundColor: theme.colors.background }]}>
              <DecorationLayer
                id={d.id}
                accentColor={theme.colors.accent}
                mutedColor={theme.colors.muted}
                primaryColor={theme.colors.primary}
              />
            </View>

            <View style={styles.meta}>
              <View style={styles.titleRow}>
                <Text style={[styles.decoName, { color: theme.colors.primary }]} numberOfLines={1}>
                  {d.name}
                </Text>
                {d.isPaid ? (
                  <View style={[styles.badge, { backgroundColor: theme.colors.accent }]}>
                    <Text style={[styles.badgeText, { color: theme.colors.background }]}>PRO</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.desc, { color: theme.colors.secondary }]} numberOfLines={2}>
                {d.description}
              </Text>
              <Text style={[styles.statusText, { color: statusColor(status, theme.colors) }]}>
                {statusLabel(status, d.unlockLevel)}
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
  preview:     { width: 72, height: 72, borderRadius: 12, overflow: 'hidden' },
  meta:        { flex: 1, gap: 2 },
  titleRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  decoName:    { fontSize: 16, fontWeight: '700' },
  badge:       { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText:   { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  desc:        { fontSize: 12 },
  statusText:  { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 2, textTransform: 'uppercase' },
  iconCell:    { width: 24, alignItems: 'center', justifyContent: 'center' },
});
