// Add Bad Habits screen.
//
// Same UX shape as Add Tasks (auto-focused input, recent chips when
// empty, live suggestions when typing, multi-add toast) but:
//   - filters task_history by type='bad_habit'
//   - styles the Add button + accents in the danger color
//   - drops the "4th task earns less" warning (penalties are flat
//     150 XP for every bad habit; no tiers)

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { play } from '@/lib/sound';
import { BAD_HABIT_PENALTY, MAX_ITEMS_PER_DAY } from '@/lib/xp';
import { supabase } from '@/lib/supabase';
import type { TaskHistoryEntry } from '@/lib/types';
import { useAppStore } from '@/store/useAppStore';

export default function AddBadHabitsScreen() {
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);
  const profile = useAppStore((s) => s.profile);
  const badHabits = useAppStore((s) => s.badHabits);
  const addBadHabit = useAppStore((s) => s.addBadHabit);
  const atMax = badHabits.length >= MAX_ITEMS_PER_DAY;

  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const uid = profile?.id;
    if (!uid) return;
    (async () => {
      const { data } = await supabase
        .from('task_history')
        .select('*')
        .eq('user_id', uid)
        .eq('type', 'bad_habit')
        .order('last_used', { ascending: false })
        .limit(100);
      setHistory((data ?? []) as TaskHistoryEntry[]);
    })();
  }, [profile?.id]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const recent = useMemo(() => history.slice(0, 5), [history]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return history
      .filter((h) => h.name.toLowerCase().includes(q) && h.name.toLowerCase() !== q)
      .slice(0, 10);
  }, [history, query]);

  const trimmed = query.trim();
  const exactInHistory = trimmed
    ? history.some((h) => h.name.toLowerCase() === trimmed.toLowerCase())
    : false;
  const showFreshSuggestion = !!trimmed && !exactInHistory;

  async function handleAdd(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName || busy) return;
    setBusy(true);

    const inserted = await addBadHabit(trimmedName);
    setBusy(false);
    if (!inserted) return;
    play('tap');

    setHistory((prev) => {
      const existing = prev.find((h) => h.name.toLowerCase() === trimmedName.toLowerCase());
      if (existing) {
        return [
          { ...existing, use_count: existing.use_count + 1, last_used: new Date().toISOString() },
          ...prev.filter((h) => h.id !== existing.id),
        ];
      }
      return [
        {
          id:        `pending-${Date.now()}`,
          user_id:   profile?.id ?? '',
          name:      trimmedName,
          type:      'bad_habit',
          use_count: 1,
          last_used: new Date().toISOString(),
        },
        ...prev,
      ];
    });

    setQuery('');
    setJustAdded(trimmedName);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setJustAdded(null), 1800);
    inputRef.current?.focus();
  }

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
        <Text style={[styles.headerTitle, { color: theme.colors.primary }]}>Add Bad Habit</Text>
        <View style={styles.iconBtn} />
      </View>

      <Text style={[styles.subtle, { color: atMax ? theme.colors.danger : theme.colors.secondary }]}>
        {atMax
          ? `Daily limit reached (${MAX_ITEMS_PER_DAY} bad habits). Delete one to add another.`
          : `Track what trips you up. Each one costs ${BAD_HABIT_PENALTY} XP and breaks your streak.`}
      </Text>

      {/* Input + Add */}
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          autoFocus
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => handleAdd(query)}
          placeholder="Bad habit to track?"
          placeholderTextColor={theme.colors.muted}
          returnKeyType="done"
          autoCorrect
          autoCapitalize="sentences"
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              color:           theme.colors.primary,
              borderColor:     theme.colors.muted,
            },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          disabled={!trimmed || busy || atMax}
          onPress={() => handleAdd(query)}
          style={({ pressed }) => [
            styles.addBtn,
            {
              backgroundColor: theme.colors.danger,
              opacity: !trimmed || atMax ? 0.4 : pressed ? 0.7 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={theme.colors.background} />
          ) : (
            <Text style={[styles.addBtnText, { color: theme.colors.background }]}>Add</Text>
          )}
        </Pressable>
      </View>

      {/* Suggestions / recents */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {trimmed ? (
          <View style={styles.block}>
            <Text style={[styles.blockTitle, { color: theme.colors.secondary }]}>Suggestions</Text>
            {showFreshSuggestion ? (
              <Pressable
                onPress={() => handleAdd(trimmed)}
                style={({ pressed }) => [
                  styles.suggestion,
                  { backgroundColor: theme.colors.surface, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Ionicons name="add-circle" size={20} color={theme.colors.danger} />
                <Text style={[styles.suggestionText, { color: theme.colors.primary }]}>
                  Track "{trimmed}"
                </Text>
              </Pressable>
            ) : null}
            {suggestions.length === 0 && !showFreshSuggestion ? (
              <Text style={[styles.empty, { color: theme.colors.muted }]}>No matches.</Text>
            ) : null}
            {suggestions.map((h) => (
              <Pressable
                key={h.id}
                onPress={() => handleAdd(h.name)}
                style={({ pressed }) => [
                  styles.suggestion,
                  { backgroundColor: theme.colors.surface, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Ionicons name="time-outline" size={18} color={theme.colors.secondary} />
                <Text
                  style={[styles.suggestionText, { color: theme.colors.primary }]}
                  numberOfLines={1}
                >
                  {h.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.block}>
            <Text style={[styles.blockTitle, { color: theme.colors.secondary }]}>Recent</Text>
            {recent.length === 0 ? (
              <Text style={[styles.empty, { color: theme.colors.muted }]}>
                No bad habits tracked yet. Type one above.
              </Text>
            ) : (
              <View style={styles.chips}>
                {recent.map((h) => (
                  <Pressable
                    key={h.id}
                    onPress={() => handleAdd(h.name)}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        borderColor: theme.colors.danger,
                        backgroundColor: theme.colors.surface,
                        opacity: pressed ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.chipText, { color: theme.colors.primary }]}
                      numberOfLines={1}
                    >
                      {h.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {justAdded ? (
        <View pointerEvents="none" style={styles.toastWrap}>
          <View style={[styles.toast, { backgroundColor: theme.colors.danger }]}>
            <Ionicons name="checkmark" size={16} color={theme.colors.background} />
            <Text
              style={[styles.toastText, { color: theme.colors.background }]}
              numberOfLines={1}
            >
              Tracking "{justAdded}"
            </Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  subtle:      { fontSize: 13, paddingHorizontal: 20, marginTop: 4, marginBottom: 8 },
  inputRow:    { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  input:       { flex: 1, height: 48, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, borderWidth: StyleSheet.hairlineWidth },
  addBtn:      { paddingHorizontal: 18, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minWidth: 72 },
  addBtnText:  { fontSize: 15, fontWeight: '700' },
  scroll:      { padding: 20, gap: 16 },
  block:       { gap: 8 },
  blockTitle:  { fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, maxWidth: 220 },
  chipText:    { fontSize: 14, fontWeight: '600' },
  suggestion:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10 },
  suggestionText: { fontSize: 15, fontWeight: '500', flex: 1 },
  empty:       { fontSize: 13, fontStyle: 'italic', paddingVertical: 6 },
  toastWrap:   { position: 'absolute', left: 0, right: 0, bottom: 32, alignItems: 'center' },
  toast:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  toastText:   { fontSize: 13, fontWeight: '700', maxWidth: 240 },
});
