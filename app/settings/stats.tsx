// Stats / history screen.
//
// Three blocks, scrollable:
//   1. 42-day heat-map grid coloured per daily_logs
//      (green = clean day, red = broken, hollow = today-in-progress,
//      muted square = no data).
//   2. Overview card with all-time totals pulled from profile +
//      daily_logs aggregates.
//   3. Top tasks + top bad habits from task_history, sorted by
//      use_count.
//
// All queries fire on mount; we don't refetch on every screen visit
// because the data only updates at daily reset close-out and after
// task/habit changes.

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
import type { DailyLog, TaskHistoryEntry } from '@/lib/types';
import { useAppStore } from '@/store/useAppStore';

const HEATMAP_COLS = 7;
const HEATMAP_ROWS = 6;
const HEATMAP_DAYS = HEATMAP_COLS * HEATMAP_ROWS; // 42
const HEATMAP_GAP = 4;

export default function StatsScreen() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);

  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [gridWidth, setGridWidth] = useState(0);

  // Refetch on every focus (not just mount) so a day rollover while
  // the user was on the dashboard shows up when they open Stats.
  useFocusEffect(
    useCallback(() => {
      const uid = profile?.id;
      if (!uid) return;
      let cancelled = false;
      (async () => {
        try {
          // Match the heat-map window: only include task_history
          // entries used within the last HEATMAP_DAYS days, so the
          // rankings reflect current habits, not lifetime favorites.
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - HEATMAP_DAYS);
          const cutoffIso = cutoff.toISOString();

          const [logsRes, historyRes] = await Promise.all([
            supabase.from('daily_logs')
              .select('*')
              .eq('user_id', uid)
              .order('date', { ascending: false }),
            supabase.from('task_history')
              .select('*')
              .eq('user_id', uid)
              .gte('last_used', cutoffIso)
              .order('use_count', { ascending: false })
              .limit(50),
          ]);
          if (cancelled) return;
          setLogs((logsRes.data ?? []) as DailyLog[]);
          setHistory((historyRes.data ?? []) as TaskHistoryEntry[]);
        } catch (err) {
          console.warn('[stats] load failed', err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [profile?.id]),
  );

  // ---- Heatmap rows (explicit 6×7; percent-width cells + gap inside
  // a flexWrap container collapse rows under the new architecture,
  // which is why the grid used to render as a single week) ----
  const heatmapRows = useMemo(() => {
    const logByDate = new Map(logs.map((l) => [l.date, l]));
    // "Today" is the profile's active day (last_active_date), which the
    // daily reset keeps current — not a wall-clock recomputation that
    // would shift when the user edits their day-start time mid-day.
    const todayYmd = profile?.last_active_date ?? toYmd(new Date());
    const anchor = parseYmd(todayYmd);
    const cells: Array<{
      date:   string;
      status: 'success' | 'fail' | 'empty' | 'today';
    }> = [];
    for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
      const d = new Date(anchor);
      d.setDate(d.getDate() - i);
      const ymd = toYmd(d);
      const log = logByDate.get(ymd);
      let status: 'success' | 'fail' | 'empty' | 'today';
      if (ymd === todayYmd && !log) status = 'today';
      else if (!log)                status = 'empty';
      else if (log.streak_maintained) status = 'success';
      else                            status = 'fail';
      cells.push({ date: ymd, status });
    }
    const rows: (typeof cells)[] = [];
    for (let r = 0; r < HEATMAP_ROWS; r++) {
      rows.push(cells.slice(r * HEATMAP_COLS, (r + 1) * HEATMAP_COLS));
    }
    return rows;
  }, [logs, profile]);

  const cellSize = gridWidth > 0
    ? Math.floor((gridWidth - HEATMAP_GAP * (HEATMAP_COLS - 1)) / HEATMAP_COLS)
    : 0;

  // ---- Totals ----
  const totals = useMemo(() => {
    const daysPlayed     = logs.length;
    const totalTasksDone = logs.reduce((s, l) => s + l.tasks_completed, 0);
    const cleanDays      = logs.filter((l) => l.streak_maintained).length;
    return {
      totalXp:       profile?.total_xp ?? 0,
      bestStreak:    profile?.highest_streak ?? 0,
      daysPlayed,
      cleanDays,
      totalTasksDone,
    };
  }, [logs, profile]);

  // ---- Top tasks / bad habits ----
  const topTasks    = useMemo(() => history.filter((h) => h.type === 'task').slice(0, 5),       [history]);
  const topBadHabs  = useMemo(() => history.filter((h) => h.type === 'bad_habit').slice(0, 5),  [history]);

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
        <Text style={[styles.title, { color: theme.colors.primary, fontFamily: theme.fonts.bold }]}>Stats</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/settings/weekly-report')}
          hitSlop={10}
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Ionicons name="calendar-outline" size={22} color={theme.colors.accent} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Heatmap */}
          <SectionHeader text="Last 6 weeks" color={theme.colors.secondary} fontFamily={theme.fonts.bold} />
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <View
              style={styles.heatmap}
              onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
            >
              {cellSize > 0 &&
                heatmapRows.map((row, r) => (
                  <View key={r} style={[styles.heatRow, r > 0 && { marginTop: HEATMAP_GAP }]}>
                    {row.map((cell, c) => (
                      <View
                        key={cell.date}
                        style={[
                          {
                            width: cellSize,
                            height: cellSize,
                            borderRadius: 5,
                          },
                          c > 0 && { marginLeft: HEATMAP_GAP },
                          cell.status === 'success'
                            ? { backgroundColor: theme.colors.success }
                            : cell.status === 'fail'
                            ? { backgroundColor: theme.colors.danger }
                            : cell.status === 'today'
                            ? { backgroundColor: 'transparent', borderWidth: 2, borderColor: theme.colors.accent }
                            : { backgroundColor: theme.colors.muted, opacity: 0.35 },
                        ]}
                      />
                    ))}
                  </View>
                ))}
            </View>
            <View style={styles.legend}>
              <LegendDot color={theme.colors.success} label="Clean" textColor={theme.colors.secondary} />
              <LegendDot color={theme.colors.danger}  label="Missed" textColor={theme.colors.secondary} />
              <LegendDot color={theme.colors.muted}   label="No data" textColor={theme.colors.secondary} dim />
              <LegendDot color="transparent" borderColor={theme.colors.accent} label="Today" textColor={theme.colors.secondary} />
            </View>
          </View>

          {/* Overview */}
          <SectionHeader text="Overview" color={theme.colors.secondary} fontFamily={theme.fonts.bold} />
          <View style={[styles.tilesRow, { backgroundColor: theme.colors.surface }]}>
            <Tile value={totals.totalXp.toLocaleString()}   label="Total XP"    theme={theme} />
            <Divider color={theme.colors.muted} />
            <Tile value={totals.daysPlayed.toString()}      label="Days played" theme={theme} />
          </View>
          <View style={[styles.tilesRow, { backgroundColor: theme.colors.surface }]}>
            <Tile value={totals.bestStreak.toString()}     label="Best streak"   theme={theme} />
            <Divider color={theme.colors.muted} />
            <Tile value={totals.cleanDays.toString()}      label="Clean days"    theme={theme} />
          </View>
          <View style={[styles.tilesRow, { backgroundColor: theme.colors.surface }]}>
            <Tile value={totals.totalTasksDone.toString()} label="Tasks done" theme={theme} wide />
          </View>

          {/* Top tasks */}
          <SectionHeader text="Top tasks · last 6 weeks" color={theme.colors.secondary} fontFamily={theme.fonts.bold} />
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            {topTasks.length === 0 ? (
              <Text style={[styles.empty, { color: theme.colors.muted }]}>No tasks added yet.</Text>
            ) : (
              topTasks.map((t, i) => (
                <View key={t.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.muted }]}>
                  <Text style={[styles.rank, { color: theme.colors.accent, fontFamily: theme.fonts.bold }]}>#{i + 1}</Text>
                  <Text style={[styles.rowName, { color: theme.colors.primary }]} numberOfLines={1}>{t.name}</Text>
                  <Text style={[styles.rowCount, { color: theme.colors.secondary }]}>×{t.use_count}</Text>
                </View>
              ))
            )}
          </View>

          {/* Top bad habits */}
          <SectionHeader text="Top bad habits · last 6 weeks" color={theme.colors.secondary} fontFamily={theme.fonts.bold} />
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            {topBadHabs.length === 0 ? (
              <Text style={[styles.empty, { color: theme.colors.muted }]}>None tracked yet.</Text>
            ) : (
              topBadHabs.map((h, i) => (
                <View key={h.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.muted }]}>
                  <Text style={[styles.rank, { color: theme.colors.danger, fontFamily: theme.fonts.bold }]}>#{i + 1}</Text>
                  <Text style={[styles.rowName, { color: theme.colors.primary }]} numberOfLines={1}>{h.name}</Text>
                  <Text style={[styles.rowCount, { color: theme.colors.secondary }]}>×{h.use_count}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ text, color, fontFamily }: { text: string; color: string; fontFamily: string }) {
  return <Text style={[styles.sectionTitle, { color, fontFamily }]}>{text.toUpperCase()}</Text>;
}

