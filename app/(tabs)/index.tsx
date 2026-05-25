// The dashboard - main screen of the app.
//
// Top-to-bottom:
//   - header row (hamburger -> /settings, app name, streak)
//   - LevelCircle + current/next XP readout
//   - Tasks section (+ button -> /tasks/add-tasks) with TaskItem rows
//   - Bad Habits section (+ button -> /tasks/add-bad-habits)
//   - footer with today's date + day-start time
//   - Level-Up celebration modal triggered by store.levelUpEvent

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BadHabitItem } from '@/components/BadHabitItem';
import { LevelCircle } from '@/components/LevelCircle';
import { StreakDisplay } from '@/components/StreakDisplay';
import { TaskItem } from '@/components/TaskItem';
import { getXpProgress } from '@/lib/xp';
import type { BadHabit, Task } from '@/lib/types';
import { useAppStore } from '@/store/useAppStore';

export default function Dashboard() {
  const router = useRouter();

  const profile = useAppStore((s) => s.profile);
  const tasks = useAppStore((s) => s.tasks);
  const badHabits = useAppStore((s) => s.badHabits);
  const theme = useAppStore((s) => s.theme);
  const levelUpEvent = useAppStore((s) => s.levelUpEvent);
  const clearLevelUpEvent = useAppStore((s) => s.clearLevelUpEvent);

  const completeTask = useAppStore((s) => s.completeTask);
  const uncompleteTask = useAppStore((s) => s.uncompleteTask);
  const renameTask = useAppStore((s) => s.renameTask);
  const deleteTask = useAppStore((s) => s.deleteTask);

  const completeBadHabit = useAppStore((s) => s.completeBadHabit);
  const uncompleteBadHabit = useAppStore((s) => s.uncompleteBadHabit);
  const renameBadHabit = useAppStore((s) => s.renameBadHabit);
  const deleteBadHabit = useAppStore((s) => s.deleteBadHabit);

  const progress = useMemo(
    () => getXpProgress(profile?.total_xp ?? 0),
    [profile?.total_xp],
  );

  // Floating "+XP" toasts. Pushed by onToggleTask; each renders
  // absolutely over the level circle and removes itself after 1.6s.
  const [xpToasts, setXpToasts] = useState<Array<{ id: number; amount: number }>>([]);

  if (!profile) {
    return <View style={[styles.root, { backgroundColor: theme.colors.background }]} />;
  }

  async function onToggleTask(task: Task) {
    if (task.is_completed) {
      void Haptics.selectionAsync();
      void uncompleteTask(task.id);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const { awarded } = await completeTask(task.id);
    if (awarded > 0) {
      const id = Date.now() + Math.random();
      setXpToasts((prev) => [...prev, { id, amount: awarded }]);
      setTimeout(() => {
        setXpToasts((prev) => prev.filter((t) => t.id !== id));
      }, 1600);
    }
  }

  function onOpenTaskMenu(task: Task) {
    Alert.alert(
      task.name,
      undefined,
      [
        {
          text:    task.is_completed ? 'Uncheck' : 'Check',
          onPress: () => onToggleTask(task),
        },
        {
          text:    'Rename',
          onPress: () =>
            Alert.prompt(
              'Rename task',
              undefined,
              (text) => text && void renameTask(task.id, text),
              'plain-text',
              task.name,
            ),
        },
        {
          text:    'Delete',
          style:   'destructive',
          onPress: () => void deleteTask(task.id),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  }

  function onToggleBadHabit(habit: BadHabit) {
    if (habit.is_done) {
      void Haptics.selectionAsync();
      void uncompleteBadHabit(habit.id);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Mark as done?',
      `This will cost ${habit.xp_penalty} XP and break your streak.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text:    'I did it',
          style:   'destructive',
          onPress: () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            void completeBadHabit(habit.id);
          },
        },
      ],
    );
  }

  function onOpenHabitMenu(habit: BadHabit) {
    Alert.alert(
      habit.name,
      undefined,
      [
        {
          text:    habit.is_done ? 'Undo' : 'Mark done',
          onPress: () => onToggleBadHabit(habit),
        },
        {
          text:    'Rename',
          onPress: () =>
            Alert.prompt(
              'Rename bad habit',
              undefined,
              (text) => text && void renameBadHabit(habit.id, text),
              'plain-text',
              habit.name,
            ),
        },
        {
          text:    'Delete',
          style:   'destructive',
          onPress: () => void deleteBadHabit(habit.id),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings')}
            hitSlop={10}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.5 : 1 }]}
          >
            <Ionicons name="menu" size={26} color={theme.colors.primary} />
          </Pressable>

          <Text style={[styles.brand, { color: theme.colors.primary }]}>YourLevel</Text>

          <StreakDisplay
            streak={profile.day_streak}
            secondChanceActive={profile.second_chance_active}
            color={theme.colors.primary}
            warnColor={theme.colors.danger}
          />
        </View>

        {/* Streak-at-risk hint when a bad habit has been logged today.
            Streak transitions happen at daily reset; this gives the
            user immediate feedback that today won't extend the streak. */}
        {badHabits.some((h) => h.is_done) ? (
          <Text style={[styles.atRisk, { color: theme.colors.danger }]}>
            Streak at risk — today won't count.
          </Text>
        ) : null}

        {/* Level circle */}
        <View style={styles.circleWrap}>
          <LevelCircle
            level={progress.level}
            currentXp={progress.currentXp}
            xpToNextLevel={progress.xpToNextLevel}
            levelName={progress.levelName}
            trackColor={theme.colors.muted}
            progressColor={theme.colors.accent}
            textColor={theme.colors.primary}
            subTextColor={theme.colors.secondary}
          />
          <Text style={[styles.xpRead, { color: theme.colors.secondary }]}>
            {progress.currentXp} / {progress.xpToNextLevel} XP
          </Text>
          {/* Floating XP toasts, stacked. */}
          <View pointerEvents="none" style={styles.xpToastLayer}>
            {xpToasts.map((t) => (
              <XpToast key={t.id} amount={t.amount} color={theme.colors.accent} />
            ))}
          </View>
        </View>

        {/* Tasks */}
        <Section
          title="Tasks"
          accent={theme.colors.primary}
          surface={theme.colors.surface}
          onAdd={() => router.push('/tasks/add-tasks')}
          empty={tasks.length === 0 ? 'No tasks today. Tap + to add one.' : undefined}
          emptyColor={theme.colors.muted}
        >
          {tasks.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              primaryColor={theme.colors.primary}
              mutedColor={theme.colors.muted}
              accentColor={theme.colors.accent}
              surfaceColor={theme.colors.surface}
              onToggle={onToggleTask}
              onOpenMenu={onOpenTaskMenu}
            />
          ))}
        </Section>

        {/* Bad habits */}
        <Section
          title="Bad Habits"
          accent={theme.colors.primary}
          surface={theme.colors.surface}
          onAdd={() => router.push('/tasks/add-bad-habits')}
          empty={badHabits.length === 0 ? 'No bad habits tracked. Tap + to add one.' : undefined}
          emptyColor={theme.colors.muted}
        >
          {badHabits.map((h) => (
            <BadHabitItem
              key={h.id}
              habit={h}
              primaryColor={theme.colors.primary}
              mutedColor={theme.colors.muted}
              dangerColor={theme.colors.danger}
              surfaceColor={theme.colors.surface}
              onToggle={onToggleBadHabit}
              onOpenMenu={onOpenHabitMenu}
            />
          ))}
        </Section>

        {/* Footer */}
        <Text style={[styles.footer, { color: theme.colors.muted }]}>
          {formatToday()}  ·  Day starts {formatDayStart(profile.day_start_time)}
        </Text>
      </ScrollView>

      {/* Level-up celebration */}
      <Modal
        transparent
        visible={levelUpEvent != null}
        animationType="fade"
        onRequestClose={clearLevelUpEvent}
      >
        <Pressable style={styles.modalRoot} onPress={clearLevelUpEvent}>
          <LevelUpCard
            level={levelUpEvent?.to ?? 0}
            name={levelUpEvent?.levelName ?? ''}
            colors={theme.colors}
          />
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Section(props: {
  title:      string;
  accent:     string;
  surface:    string;
  onAdd:      () => void;
  empty?:     string;
  emptyColor: string;
  children:   React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: props.accent }]}>{props.title}</Text>
        <Pressable
          onPress={props.onAdd}
          hitSlop={10}
          style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.5 : 1, borderColor: props.accent }]}
        >
          <Ionicons name="add" size={18} color={props.accent} />
        </Pressable>
      </View>
      <View style={styles.sectionBody}>
        {props.empty ? (
          <Text style={[styles.empty, { color: props.emptyColor }]}>{props.empty}</Text>
        ) : (
          props.children
        )}
      </View>
    </View>
  );
}

/** Floating "+N XP" indicator. Mounts -> animates up + fades out. */
function XpToast({ amount, color }: { amount: number; color: string }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, {
      toValue:         1,
      duration:        1500,
      useNativeDriver: true,
    }).start();
  }, [t]);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -80] });
  const opacity    = t.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const scale      = t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.6, 1.1, 1] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.xpToast, { transform: [{ translateY }, { scale }], opacity }]}
    >
      <Text style={[styles.xpToastText, { color }]}>+{amount} XP</Text>
    </Animated.View>
  );
}

/** Level-up celebration: spring-in scale + glow pulse + success haptic. */
function LevelUpCard({
  level,
  name,
  colors,
}: {
  level:  number;
  name:   string;
  colors: { surface: string; primary: string; secondary: string; accent: string; muted: string };
}) {
  const pop = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    ).start();
  }, [pop, pulse]);

  const cardScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const cardOpacity = pop;
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.15] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.05] });

  return (
    <View style={styles.levelUpWrap} pointerEvents="box-none">
      {/* Pulsing accent glow behind the card. */}
      <Animated.View
        style={[
          styles.levelUpGlow,
          {
            backgroundColor: colors.accent,
            transform:       [{ scale: glowScale }],
            opacity:         glowOpacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.modalCard,
          {
            backgroundColor: colors.surface,
            opacity:         cardOpacity,
            transform:       [{ scale: cardScale }],
          },
        ]}
      >
        <Text style={[styles.modalKicker, { color: colors.accent }]}>LEVEL UP</Text>
        <Text style={[styles.modalLevel, { color: colors.primary }]}>{level}</Text>
        <Text style={[styles.modalName, { color: colors.secondary }]}>{name}</Text>
        <Text style={[styles.modalHint, { color: colors.muted }]}>tap to continue</Text>
      </Animated.View>
    </View>
  );
}

function formatToday(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
  });
}

function formatDayStart(hms: string): string {
  const [h = '0', m = '0'] = hms.split(':');
  const hr = Number(h) || 0;
  const mn = Number(m) || 0;
  const ampm = hr >= 12 ? 'PM' : 'AM';
  const hr12 = hr % 12 || 12;
  return `${hr12}:${String(mn).padStart(2, '0')} ${ampm}`;
}

const styles = StyleSheet.create({
  root:           { flex: 1 },
  scroll:         { paddingHorizontal: 20, paddingBottom: 32, gap: 20 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  iconBtn:        { padding: 4 },
  brand:          { fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  atRisk:         { fontSize: 12, fontWeight: '700', letterSpacing: 1, textAlign: 'center', textTransform: 'uppercase' },
  circleWrap:     { alignItems: 'center', gap: 12, marginVertical: 8 },
  xpRead:         { fontSize: 13, letterSpacing: 0.5 },
  section:        { gap: 10 },
  sectionHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle:   { fontSize: 20, fontWeight: '800', letterSpacing: 0.3 },
  addBtn:         { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sectionBody:    { gap: 8 },
  empty:          { fontSize: 13, fontStyle: 'italic', paddingVertical: 8 },
  footer:         { fontSize: 12, textAlign: 'center', marginTop: 8 },
  xpToastLayer:   { position: 'absolute', left: 0, right: 0, top: '40%', alignItems: 'center', pointerEvents: 'none' },
  xpToast:        { position: 'absolute' },
  xpToastText:    { fontSize: 28, fontWeight: '900', letterSpacing: 0.5, textShadowColor: '#0008', textShadowRadius: 6 },
  levelUpWrap:    { alignItems: 'center', justifyContent: 'center' },
  levelUpGlow:    { position: 'absolute', width: 320, height: 320, borderRadius: 160 },
  modalRoot:      { flex: 1, backgroundColor: '#000000B0', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard:      { padding: 32, borderRadius: 20, alignItems: 'center', minWidth: 240 },
  modalKicker:    { fontSize: 12, fontWeight: '800', letterSpacing: 3, marginBottom: 8 },
  modalLevel:     { fontSize: 72, fontWeight: '900', includeFontPadding: false },
  modalName:      { fontSize: 16, fontWeight: '700', letterSpacing: 1.5, marginTop: 4 },
  modalHint:      { fontSize: 11, marginTop: 16 },
});
