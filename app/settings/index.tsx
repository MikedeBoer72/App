// Settings menu - 8 rows linking to sub-screens.

import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppStore } from '@/store/useAppStore';

type Row = {
  icon:    keyof typeof Ionicons.glyphMap;
  label:   string;
  href:    Href;
  destructive?: boolean;
};

const ROWS: readonly Row[] = [
  { icon: 'sparkles-outline',   label: 'Subscription',                    href: '/settings/subscription' },
  { icon: 'information-circle-outline', label: 'About',                   href: '/settings/about' },
  { icon: 'color-palette-outline', label: 'Fonts',                        href: '/settings/fonts' },
  { icon: 'time-outline',       label: 'Day Starting Time',               href: '/settings/day-start-time' },
  { icon: 'person-outline',     label: 'Account',                         href: '/settings/account' },
  { icon: 'share-social-outline', label: 'Social Media',                  href: '/settings/social-media' },
  { icon: 'gift-outline',       label: 'Refer Friends for 1 Free Month',  href: '/settings/refer-friends' },
  { icon: 'refresh-outline',    label: 'Start Over',                      href: '/settings/start-over', destructive: true },
] as const;

export default function SettingsMenu() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Ionicons name="chevron-back" size={26} color={theme.colors.primary} />
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.primary }]}>Settings</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* User card */}
        {profile ? (
          <View style={[styles.userCard, { backgroundColor: theme.colors.surface }]}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: theme.colors.accent },
              ]}
            >
              <Text style={[styles.avatarText, { color: theme.colors.background }]}>
                {(profile.username ?? '?').slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.userMeta}>
              <Text style={[styles.userName, { color: theme.colors.primary }]} numberOfLines={1}>
                {profile.username ?? 'Anonymous'}
              </Text>
              <Text style={[styles.userSub, { color: theme.colors.secondary }]}>
                Level {profile.level} · {profile.is_subscribed ? 'Pro' : 'Free'}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Rows */}
        <View style={[styles.group, { backgroundColor: theme.colors.surface }]}>
          {ROWS.map((row, i) => (
            <Pressable
              key={row.label}
              accessibilityRole="button"
              onPress={() => router.push(row.href)}
              style={({ pressed }) => [
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.muted },
                { opacity: pressed ? 0.5 : 1 },
              ]}
            >
              <Ionicons
                name={row.icon}
                size={20}
                color={row.destructive ? theme.colors.danger : theme.colors.secondary}
                style={styles.rowIcon}
              />
              <Text
                style={[
                  styles.rowLabel,
                  { color: row.destructive ? theme.colors.danger : theme.colors.primary },
                ]}
                numberOfLines={1}
              >
                {row.label}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:       { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  scroll:      { padding: 20, gap: 16 },
  userCard:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16 },
  avatar:      { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontSize: 20, fontWeight: '800' },
  userMeta:    { flex: 1, gap: 2 },
  userName:    { fontSize: 16, fontWeight: '700' },
  userSub:     { fontSize: 13 },
  group:       { borderRadius: 16, overflow: 'hidden' },
  row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowIcon:     { width: 24 },
  rowLabel:    { flex: 1, fontSize: 15, fontWeight: '600' },
});