function Tile({
  value,
  label,
  theme,
  wide,
}: {
  value:  string;
  label:  string;
  theme:  ReturnType<typeof useAppStore.getState>['theme'];
  wide?:  boolean;
}) {
  return (
    <View style={[styles.tile, wide && { flex: 1 }]}>
      <Text style={[styles.tileValue, { color: theme.colors.primary, fontFamily: theme.fonts.heavy }]}>{value}</Text>
      <Text style={[styles.tileLabel, { color: theme.colors.secondary }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: color }} />;
}

function LegendDot({
  color,
  label,
  textColor,
  borderColor,
  dim,
}: {
  color:        string;
  label:        string;
  textColor:    string;
  borderColor?: string;
  dim?:         boolean;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendSwatch,
          {
            backgroundColor: color,
            opacity: dim ? 0.35 : 1,
            borderWidth: borderColor ? 1.5 : 0,
            borderColor,
          },
        ]}
      />
      <Text style={[styles.legendLabel, { color: textColor }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  loading:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:       { padding: 20, gap: 8 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 2, marginTop: 12, marginBottom: 4 },
  card:         { borderRadius: 16, padding: 14, gap: 12 },

  heatmap:      { width: '100%' },
  heatRow:      { flexDirection: 'row' },

  legend:       { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  legendLabel:  { fontSize: 11, fontWeight: '600' },

  tilesRow:     { flexDirection: 'row', borderRadius: 16, paddingVertical: 16, marginTop: 4 },
  tile:         { flex: 1, alignItems: 'center', gap: 2 },
  tileValue:    { fontSize: 28, fontWeight: '900', includeFontPadding: false },
  tileLabel:    { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },

  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rank:         { fontSize: 13, fontWeight: '800', width: 28 },
  rowName:      { flex: 1, fontSize: 15, fontWeight: '600' },
  rowCount:     { fontSize: 13, fontWeight: '700' },
  empty:        { fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
});
