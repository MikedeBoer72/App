// Social Media screen.
//
// Hardcoded link list + a few featured YouTube thumbnails. Replace
// the URLs / video IDs below with the real ones before you submit.

import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppStore } from '@/store/useAppStore';

// TODO: replace placeholders before App Store submission.
const LINKS: ReadonlyArray<{ icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap; label: string; url: string }> = [
  { icon: 'logo-instagram', label: 'Instagram', url: 'https://instagram.com/maxing.ai' },
  { icon: 'logo-twitter',   label: 'X',         url: 'https://x.com/maxingai' },
  { icon: 'logo-tiktok',    label: 'TikTok',    url: 'https://tiktok.com/@maxing.ai' },
  { icon: 'logo-youtube',   label: 'YouTube',   url: 'https://youtube.com/@maxingai' },
];

const VIDEOS: ReadonlyArray<{ id: string; title: string }> = [
  { id: 'dQw4w9WgXcQ', title: 'Why MAXING.ai exists' },
  { id: 'dQw4w9WgXcQ', title: 'Build a streak in 7 days' },
  { id: 'dQw4w9WgXcQ', title: 'Beating bad habits' },
];

export default function SocialMediaScreen() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);

  async function open(url: string) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error('Cannot open this URL');
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert('Could not open', err instanceof Error ? err.message : String(err));
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
        <Text style={[styles.title, { color: theme.colors.primary }]}>Social Media</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.sectionLabel, { color: theme.colors.secondary }]}>Follow us</Text>
        <View style={[styles.linkGroup, { backgroundColor: theme.colors.surface }]}>
          {LINKS.map((l, i) => (
            <Pressable
              key={l.label}
              accessibilityRole="link"
              onPress={() => open(l.url)}
              style={({ pressed }) => [
                styles.linkRow,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.muted },
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name={l.icon} size={20} color={theme.colors.primary} style={styles.linkIcon} />
              <Text style={[styles.linkLabel, { color: theme.colors.primary }]}>{l.label}</Text>
              <Ionicons name="open-outline" size={16} color={theme.colors.muted} />
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.secondary }]}>Featured videos</Text>
        <View style={styles.videos}>
          {VIDEOS.map((v) => (
            <Pressable
              key={v.title}
              accessibilityRole="button"
              onPress={() => open(`https://www.youtube.com/watch?v=${v.id}`)}
              style={({ pressed }) => [styles.video, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Image
                source={{ uri: `https://img.youtube.com/vi/${v.id}/hqdefault.jpg` }}
                style={[styles.thumb, { backgroundColor: theme.colors.surface }]}
              />
              <View style={styles.playOverlay}>
                <Ionicons name="play-circle" size={48} color="#FFFFFFEE" />
              </View>
              <Text style={[styles.videoTitle, { color: theme.colors.primary }]} numberOfLines={2}>
                {v.title}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  scroll:       { padding: 20, gap: 12 },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginTop: 8 },
  linkGroup:    { borderRadius: 16, overflow: 'hidden' },
  linkRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  linkIcon:     { width: 24 },
  linkLabel:    { flex: 1, fontSize: 15, fontWeight: '600' },
  videos:       { gap: 12 },
  video:        { gap: 6 },
  thumb:        { aspectRatio: 16 / 9, borderRadius: 12 },
  playOverlay:  { position: 'absolute', left: 0, right: 0, top: 0, bottom: 24, alignItems: 'center', justifyContent: 'center' },
  videoTitle:   { fontSize: 14, fontWeight: '600' },
});
