// The Journey — YourLevel's world map.
//
// A vertical mountain: the summit (last theme world) at the top, the
// starting world at the bottom. Each world card is rendered in ITS
// OWN theme identity (background, heavy font, accent). Decorations
// appear as small nodes on the path between worlds — "???" until
// reached. The player's current world carries a glowing YOU ARE HERE
// marker and a progress bar toward the next gate.
//
// States, per card:
//   conquered  — full color, subtle check
//   current    — full color + marker + progress to the next world
//   next       — full color (deliberate tease), "N levels to go"
//   fogged     — dark fog overlay + lock (everything past `next`)
//
// Auto-scrolls to the player's world on mount.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getTheme, type ThemeId } from '@/constants/themes';
import { getJourneyTimeline, type JourneyItem } from '@/lib/unlocks';
import { useAppStore } from '@/store/useAppStore';

type WorldStatus = 'conquered' | 'current' | 'next' | 'fogged';

export default function MapScreen() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);

  const scrollRef = useRef<ScrollView>(null);
  const [currentY, setCurrentY] = useState<number | null>(null);

  const level = profile?.level ?? 1;

  // Timeline descending: summit first. Also precompute world gates for
  // status/progress math.
  const { itemsDescending, currentWorldId, nextWorldGate, currentWorldGate } = useMemo(() => {
    const asc = getJourneyTimeline();
    const worldGates = asc.filter((i) => i.kind === 'world').map((i) => i.level);
    const currentGate = Math.max(...worldGates.filter((g) => g <= level), 1);
    const nextGate = worldGates.find((g) => g > level) ?? null;
    const current = [...asc].reverse().find((i) => i.kind === 'world' && i.level === currentGate);
    return {
      itemsDescending:  [...asc].reverse(),
      currentWorldId:   current?.id ?? 'default',
      nextWorldGate:    nextGate,
      currentWorldGate: currentGate,
    };
  }, [level]);

  // Scroll so the player's world sits comfortably in view.
  useEffect(() => {
    if (currentY == null) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, currentY - 180), animated: false });
    }, 80);
    return () => clearTimeout(t);
  }, [currentY]);

  function worldStatus(item: JourneyItem): WorldStatus {
    if (item.level <= level) return item.id === currentWorldId ? 'current' : 'conquered';
    if (nextWorldGate != null && item.level === nextWorldGate) return 'next';
    return 'fogged';
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
        <Text style={[styles.title, { color: theme.colors.primary, fontFamily: theme.fonts.bold }]}>
          The Journey
        </Text>
        <View style={[styles.levelChip, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.levelChipText, { color: theme.colors.accent }]}>LV {level}</Text>
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        {/* Beyond the summit */}
        <Text style={[styles.beyond, { color: theme.colors.muted }]}>
          ··· the journey continues ···
        </Text>

        {itemsDescending.map((item) => {
          if (item.kind === 'decoration') {
            const unlocked = item.level <= level;
            return (
              <View key={`d-${item.id}`} style={styles.decoWrap}>
                <View style={[styles.pathLine, { backgroundColor: theme.colors.muted }]} />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (unlocked) router.push('/settings/decorations');
                    else Alert.alert('Mystery unlock', `Reach Level ${item.level} to reveal it.`);
                  }}
                  style={({ pressed }) => [
                    styles.decoNode,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: unlocked ? theme.colors.accent : theme.colors.muted,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.decoText, { color: unlocked ? theme.colors.accent : theme.colors.muted }]}>
                    {unlocked ? `✨ ${item.name}` : '✨ ???'} · LV {item.level}
                  </Text>
                </Pressable>
                <View style={[styles.pathLine, { backgroundColor: theme.colors.muted }]} />
              </View>
            );
          }

          const worldTheme = getTheme(item.id as ThemeId);
          const status = worldStatus(item);
          const isCurrent = status === 'current';
          const gateSpan =
            isCurrent && nextWorldGate != null
              ? Math.max(1, nextWorldGate - currentWorldGate)
              : null;
          const frac =
            gateSpan != null ? Math.min(1, (level - currentWorldGate) / gateSpan) : null;

          return (
            <Pressable
              key={`w-${item.id}`}
              accessibilityRole="button"
              onLayout={
                isCurrent
                  ? (e) => setCurrentY(e.nativeEvent.layout.y)
                  : undefined
              }
              onPress={() => {
                if (status === 'fogged') {
                  Alert.alert(item.name, `Reach Level ${item.level} to enter this world.`);
                } else {
                  router.push('/settings/fonts');
                }
              }}
              style={({ pressed }) => [
                styles.world,
                {
                  backgroundColor: worldTheme.colors.background,
                  borderColor: isCurrent ? worldTheme.colors.accent : 'transparent',
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.worldRow}>
                <View style={styles.worldText}>
                  <Text style={[styles.worldGate, { color: worldTheme.colors.secondary }]}>
                    {status === 'next'
                      ? `NEXT · ${item.level - level} LEVEL${item.level - level === 1 ? '' : 'S'} TO GO`
                      : `LV ${item.level}`}
                  </Text>
                  <Text
                    style={[
                      styles.worldName,
                      { color: worldTheme.colors.accent, fontFamily: worldTheme.fonts.heavy },
                    ]}
                    numberOfLines={1}
                  >
                    {item.name.toUpperCase()}
                  </Text>
                </View>
                {status === 'conquered' ? (
                  <Ionicons name="checkmark-circle" size={22} color={worldTheme.colors.accent} />
                ) : null}
                {status === 'fogged' ? (
                  <Ionicons name="lock-closed" size={18} color="#FFFFFF88" />
                ) : null}
              </View>

              {isCurrent ? (
                <View style={styles.hereWrap}>
                  <View style={[styles.hereChip, { backgroundColor: worldTheme.colors.accent }]}>
                    <Text style={[styles.hereText, { color: worldTheme.colors.background }]}>
                      YOU ARE HERE · LV {level}
                    </Text>
                  </View>
                  {frac != null ? (
                    <View style={[styles.hereTrack, { backgroundColor: worldTheme.colors.muted }]}>
                      <View
                        style={[
                          styles.hereFill,
                          {
                            backgroundColor: worldTheme.colors.accent,
                            width: `${Math.max(4, Math.round(frac * 100))}%`,
                          },
                        ]}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}

              {status === 'fogged' ? (
                <View pointerEvents="none" style={styles.fog} />
              ) : null}
            </Pressable>
          );
        })}

        <Text style={[styles.origin, { color: theme.colors.muted }]}>
          LEVEL 1 · where it all began
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:         { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  levelChip:     { paddingHorizontal: 10, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  levelChipText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  scroll:        { padding: 20, paddingBottom: 40 },

  beyond:        { fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 14, letterSpacing: 2 },
  origin:        { fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 16, letterSpacing: 1.5 },

  world:         { borderRadius: 18, padding: 18, marginVertical: 6, borderWidth: 2, overflow: 'hidden' },
  worldRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  worldText:     { flex: 1, gap: 3 },
  worldGate:     { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.5 },
  worldName:     { fontSize: 26, fontWeight: '900', includeFontPadding: false },
  fog:           { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,4,10,0.74)' },

  hereWrap:      { marginTop: 12, gap: 8 },
  hereChip:      { alignSelf: 'flex-start', paddingHorizontal: 10, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  hereText:      { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  hereTrack:     { height: 6, borderRadius: 3, overflow: 'hidden' },
  hereFill:      { height: 6, borderRadius: 3 },

  decoWrap:      { alignItems: 'center' },
  pathLine:      { width: 2.5, height: 14, borderRadius: 1 },
  decoNode:      { borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 7 },
  decoText:      { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
});
