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
  Easing,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  NestableDraggableFlatList,
  NestableScrollContainer,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { BadHabitItem } from '@/components/BadHabitItem';
import { Confetti } from '@/components/Confetti';
import { DecorationLayer } from '@/components/DecorationLayer';
import { TutorialOverlay, type HoleRect } from '@/components/TutorialOverlay';
import { LevelCircle } from '@/components/LevelCircle';
import { StreakDisplay } from '@/components/StreakDisplay';
import { TaskItem } from '@/components/TaskItem';
import { getTheme } from '@/constants/themes';
import { getDecoration } from '@/constants/decorations';
import { QUESTS } from '@/constants/quests';
import { play } from '@/lib/sound';
import { supabase } from '@/lib/supabase';
import { getNextUnlock, getPreviousUnlockLevel } from '@/lib/unlocks';
import { calculateTotalXpForLevel, DAILY_TASK_XP_CAP, getXpProgress } from '@/lib/xp';
import {
  TUTORIAL_DONE_KEY,
  TUTORIAL_PENDING_KEY,
  type LevelUpEvent,
} from '@/store/useAppStore';
import type { BadHabit, Task } from '@/lib/types';
import { useAppStore } from '@/store/useAppStore';

// ---------------------------------------------------------------------------
// First-run walkthrough steps. `target` keys map to refs registered on
// dashboard elements; null target = centered card over a full scrim.
// `next` = button label; omitted = forced tap (user must tap the
// spotlighted control to continue).
// ---------------------------------------------------------------------------

type TutorialTarget = 'addTask' | 'firstTask' | 'streak' | 'habits' | 'avatar';

const TUTORIAL_STEPS: ReadonlyArray<{
  target: TutorialTarget | null;
  title:  string;
  body:   string;
  next?:  string;
}> = [
  {
    target: null,
    title:  'This is your dashboard',
    body:   'The big ring is your level. Complete tasks to fill it with XP. Let’s add your first task.',
    next:   'Show me',
  },
  {
    target: 'addTask',
    title:  'Add your first task',
    body:   'Tap the + to add something you want to do today.',
    // forced tap
  },
  {
    target: 'firstTask',
    title:  'Now complete it',
    body:   'Tap the checkbox when a task is done. Your first 3 tasks are worth 100 XP each — add more and the daily 300 XP splits across all of them.',
    // forced tap
  },
  {
    target: 'streak',
    title:  'Your streak',
    body:   'Finish ALL your tasks with zero bad habits and your streak grows by 1. Every streak day adds +5 bonus XP. Reach 20 days and you earn a Second Chance — one miss won’t reset you.',
    next:   'Next',
  },
  {
    target: 'habits',
    title:  'Bad habits cost you',
    body:   'Track what you’re trying to quit down here. Logging one costs 150 XP and breaks the day’s streak — honesty is the whole point.',
    next:   'Next',
  },
  {
    target: 'avatar',
    title:  'Level up, unlock more',
    body:   'New themes and background decorations unlock as you level. Find them any time in Settings → Fonts and Decorations.',
    next:   'Finish',
  },
];

