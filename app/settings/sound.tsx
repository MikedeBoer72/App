// Sound settings: two device-level toggles.
//
//   Sound effects — taps, task-complete chime, level-up fanfare.
//   Music — a chill ambient loop that plays while the app is open.
//
// Both persist in AsyncStorage via lib/sound.ts; nothing touches the
// server profile. Toggling effects plays a sample so the user hears
// the change immediately.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getMusicEnabled,
  getSfxEnabled,
  initSound,
  play,
  setMusicEnabled,
  setSfxEnabled,
} from '@/lib/sound';
import { useAppStore } from '@/store/useAppStore';

export default function SoundScreen() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);

  const [sfx, setSfx] = useState(getSfxEnabled());
  const [music, setMusic] = useState(getMusicEnabled());

  useEffect(() => {
    void initSound().then(() => {
      setSfx(getSfxEnabled());
      setMusic(getMusicEnabled());
    });
  }, []);

  async function toggleSfx(next: boolean) {
    setSfx(next);
    await setSfxEnabled(next);
    if (next) play('complete'); // audible confirmation
  }

  async function toggleMusic(next: boolean) {
    setMusic(next);
    await setMusicEnabled(next);
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
        <Text style={[styles.title, { color: theme.colors.primary }]}>Sound</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.body}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Row
            title="Sound effects"
            subtitle="Taps, completions, level-ups."
            value={sfx}
            onChange={toggleSfx}
            theme={theme}
          />
          <View style={[styles.divider, { backgroundColor: theme.colors.muted }]} />
          <Row
            title="Music"
            subtitle="A chill loop while the app is open."
            value={music}
            onChange={toggleMusic}
            theme={theme}
          />
        </View>
        <Text style={[styles.note, { color: theme.colors.muted }]}>
          Sounds respect your phone's silent switch.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function Row({
  title,
  subtitle,
  value,
  onChange,
  theme,
}: {
  title:    string;
  subtitle: string;
  value:    boolean;
  onChange: (v: boolean) => void;
  theme:    ReturnType<typeof useAppStore.getState>['theme'];
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.colors.primary }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: theme.colors.secondary }]}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.colors.muted, true: theme.colors.accent }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1 },
  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:    { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  body:     { padding: 20, gap: 12 },
  card:     { borderRadius: 16, paddingHorizontal: 16 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14 },
  rowText:  { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  rowSub:   { fontSize: 13 },
  divider:  { height: StyleSheet.hairlineWidth },
  note:     { fontSize: 12, textAlign: 'center' },
});
