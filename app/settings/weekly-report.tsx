// Your Week — a compact weekly recap. Reachable from the Stats screen
// header and from the Sunday banner on the dashboard.
//
// Everything computes from the last 7 daily_logs + the live profile:
// XP earned, tasks completed, clean days, best day, streak, and the
// next-unlock ETA reusing the same math as the dashboard teaser.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import type { DailyLog } from '@/lib/types';
import { getNextUnlock } from '@/lib/unlocks';
import { calculateTotalXpForLevel } from '@/lib/xp';
import { useAppStore } from '@/store/useAppStore';

export default function WeeklyReportScreen() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);

  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = profile?.id;
    if (!uid) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', uid)
          .order('date', { ascending: false })
          .limit(7);
        setLogs((data ?? []) as DailyLog[]);
      } catch (err) {
        console.warn('[weekly-report] load failed', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [profile?.id]);

  const week = useMemo(() => {
    const xp = logs.reduce((s, l) => s + Math.max(0, l.xp_earned), 0);
    const tasks = logs.reduce((s, l) => s + l.tasks_completed, 0);
    const clean = logs.filter((l) => l.streak_maintained).length;
    const best = logs.reduce<DailyLog | null>(
      (acc, l) => (acc == null || l.xp_earned > acc.xp_earned ? l : acc),
      null,
    );
    const avg = logs.length > 0 ? xp / logs.length : 0;

    const next = profile ? getNextUnlock(profile.level) : null;
    const xpLeft =
      next && profile ? Math.max(0, calculateTotalXpForLevel(next.level) - profile.total_xp) : 0;
    const etaDays = next && avg > 0 ? Math.max(1, Math.ceil(xpLeft / avg)) : null;

    return { xp, tasks, clean, best, next, etaDays };
  }, [logs, profile]);

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
          Your Week
        </Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.loading}>
          <Text style={[styles.empty, { color: theme.colors.muted }]}>
            No days logged yet — come back after your first full day.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.sub, { color: theme.colors.secondary }]}>
            Last {logs.length} day{logs.length === 1 ? '' : 's'}
          </Text>

          <View style={[styles.bigCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.bigValue, { color: theme.colors.accent, fontFamily: theme.fonts.heavy }]}>
              {week.xp.toLocaleString()}
            </Text>
            <Text style={[styles.bigLabel, { color: theme.colors.secondary }]}>XP EARNED THIS WEEK</Text>
          </View>

          <View style={styles.row}>
            <View style={[styles.tile, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.tileValue, { color: theme.colors.primary, fontFamily: theme.fonts.heavy }]}>
                {week.tasks}
              </Text>
              <Text style={[styles.tileLabel, { color: theme.colors.secondary }]}>TASKS DONE</Text>
            </View>
            <View style={[styles.tile, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.tileValue, { color: theme.colors.success, fontFamily: theme.fonts.heavy }]}>
                {week.clean}/{logs.length}
              </Text>
              <Text style={[styles.tileLabel, { color: theme.colors.secondary }]}>CLEAN DAYS</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.tile, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.tileValue, { color: theme.colors.primary, fontFamily: theme.fonts.heavy }]}>
                🔥 {profile?.day_streak ?? 0}
              </Text>
              <Text style={[styles.tileLabel, { color: theme.colors.secondary }]}>CURRENT STREAK</Text>
            </View>
            <View style={[styles.tile, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.tileValue, { color: theme.colors.primary, fontFamily: theme.fonts.heavy }]}>
                {week.best ? week.best.xp_earned : 0}
              </Text>
              <Text style={[styles.tileLabel, { color: theme.colors.secondary }]}>
                BEST DAY{week.best ? ` · ${shortDate(week.best.date)}` : ''}
              </Text>
            </View>
          </View>

          {week.next ? (
            <View style={[styles.nextCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.nextKicker, { color: theme.colors.secondary }]}>KEEP GOING</Text>
              <Text style={[styles.nextText, { color: theme.colors.primary }]}>
                {week.next.mystery ? 'A mystery unlock' : week.next.name} waits at Level {week.next.level}
                {week.etaDays != null ? ` — about ${week.etaDays} day${week.etaDays === 1 ? '' : 's'} at this pace.` : '.'}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function shortDate(ymd: string): string {
  const [, m, d] = ymd.split('-');
  return `${Number(d)}/${Number(m)}`;
}

const styles = StyleSheet.create({
  root:       { flex: 1 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  loading:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  empty:      { fontSize: 14, textAlign: 'center' },
  scroll:     { padding: 20, gap: 12 },
  sub:        { fontSize: 12, fontWeight: '700', letterSpacing: 1, textAlign: 'center' },
  bigCard:    { borderRadius: 18, paddingVertical: 26, alignItems: 'center', gap: 4 },
  bigValue:   { fontSize: 52, fontWeight: '900', includeFontPadding: false },
  bigLabel:   { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  row:        { flexDirection: 'row', gap: 12 },
  tile:       { flex: 1, borderRadius: 16, paddingVertical: 18, alignItems: 'center', gap: 4 },
  tileValue:  { fontSize: 26, fontWeight: '900', includeFontPadding: false },
  tileLabel:  { fontSize: 9.5, fontWeight: '800', letterSpacing: 1 },
  nextCard:   { borderRadius: 16, padding: 16, gap: 4 },
  nextKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  nextText:   { fontSize: 14.5, lineHeight: 21, fontWeight: '600' },
});
