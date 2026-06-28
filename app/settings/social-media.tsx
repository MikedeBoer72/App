// Social Media screen — "coming soon" placeholder.
//
// Real handles / videos aren't live yet, so this shows the platforms
// as a disabled list with a "coming soon" note rather than linking
// anywhere. Swap to real links + a tappable list once the accounts
// exist (the previous link/video structure is in git history).

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppStore } from '@/store/useAppStore';

const PLATFORMS: ReadonlyArray<{ icon: keyof typeof Ionicons.glyphMap; label: string }> = [
  { icon: 'logo-instagram', label: 'Instagram' },
  { icon: 'logo-tiktok',    label: 'TikTok' },
  { icon: 'logo-youtube',   label: 'YouTube' },
  { icon: 'logo-twitter',   label: 'X' },
];

export default function SocialMediaScreen() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);

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
        <Text style={[styles.title, { color: theme.colors.primary }]}>Social Media</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Ionicons name="megaphone-outline" size={64} color={theme.colors.accent} />
          <Text style={[styles.heroTitle, { color: theme.colors.primary, fontFamily: theme.fonts.bold }]}>
            Coming soon
          </Text>
          <Text style={[styles.heroBody, { color: theme.colors.secondary }]}>
            We're setting up our socials. Follow along soon for tips, updates, and behind-the-scenes.
          </Text>
        </View>

        <View style={[styles.group, { backgroundColor: theme.colors.surface }]}>
          {PLATFORMS.map((p, i) => (
            <View
              key={p.label}
              style={[
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.muted },
              ]}
            >
              <Ionicons name={p.icon} size={20} color={theme.colors.muted} style={styles.rowIcon} />
              <Text style={[styles.rowLabel, { color: theme.colors.secondary }]}>{p.label}</Text>
              <Text style={[styles.soon, { color: theme.colors.muted }]}>Soon</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1 },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:     { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  scroll:    { padding: 20, gap: 24 },
  hero:      { alignItems: 'center', gap: 10, marginTop: 24 },
  heroTitle: { fontSize: 24, fontWeight: '800' },
  heroBody:  { fontSize: 15, lineHeight: 22, textAlign: 'center', paddingHorizontal: 8 },
  group:     { borderRadius: 16, overflow: 'hidden' },
  row:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowIcon:   { width: 24 },
  rowLabel:  { flex: 1, fontSize: 15, fontWeight: '600' },
  soon:      { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
});
