// About screen - the story of the app.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppStore } from '@/store/useAppStore';

export default function AboutScreen() {
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
        <Text style={[styles.title, { color: theme.colors.primary }]}>About</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.brand, { color: theme.colors.primary }]}>YourLevel</Text>
        <Text style={[styles.tagline, { color: theme.colors.secondary }]}>
          Self-improvement, gamified.
        </Text>

        <Paragraph theme={theme}>
          YourLevel turns daily self-improvement into a game. Pick the habits that matter to you,
          track the bad habits you want to drop, and earn XP for every win.
        </Paragraph>

        <Paragraph theme={theme}>
          The goal is simple: stack levels, stack streaks, stack discipline. The longer you keep
          going, the more the app rewards you - new tier names, new fonts, bigger streak bonuses.
        </Paragraph>

        <Paragraph theme={theme}>
          Built by one person with one belief: if you can make self-improvement feel like a game,
          you'll actually keep playing.
        </Paragraph>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/settings/social-media')}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: theme.colors.accent, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons name="share-social-outline" size={18} color={theme.colors.background} />
          <Text style={[styles.ctaText, { color: theme.colors.background }]}>
            Follow us on Social Media
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Paragraph({ children, theme }: { children: string; theme: ReturnType<typeof useAppStore.getState>['theme'] }) {
  return (
    <Text style={[styles.paragraph, { color: theme.colors.primary }]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1 },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:     { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  scroll:    { padding: 24, gap: 16 },
  brand:     { fontSize: 32, fontWeight: '900', letterSpacing: 0.5 },
  tagline:   { fontSize: 16, marginBottom: 12 },
  paragraph: { fontSize: 15, lineHeight: 22 },
  cta:       { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 14, marginTop: 16 },
  ctaText:   { fontSize: 15, fontWeight: '700' },
});