export default function Dashboard() {
  const router = useRouter();

  const profile = useAppStore((s) => s.profile);
  const tasks = useAppStore((s) => s.tasks);
  const badHabits = useAppStore((s) => s.badHabits);
  const theme = useAppStore((s) => s.theme);
  const levelUpEvent = useAppStore((s) => s.levelUpEvent);
  const clearLevelUpEvent = useAppStore((s) => s.clearLevelUpEvent);
  const setTheme = useAppStore((s) => s.setTheme);
  const setDecoration = useAppStore((s) => s.setDecoration);
  const claimQuest = useAppStore((s) => s.claimQuest);
  const tutorialStep = useAppStore((s) => s.tutorialStep);
  const startTutorial = useAppStore((s) => s.startTutorial);
  const advanceTutorial = useAppStore((s) => s.advanceTutorial);
  const finishTutorial = useAppStore((s) => s.finishTutorial);

  const completeTask = useAppStore((s) => s.completeTask);
  const uncompleteTask = useAppStore((s) => s.uncompleteTask);
  const renameTask = useAppStore((s) => s.renameTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const reorderTasks = useAppStore((s) => s.reorderTasks);

  const completeBadHabit = useAppStore((s) => s.completeBadHabit);
  const uncompleteBadHabit = useAppStore((s) => s.uncompleteBadHabit);
  const renameBadHabit = useAppStore((s) => s.renameBadHabit);
  const deleteBadHabit = useAppStore((s) => s.deleteBadHabit);
  const reorderBadHabits = useAppStore((s) => s.reorderBadHabits);

  const progress = useMemo(
    () => getXpProgress(profile?.total_xp ?? 0),
    [profile?.total_xp],
  );

  // Net XP earned today = task XP earned − bad-habit XP lost.
  // Negative when bad habits outweigh tasks (e.g. -200/300 if the
  // user has only done a bad habit so far). Shown under the streak.
  const netXpToday = useMemo(() => {
    if (!profile) return 0;
    return profile.daily_task_xp_earned - profile.daily_bad_habit_xp_lost;
  }, [profile?.daily_task_xp_earned, profile?.daily_bad_habit_xp_lost]);

  // Floating "+XP" toasts. Pushed by onToggleTask; each renders
  // absolutely over the level circle and removes itself after 1.6s.
  const [xpToasts, setXpToasts] = useState<Array<{ id: number; amount: number }>>([]);

  // Average daily XP over the last 14 logged days, for the "at your
  // pace" unlock ETA. Needs >= 3 days of history to say anything.
  const [avgDailyXp, setAvgDailyXp] = useState<number | null>(null);
  useEffect(() => {
    const uid = profile?.id;
    if (!uid) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('daily_logs')
          .select('xp_earned')
          .eq('user_id', uid)
          .order('date', { ascending: false })
          .limit(14);
        if (data && data.length >= 3) {
          const sum = data.reduce((s, r) => s + Math.max(0, r.xp_earned ?? 0), 0);
          setAvgDailyXp(sum / data.length);
        }
      } catch {
        // ETA is decorative; stay silent
      }
    })();
  }, [profile?.id]);

  function pushXpToast(amount: number) {
    const id = Date.now() + Math.random();
    setXpToasts((prev) => [...prev, { id, amount }]);
    setTimeout(() => {
      setXpToasts((prev) => prev.filter((t) => t.id !== id));
    }, 1600);
  }

  async function onClaimQuest(questId: string) {
    const reward = await claimQuest(questId);
    if (reward > 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      play('unlock');
      pushXpToast(reward);
    }
  }

  // ---- First-run walkthrough plumbing ----
  const rootRef = useRef<View>(null);
  const addTaskRef = useRef<View>(null);
  const firstTaskRef = useRef<View>(null);
  const streakRef = useRef<View>(null);
  const habitsRef = useRef<View>(null);
  const avatarRef = useRef<View>(null);
  const [tutorialHole, setTutorialHole] = useState<HoleRect | null>(null);

  // Offer the walkthrough once, right after a fresh account finishes
  // onboarding (the pending flag is set there).
  //
  // IMPORTANT: the root layout renders a plain <Slot/>, so navigating
  // to /tasks/add-tasks UNMOUNTS this screen and coming back REMOUNTS
  // it — this effect fires again mid-tutorial. The tutorialStep guard
  // prevents the restart-to-step-0 loop that used to trap users right
  // after adding their first task. The store (which survives the
  // remount) keeps the real step.
  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      try {
        if (useAppStore.getState().tutorialStep != null) return; // already running
        // Pending alone decides. (The old extra "done" check was
        // device-level and permanently blocked new accounts on a
        // phone where a previous account had finished/skipped.)
        const pending = await AsyncStorage.getItem(TUTORIAL_PENDING_KEY);
        if (pending === 'true') startTutorial();
      } catch {
        // non-fatal
      }
    })();
  }, [profile?.id, startTutorial]);

  // Measure the active step's target into overlay coordinates. Redone
  // when the step changes and when the first task appears (step 2's
  // target doesn't exist until the user adds one). The small delay
  // lets layout settle after navigation back from the add screen.
  useEffect(() => {
    if (tutorialStep == null) {
      setTutorialHole(null);
      return;
    }
    const step = TUTORIAL_STEPS[tutorialStep];
    if (!step || !step.target) {
      setTutorialHole(null);
      return;
    }
    const refs: Record<TutorialTarget, React.RefObject<View | null>> = {
      addTask:   addTaskRef,
      firstTask: firstTaskRef,
      streak:    streakRef,
      habits:    habitsRef,
      avatar:    avatarRef,
    };
    const timer = setTimeout(() => {
      const target = refs[step.target as TutorialTarget].current;
      const root = rootRef.current;
      if (!target || !root) {
        setTutorialHole(null);
        return;
      }
      root.measureInWindow((rx, ry) => {
        target.measureInWindow((x, y, w, h) => {
          setTutorialHole({ x: x - rx, y: y - ry, w, h });
        });
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [tutorialStep, tasks.length]);

  function onTutorialNext() {
    if (tutorialStep == null) return;
    if (tutorialStep >= TUTORIAL_STEPS.length - 1) void finishTutorial();
    else advanceTutorial();
  }

  if (!profile) {
    return <View style={[styles.root, { backgroundColor: theme.colors.background }]} />;
  }

  async function onToggleTask(task: Task) {
    if (task.is_completed) {
      void Haptics.selectionAsync();
      play('tap');
      void uncompleteTask(task.id);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    play('complete');
    const { awarded } = await completeTask(task.id);
    // Forced-tap step 2 ("complete your first task") advances here.
    if (useAppStore.getState().tutorialStep === 2) advanceTutorial();
    if (awarded > 0) pushXpToast(awarded);
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
            play('tap');
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
    <SafeAreaView
      ref={rootRef}
      collapsable={false}
      style={[styles.root, { backgroundColor: theme.colors.background }]}
    >
      {/* Background decoration sits behind the scroll content; pointer
          events disabled in DecorationLayer so touches pass through. */}
      <DecorationLayer
        id={profile.selected_decoration ?? 'none'}
        accentColor={theme.colors.accent}
        mutedColor={theme.colors.muted}
        primaryColor={theme.colors.primary}
      />
      <NestableScrollContainer
        contentContainerStyle={styles.scroll}
        scrollEnabled={tutorialStep == null}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            ref={avatarRef}
            accessibilityRole="button"
            onPress={() => router.push('/settings')}
            hitSlop={10}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.5 : 1 }]}
          >
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.headerAvatar} />
            ) : (
              <View
                style={[
                  styles.headerAvatar,
                  styles.headerAvatarFallback,
                  { backgroundColor: theme.colors.accent },
                ]}
              >
                <Text style={[styles.headerAvatarLetter, { color: theme.colors.background, fontFamily: theme.fonts.heavy }]}>
                  {(profile.username ?? 'Guest').slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
          </Pressable>

          {/* Absolute-center the brand so it stays put regardless of
              the side columns' widths. */}
          <View pointerEvents="none" style={styles.brandWrap}>
            <Text style={[styles.brand, { color: theme.colors.primary, fontFamily: theme.fonts.heavy }]}>YourLevel</Text>
          </View>

          <View ref={streakRef} collapsable={false} style={styles.headerRight}>
            <StreakDisplay
              streak={profile.day_streak}
              secondChanceActive={profile.second_chance_active}
              color={theme.colors.primary}
              warnColor={theme.colors.danger}
            />
            <Text style={[styles.todayChip, { color: theme.colors.primary }]}>
              {netXpToday}/{DAILY_TASK_XP_CAP} XP today
            </Text>
          </View>
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
            fontFamily={theme.fonts.heavy}
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

        {/* Next-unlock teaser: permanent anticipation. */}
        <NextUnlockTeaser
          level={progress.level}
          totalXp={profile.total_xp}
          avgDailyXp={avgDailyXp}
          theme={theme}
          onPressTheme={() => router.push('/settings/fonts')}
        />

        {/* First-week quests (fresh accounts only; hides forever once
            all are claimed). */}
        <QuestsCard
          profile={profile}
          tasks={tasks}
          badHabits={badHabits}
          theme={theme}
          onClaim={onClaimQuest}
        />

        {/* Tasks */}
        <Section
          title="Tasks"
          accent={theme.colors.primary}
          surface={theme.colors.surface}
          onAdd={() => router.push('/tasks/add-tasks')}
          empty={tasks.length === 0 ? 'No tasks today. Tap + to add one.' : undefined}
          emptyColor={theme.colors.muted}
          fontFamily={theme.fonts.bold}
          addBtnRef={addTaskRef}
        >
          <NestableDraggableFlatList
            data={tasks}
            keyExtractor={(t) => t.id}
            activationDistance={10}
            onDragEnd={({ data }) => void reorderTasks(data.map((t) => t.id))}
            renderItem={({ item, drag, isActive }: RenderItemParams<Task>) => (
              <Pressable
                ref={item.id === tasks[0]?.id ? firstTaskRef : undefined}
                onLongPress={drag}
                delayLongPress={250}
                style={{ opacity: isActive ? 0.85 : 1, marginBottom: 8 }}
              >
                <TaskItem
                  task={item}
                  primaryColor={theme.colors.primary}
                  mutedColor={theme.colors.muted}
                  accentColor={theme.colors.accent}
                  surfaceColor={theme.colors.surface}
                  onToggle={onToggleTask}
                  onOpenMenu={onOpenTaskMenu}
                />
              </Pressable>
            )}
          />
        </Section>

        {/* Bad habits */}
        <Section
          title="Bad Habits"
          accent={theme.colors.primary}
          surface={theme.colors.surface}
          onAdd={() => router.push('/tasks/add-bad-habits')}
          empty={badHabits.length === 0 ? 'No bad habits tracked. Tap + to add one.' : undefined}
          emptyColor={theme.colors.muted}
          fontFamily={theme.fonts.bold}
          headerRef={habitsRef}
        >
          <NestableDraggableFlatList
            data={badHabits}
            keyExtractor={(h) => h.id}
            activationDistance={10}
            onDragEnd={({ data }) => void reorderBadHabits(data.map((h) => h.id))}
            renderItem={({ item, drag, isActive }: RenderItemParams<BadHabit>) => (
              <Pressable
                onLongPress={drag}
                delayLongPress={250}
                style={{ opacity: isActive ? 0.85 : 1, marginBottom: 8 }}
              >
                <BadHabitItem
                  habit={item}
                  primaryColor={theme.colors.primary}
                  mutedColor={theme.colors.muted}
                  dangerColor={theme.colors.danger}
                  surfaceColor={theme.colors.surface}
                  onToggle={onToggleBadHabit}
                  onOpenMenu={onOpenHabitMenu}
                />
              </Pressable>
            )}
          />
        </Section>

        {/* Footer */}
        <Text style={[styles.footer, { color: theme.colors.muted }]}>
          {formatToday()}  ·  Day starts {formatDayStart(profile.day_start_time)}
        </Text>
      </NestableScrollContainer>

      {/* Level-up celebration */}
      <Modal
        transparent
        visible={levelUpEvent != null}
        animationType="fade"
        onRequestClose={clearLevelUpEvent}
      >
        <Pressable style={styles.modalRoot} onPress={clearLevelUpEvent}>
          {(() => {
            // World unlocked -> full-screen takeover in the NEW theme's
            // identity, confetti in ITS palette. Otherwise the regular
            // celebration card in the current theme.
            const worldTheme =
              levelUpEvent && levelUpEvent.unlockedThemes.length > 0
                ? getTheme(levelUpEvent.unlockedThemes[levelUpEvent.unlockedThemes.length - 1]!)
                : null;
            const palette = worldTheme ?? theme;
            return (
              <>
                <Confetti
                  colors={[
                    palette.colors.accent,
                    palette.colors.success,
                    palette.colors.primary,
                    palette.colors.secondary,
                    palette.colors.danger,
                  ]}
                />
                {levelUpEvent && worldTheme ? (
                  <WorldEntry
                    event={levelUpEvent}
                    worldTheme={worldTheme}
                    onEnter={() => {
                      void setTheme(worldTheme.id);
                      clearLevelUpEvent();
                    }}
                    onDismiss={clearLevelUpEvent}
                  />
                ) : levelUpEvent ? (
                  <LevelUpCard
                    event={levelUpEvent}
                    theme={theme}
                    onApplyTheme={(id) => {
                      void setTheme(id);
                      clearLevelUpEvent();
                    }}
                    onApplyDecoration={(id) => {
                      void setDecoration(id);
                      clearLevelUpEvent();
                    }}
                  />
                ) : null}
              </>
            );
          })()}
        </Pressable>
      </Modal>

      {/* First-run walkthrough overlay */}
      {tutorialStep != null && TUTORIAL_STEPS[tutorialStep] ? (
        <TutorialOverlay
          hole={TUTORIAL_STEPS[tutorialStep].target ? tutorialHole : null}
          title={TUTORIAL_STEPS[tutorialStep].title}
          body={TUTORIAL_STEPS[tutorialStep].body}
          nextLabel={TUTORIAL_STEPS[tutorialStep].next}
          stepIndex={tutorialStep}
          stepCount={TUTORIAL_STEPS.length}
          theme={theme}
          onNext={TUTORIAL_STEPS[tutorialStep].next ? onTutorialNext : undefined}
          onSkip={() => void finishTutorial()}
        />
      ) : null}
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
  fontFamily?: string;
  headerRef?: React.Ref<View>;
  addBtnRef?: React.Ref<View>;
  children:   React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View ref={props.headerRef} collapsable={false} style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: props.accent, fontFamily: props.fontFamily }]}>
          {props.title}
        </Text>
        <Pressable
          ref={props.addBtnRef}
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

/**
 * "NEXT UNLOCK" strip: what's coming, how far, and an ETA at the
 * user's real pace. Themes are named (hype), decorations stay "???"
 * (mystery). Null once every unlock is owned.
 */
function NextUnlockTeaser({
  level,
  totalXp,
  avgDailyXp,
  theme,
  onPressTheme,
}: {
  level:        number;
  totalXp:      number;
  avgDailyXp:   number | null;
  theme:        ReturnType<typeof useAppStore.getState>['theme'];
  onPressTheme: () => void;
}) {
  const next = getNextUnlock(level);
  if (!next) return null;

  const prev = getPreviousUnlockLevel(level);
  const span = Math.max(1, next.level - prev);
  const frac = Math.min(1, Math.max(0, (level - prev) / span));
  const levelsLeft = next.level - level;
  const xpLeft = Math.max(0, calculateTotalXpForLevel(next.level) - totalXp);
  const etaDays = avgDailyXp && avgDailyXp > 0 ? Math.max(1, Math.ceil(xpLeft / avgDailyXp)) : null;

  const label = next.mystery ? '???' : next.name.toUpperCase();

  function onPress() {
    if (next!.mystery) {
      Alert.alert('Mystery unlock', `Reach Level ${next!.level} to reveal it.`);
    } else {
      onPressTheme();
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.teaser,
        { backgroundColor: theme.colors.surface, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.teaserTop}>
        <Text style={[styles.teaserKicker, { color: theme.colors.secondary }]}>NEXT UNLOCK · LV {next.level}</Text>
        <Text style={[styles.teaserName, { color: theme.colors.accent, fontFamily: theme.fonts.bold }]} numberOfLines={1}>
          {next.kind === 'theme' ? '🌍 ' : '✨ '}{label}
        </Text>
      </View>
      <View style={[styles.teaserTrack, { backgroundColor: theme.colors.muted }]}>
        <View
          style={[
            styles.teaserFill,
            { backgroundColor: theme.colors.accent, width: `${Math.round(frac * 100)}%` },
          ]}
        />
      </View>
      <Text style={[styles.teaserSub, { color: theme.colors.secondary }]}>
        {levelsLeft} level{levelsLeft === 1 ? '' : 's'} to go
        {etaDays != null ? ` · ~${etaDays} day${etaDays === 1 ? '' : 's'} at your pace` : ''}
      </Text>
    </Pressable>
  );
}

/** First-week quest ladder card. Shows up to 3 unclaimed quests. */
function QuestsCard({
  profile,
  tasks,
  badHabits,
  theme,
  onClaim,
}: {
  profile:   NonNullable<ReturnType<typeof useAppStore.getState>['profile']>;
  tasks:     Task[];
  badHabits: BadHabit[];
  theme:     ReturnType<typeof useAppStore.getState>['theme'];
  onClaim:   (questId: string) => void;
}) {
  const claimed = profile.quests_claimed ?? [];
  const unclaimed = QUESTS.filter((q) => !claimed.includes(q.id));
  if (unclaimed.length === 0) return null;
  const visible = unclaimed.slice(0, 3);
  const state = { profile, tasks, badHabits };

  return (
    <View style={[styles.quests, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.questsHeader}>
        <Text style={[styles.questsTitle, { color: theme.colors.primary, fontFamily: theme.fonts.bold }]}>
          FIRST WEEK QUESTS
        </Text>
        <Text style={[styles.questsCount, { color: theme.colors.secondary }]}>
          {claimed.length}/{QUESTS.length}
        </Text>
      </View>
      {visible.map((q, i) => {
        const met = q.isMet(state);
        return (
          <View
            key={q.id}
            style={[
              styles.questRow,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.muted },
            ]}
          >
            <View style={styles.questText}>
              <Text style={[styles.questName, { color: met ? theme.colors.primary : theme.colors.secondary }]}>
                {q.title}
              </Text>
              <Text style={[styles.questHint, { color: theme.colors.muted }]} numberOfLines={1}>
                {met ? `+${q.rewardXp} XP ready!` : q.hint}
              </Text>
            </View>
            {met ? (
              <Pressable
                onPress={() => onClaim(q.id)}
                style={({ pressed }) => [
                  styles.questClaim,
                  { backgroundColor: theme.colors.accent, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.questClaimText, { color: theme.colors.background }]}>Claim</Text>
              </Pressable>
            ) : (
              <Text style={[styles.questReward, { color: theme.colors.muted }]}>+{q.rewardXp}</Text>
            )}
          </View>
        );
      })}
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

/**
 * Full-screen "world unlocked" takeover: the screen becomes the NEW
 * theme — its background, its font, its accent — before the user has
 * even applied it. The strongest hype moment in the app.
 */
function WorldEntry({
  event,
  worldTheme,
  onEnter,
  onDismiss,
}: {
  event:      LevelUpEvent;
  worldTheme: ReturnType<typeof getTheme>;
  onEnter:    () => void;
  onDismiss:  () => void;
}) {
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    play('levelup');
    const sparkle = setTimeout(() => play('unlock'), 550);
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 46, useNativeDriver: true }).start();
    return () => clearTimeout(sparkle);
  }, [pop]);

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const c = worldTheme.colors;
  const decoNames = event.unlockedDecorations.map((id) => getDecoration(id).name);

  return (
    <View style={[StyleSheet.absoluteFill, styles.world, { backgroundColor: c.background }]}>
      <Animated.View style={[styles.worldInner, { opacity: pop, transform: [{ scale }] }]}>
        <Text style={[styles.worldKicker, { color: c.secondary }]}>
          LEVEL {event.to} · WORLD UNLOCKED
        </Text>
        <Text style={[styles.worldName, { color: c.accent, fontFamily: worldTheme.fonts.heavy }]}>
          {worldTheme.name.toUpperCase()}
        </Text>
        <Text style={[styles.worldDesc, { color: c.primary }]}>{worldTheme.description}</Text>
        {decoNames.length > 0 ? (
          <Text style={[styles.worldExtra, { color: c.secondary }]}>
            Also unlocked: ✨ {decoNames.join(', ')}
          </Text>
        ) : null}

        <View style={styles.worldButtons}>
          <Pressable
            onPress={onEnter}
            style={({ pressed }) => [
              styles.worldEnter,
              { backgroundColor: c.accent, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.worldEnterText, { color: c.background, fontFamily: worldTheme.fonts.bold }]}>
              Enter {worldTheme.name}
            </Text>
          </Pressable>
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [styles.worldKeep, { borderColor: c.muted, opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.worldKeepText, { color: c.primary }]}>Keep my current look</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * Level-up celebration v2: spring-in card, pulsing glow, slowly
 * rotating light rays, double haptic, and — when the level-up crossed
 * a theme / decoration unlockLevel — "NEW UNLOCK" cards with a one-tap
 * Apply button.
 */
function LevelUpCard({
  event,
  theme,
  onApplyTheme,
  onApplyDecoration,
}: {
  event:              LevelUpEvent;
  theme:              ReturnType<typeof useAppStore.getState>['theme'];
  onApplyTheme:       (id: Parameters<typeof getTheme>[0]) => void;
  onApplyDecoration:  (id: Parameters<typeof getDecoration>[0]) => void;
}) {
  const colors = theme.colors;
  const fontFamily = theme.fonts.heavy;
  const pop = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const rays = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Double-tap haptic: success now, a lighter echo shortly after.
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    play('levelup');
    const sparkle =
      event.unlockedThemes.length > 0 || event.unlockedDecorations.length > 0
        ? setTimeout(() => play('unlock'), 600)
        : null;
    const echo = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 250);

    Animated.spring(pop, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    ).start();
    Animated.loop(
      Animated.timing(rays, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true }),
    ).start();
    return () => {
      clearTimeout(echo);
      if (sparkle) clearTimeout(sparkle);
    };
  }, [pop, pulse, rays]);

  const cardScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const cardOpacity = pop;
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.15] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.05] });
  const raysRotate = rays.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const unlockedThemes = event.unlockedThemes.map(getTheme);
  const unlockedDecorations = event.unlockedDecorations.map(getDecoration);
  const hasUnlocks = unlockedThemes.length > 0 || unlockedDecorations.length > 0;

  return (
    <View style={styles.levelUpWrap} pointerEvents="box-none">
      {/* Rotating light rays behind everything. */}
      <Animated.View
        style={[styles.raysWrap, { transform: [{ rotate: raysRotate }] }]}
        pointerEvents="none"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <View
            key={i}
            style={[
              styles.ray,
              {
                backgroundColor: colors.accent,
                transform: [{ rotate: `${i * 45}deg` }, { translateY: -170 }],
              },
            ]}
          />
        ))}
      </Animated.View>

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
        <Text style={[styles.modalKicker, { color: colors.accent, fontFamily }]}>LEVEL UP</Text>
        <Text style={[styles.modalLevel, { color: colors.primary, fontFamily }]}>{event.to}</Text>
        <Text style={[styles.modalName, { color: colors.secondary, fontFamily }]}>{event.levelName}</Text>

        {hasUnlocks ? (
          <View style={styles.unlocks}>
            {unlockedThemes.map((t) => (
              <View key={t.id} style={[styles.unlockCard, { borderColor: colors.accent }]}>
                <View style={[styles.unlockSwatch, { backgroundColor: t.colors.background }]}>
                  <Text style={{ color: t.colors.primary, fontFamily: t.fonts.bold, fontSize: 18 }}>Aa</Text>
                </View>
                <View style={styles.unlockMeta}>
                  <Text style={[styles.unlockKicker, { color: colors.accent }]}>NEW THEME</Text>
                  <Text style={[styles.unlockName, { color: colors.primary }]} numberOfLines={1}>
                    {t.name}
                  </Text>
                </View>
                <Pressable
                  onPress={() => onApplyTheme(t.id)}
                  style={({ pressed }) => [
                    styles.unlockApply,
                    { backgroundColor: colors.accent, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={[styles.unlockApplyText, { color: colors.background }]}>Apply</Text>
                </Pressable>
              </View>
            ))}
            {unlockedDecorations.map((d) => (
              <View key={d.id} style={[styles.unlockCard, { borderColor: colors.accent }]}>
                <View style={[styles.unlockSwatch, { backgroundColor: colors.background }]}>
                  <Ionicons name="sparkles" size={18} color={colors.accent} />
                </View>
                <View style={styles.unlockMeta}>
                  <Text style={[styles.unlockKicker, { color: colors.accent }]}>NEW DECORATION</Text>
                  <Text style={[styles.unlockName, { color: colors.primary }]} numberOfLines={1}>
                    {d.name}
                  </Text>
                </View>
                <Pressable
                  onPress={() => onApplyDecoration(d.id)}
                  style={({ pressed }) => [
                    styles.unlockApply,
                    { backgroundColor: colors.accent, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={[styles.unlockApplyText, { color: colors.background }]}>Apply</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={[styles.modalHint, { color: colors.muted }]}>tap anywhere to continue</Text>
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
  // Format in the DEVICE locale: Dutch phones show "21:00", US phones
  // "9:00 PM". The old hardcoded AM/PM read as "the wrong time" to
  // 24-hour-clock users.
  const [h = '0', m = '0'] = hms.split(':');
  const d = new Date();
  d.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  root:           { flex: 1 },
  scroll:         { paddingHorizontal: 20, paddingBottom: 32, gap: 20 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  iconBtn:        { padding: 4 },
  headerAvatar:        { width: 32, height: 32, borderRadius: 16 },
  headerAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  headerAvatarLetter:  { fontSize: 14, fontWeight: '800', includeFontPadding: false },
  brand:          { fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  atRisk:         { fontSize: 12, fontWeight: '700', letterSpacing: 1, textAlign: 'center', textTransform: 'uppercase' },
  circleWrap:     { alignItems: 'center', gap: 12, marginVertical: 8 },
  xpRead:         { fontSize: 13, letterSpacing: 0.5 },
  brandWrap:      { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center', height: '100%' },
  headerRight:    { alignItems: 'flex-end' },
  todayChip:      { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 6 },
  section:        { gap: 10 },
  sectionHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle:   { fontSize: 20, fontWeight: '800', letterSpacing: 0.3 },
  addBtn:         { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sectionBody:    { gap: 8 },
  empty:          { fontSize: 13, fontStyle: 'italic', paddingVertical: 8 },
  footer:         { fontSize: 12, textAlign: 'center', marginTop: 8 },
  teaser:         { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, gap: 7 },
  teaserTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  teaserKicker:   { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  teaserName:     { fontSize: 14, fontWeight: '800', letterSpacing: 0.5, flexShrink: 1 },
  teaserTrack:    { height: 5, borderRadius: 3, overflow: 'hidden' },
  teaserFill:     { height: 5, borderRadius: 3 },
  teaserSub:      { fontSize: 11.5, fontWeight: '600' },

  quests:         { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6 },
  questsHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  questsTitle:    { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  questsCount:    { fontSize: 11, fontWeight: '700' },
  questRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  questText:      { flex: 1, gap: 1 },
  questName:      { fontSize: 14, fontWeight: '700' },
  questHint:      { fontSize: 11.5 },
  questClaim:     { paddingHorizontal: 14, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  questClaimText: { fontSize: 13, fontWeight: '800' },
  questReward:    { fontSize: 12, fontWeight: '800' },

  xpToastLayer:   { position: 'absolute', left: 0, right: 0, top: '40%', alignItems: 'center', pointerEvents: 'none' },
  xpToast:        { position: 'absolute' },
  xpToastText:    { fontSize: 28, fontWeight: '900', letterSpacing: 0.5, textShadowColor: '#0008', textShadowRadius: 6 },
  world:          { alignItems: 'center', justifyContent: 'center', padding: 28 },
  worldInner:     { alignItems: 'center', gap: 12, width: '100%' },
  worldKicker:    { fontSize: 12, fontWeight: '800', letterSpacing: 2.5 },
  worldName:      { fontSize: 44, fontWeight: '900', textAlign: 'center', includeFontPadding: false },
  worldDesc:      { fontSize: 15, lineHeight: 22, textAlign: 'center', paddingHorizontal: 12 },
  worldExtra:     { fontSize: 13, fontWeight: '600', marginTop: 2 },
  worldButtons:   { alignSelf: 'stretch', gap: 10, marginTop: 22 },
  worldEnter:     { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  worldEnterText: { fontSize: 16, fontWeight: '800' },
  worldKeep:      { height: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  worldKeepText:  { fontSize: 14, fontWeight: '600' },
  levelUpWrap:    { alignItems: 'center', justifyContent: 'center' },
  levelUpGlow:    { position: 'absolute', width: 320, height: 320, borderRadius: 160 },
  raysWrap:       { position: 'absolute', width: 1, height: 1, alignItems: 'center', justifyContent: 'center' },
  ray:            { position: 'absolute', width: 3, height: 180, borderRadius: 2, opacity: 0.16 },
  unlocks:        { alignSelf: 'stretch', gap: 10, marginTop: 18 },
  unlockCard:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, borderWidth: 1.5 },
  unlockSwatch:   { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  unlockMeta:     { flex: 1, gap: 1 },
  unlockKicker:   { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  unlockName:     { fontSize: 15, fontWeight: '700' },
  unlockApply:    { paddingHorizontal: 14, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  unlockApplyText:{ fontSize: 13, fontWeight: '700' },
  modalRoot:      { flex: 1, backgroundColor: '#000000B0', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard:      { padding: 28, borderRadius: 20, alignItems: 'center', width: '86%', maxWidth: 360 },
  modalKicker:    { fontSize: 12, fontWeight: '800', letterSpacing: 3, marginBottom: 8 },
  modalLevel:     { fontSize: 72, fontWeight: '900', includeFontPadding: false },
  modalName:      { fontSize: 16, fontWeight: '700', letterSpacing: 1.5, marginTop: 4 },
  modalHint:      { fontSize: 11, marginTop: 16 },
});
