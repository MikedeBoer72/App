// Global app store. One Zustand store holds the cached Supabase
// data + everything the dashboard needs in one place.
//
// Conventions used everywhere below:
//   - Server is the source of truth. Mutations call Supabase first
//     and update local state from the response. Slightly slower than
//     optimistic-first, but no drift on network failure.
//   - Streak / XP transitions live in lib/*. The store just calls
//     those pure functions and persists the result.
//   - "Today" always means the user's logical day (respects
//     profile.day_start_time via currentDayFor()).

import { create } from 'zustand';

import {
  DEFAULT_THEME_ID,
  getTheme,
  type Theme,
  type ThemeId,
} from '@/constants/themes';
import { currentDayFor } from '@/lib/daily-reset';
import { applyDayComplete, applyDayMiss } from '@/lib/streak';
import { supabase } from '@/lib/supabase';
import type { BadHabit, Profile, Task } from '@/lib/types';
import {
  applyXpDelta,
  BAD_HABIT_PENALTY,
  clampDailyTaskXp,
  dailyTaskXpAwarded,
  getLevelName,
  isPrimaryTask,
  streakBonusXp,
  xpValueForNewTask,
} from '@/lib/xp';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The lifecycle state of "today" with respect to streak rules.
 *   open       - day in progress, streak not yet credited or broken
 *   succeeded  - all tasks completed, no bad habits done -> streak +1 applied
 *   failed     - at least one bad habit completed -> streak broken applied
 */
type DayState = 'open' | 'succeeded' | 'failed';

export interface LevelUpEvent {
  from:       number;
  to:         number;
  levelName:  string;
}

interface AppStore {
  // ---- state ----
  profile:       Profile | null;
  tasks:         Task[];
  badHabits:     BadHabit[];
  theme:         Theme;
  isSubscribed:  boolean;
  hydrated:      boolean;
  dayState:      DayState;
  levelUpEvent:  LevelUpEvent | null;

  // ---- pure setters (used by auth + tests) ----
  setProfile:    (profile: Profile | null) => void;
  setTasks:      (tasks: Task[]) => void;
  setBadHabits:  (habits: BadHabit[]) => void;

  // ---- bootstrap ----
  loadForUser:   (userId: string) => Promise<void>;
  reset:         () => void;

  // ---- task actions ----
  addTask:         (name: string) => Promise<Task | null>;
  completeTask:    (taskId: string) => Promise<void>;
  uncompleteTask:  (taskId: string) => Promise<void>;
  renameTask:      (taskId: string, name: string) => Promise<void>;
  deleteTask:      (taskId: string) => Promise<void>;

  // ---- bad habit actions ----
  addBadHabit:        (name: string) => Promise<BadHabit | null>;
  completeBadHabit:   (habitId: string) => Promise<void>;
  uncompleteBadHabit: (habitId: string) => Promise<void>;
  renameBadHabit:     (habitId: string, name: string) => Promise<void>;
  deleteBadHabit:     (habitId: string) => Promise<void>;

  // ---- misc ----
  setTheme:            (themeId: ThemeId) => Promise<void>;
  clearLevelUpEvent:   () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAppStore = create<AppStore>((set, get) => ({
  profile:       null,
  tasks:         [],
  badHabits:     [],
  theme:         getTheme(DEFAULT_THEME_ID),
  isSubscribed:  false,
  hydrated:      false,
  dayState:      'open',
  levelUpEvent:  null,

  // ---------------------------------------------------------------------
  // Pure setters
  // ---------------------------------------------------------------------

  setProfile(profile) {
    if (!profile) {
      set({ profile: null, theme: getTheme(DEFAULT_THEME_ID), isSubscribed: false });
      return;
    }
    set({
      profile,
      theme:         getTheme(profile.selected_font),
      isSubscribed:  profile.is_subscribed,
    });
  },

  setTasks(tasks) {
    set({ tasks });
  },

  setBadHabits(habits) {
    set({ badHabits: habits });
  },

  // ---------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------

  async loadForUser(userId) {
    try {
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single<Profile>();
      if (pErr || !profile) throw pErr ?? new Error('profile not found');

      const today = currentDayFor(new Date(), profile.day_start_time);

      const [{ data: tasks }, { data: habits }, { data: log }] = await Promise.all([
        supabase.from('tasks')      .select('*').eq('user_id', userId).eq('date', today),
        supabase.from('bad_habits') .select('*').eq('user_id', userId).eq('date', today),
        supabase.from('daily_logs') .select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
      ]);

      let dayState: DayState = 'open';
      if (log) {
        dayState = log.streak_maintained ? 'succeeded' : 'failed';
      } else if ((habits ?? []).some((h) => h.is_done)) {
        dayState = 'failed';
      }

      set({
        profile,
        theme:         getTheme(profile.selected_font),
        isSubscribed:  profile.is_subscribed,
        tasks:         (tasks  ?? []) as Task[],
        badHabits:     (habits ?? []) as BadHabit[],
        dayState,
        hydrated:      true,
      });
    } catch (err) {
      console.warn('[useAppStore] loadForUser failed', err);
      set({ hydrated: true });
    }
  },

  reset() {
    set({
      profile:       null,
      tasks:         [],
      badHabits:     [],
      theme:         getTheme(DEFAULT_THEME_ID),
      isSubscribed:  false,
      hydrated:      false,
      dayState:      'open',
      levelUpEvent:  null,
    });
  },

  // ---------------------------------------------------------------------
  // Task actions
  // ---------------------------------------------------------------------

  async addTask(name) {
    const profile = get().profile;
    if (!profile) return null;
    const trimmed = name.trim();
    if (!trimmed) return null;

    const today = currentDayFor(new Date(), profile.day_start_time);
    const count = get().tasks.length;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id:     profile.id,
          name:        trimmed,
          is_primary:  isPrimaryTask(count),
          xp_value:    xpValueForNewTask(count),
          date:        today,
        })
        .select()
        .single<Task>();
      if (error || !data) throw error ?? new Error('insert failed');

      set({ tasks: [...get().tasks, data] });
      void bumpTaskHistory(profile.id, trimmed, 'task');
      return data;
    } catch (err) {
      console.warn('[useAppStore] addTask failed', err);
      return null;
    }
  },

  async completeTask(taskId) {
    const { profile, tasks, badHabits, dayState } = get();
    if (!profile) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.is_completed) return;

    const award = clampDailyTaskXp(task.xp_value, dailyTaskXpAwarded(tasks));
    const completed: Task = {
      ...task,
      is_completed: true,
      completed_at: new Date().toISOString(),
    };
    const nextTasks = tasks.map((t) => (t.id === taskId ? completed : t));

    let nextProfile = profile;
    let nextDayState = dayState;
    let levelUpEvent: LevelUpEvent | null = null;

    // Apply per-task XP (capped to the daily 300).
    if (award > 0) {
      const xp = applyXpDelta({ total_xp: profile.total_xp, level: profile.level, deltaXp: award });
      nextProfile = { ...nextProfile, total_xp: xp.total_xp, current_xp: xp.current_xp, level: xp.level };
      if (xp.leveledUpFrom != null) {
        levelUpEvent = levelUpEventFor(xp.level, xp.leveledUpFrom);
      }
    }

    // Did this completion just finish the day cleanly? If so, +1 streak + bonus XP.
    const allDone = nextTasks.length > 0 && nextTasks.every((t) => t.is_completed);
    const noBad  = !badHabits.some((h) => h.is_done);
    if (dayState === 'open' && allDone && noBad) {
      const streak = applyDayComplete(nextProfile);
      const bonus = streakBonusXp(streak.day_streak);
      const xp = applyXpDelta({
        total_xp: nextProfile.total_xp,
        level:    nextProfile.level,
        deltaXp:  bonus,
      });
      nextProfile = {
        ...nextProfile,
        ...streak,
        total_xp:   xp.total_xp,
        current_xp: xp.current_xp,
        level:      xp.level,
      };
      nextDayState = 'succeeded';
      if (xp.leveledUpFrom != null) {
        levelUpEvent = levelUpEventFor(xp.level, xp.leveledUpFrom);
      }
    }

    // Optimistic local update.
    set({ tasks: nextTasks, profile: nextProfile, dayState: nextDayState, isSubscribed: nextProfile.is_subscribed });
    if (levelUpEvent) set({ levelUpEvent });

    // Persist.
    try {
      await Promise.all([
        supabase.from('tasks')
          .update({ is_completed: true, completed_at: completed.completed_at })
          .eq('id', taskId),
        persistProfileScore(profile.id, nextProfile),
        nextDayState === 'succeeded'
          ? upsertDailyLog(profile.id, currentDayFor(new Date(), profile.day_start_time), {
              streak_maintained: true,
              xp_earned: award + streakBonusXp(nextProfile.day_streak),
              tasks_completed: nextTasks.filter((t) => t.is_completed).length,
            })
          : Promise.resolve(),
      ]);
    } catch (err) {
      console.warn('[useAppStore] completeTask persist failed', err);
      await get().loadForUser(profile.id);
    }
  },

  async uncompleteTask(taskId) {
    const { profile, tasks } = get();
    if (!profile) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.is_completed) return;

    // Local: just mark not-complete. We do NOT refund XP — keeps the
    // store rules simple and prevents users from gaming the daily cap.
    const next = tasks.map((t) =>
      t.id === taskId ? { ...t, is_completed: false, completed_at: null } : t,
    );
    set({ tasks: next });

    try {
      await supabase.from('tasks')
        .update({ is_completed: false, completed_at: null })
        .eq('id', taskId);
    } catch (err) {
      console.warn('[useAppStore] uncompleteTask failed', err);
      await get().loadForUser(profile.id);
    }
  },

  async renameTask(taskId, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { profile, tasks } = get();
    if (!profile) return;
    set({ tasks: tasks.map((t) => (t.id === taskId ? { ...t, name: trimmed } : t)) });
    try {
      await supabase.from('tasks').update({ name: trimmed }).eq('id', taskId);
      void bumpTaskHistory(profile.id, trimmed, 'task');
    } catch (err) {
      console.warn('[useAppStore] renameTask failed', err);
      await get().loadForUser(profile.id);
    }
  },

  async deleteTask(taskId) {
    const { profile, tasks } = get();
    if (!profile) return;
    set({ tasks: tasks.filter((t) => t.id !== taskId) });
    try {
      await supabase.from('tasks').delete().eq('id', taskId);
    } catch (err) {
      console.warn('[useAppStore] deleteTask failed', err);
      await get().loadForUser(profile.id);
    }
  },

  // ---------------------------------------------------------------------
  // Bad habit actions
  // ---------------------------------------------------------------------

  async addBadHabit(name) {
    const profile = get().profile;
    if (!profile) return null;
    const trimmed = name.trim();
    if (!trimmed) return null;

    const today = currentDayFor(new Date(), profile.day_start_time);

    try {
      const { data, error } = await supabase
        .from('bad_habits')
        .insert({
          user_id:     profile.id,
          name:        trimmed,
          xp_penalty:  BAD_HABIT_PENALTY,
          date:        today,
        })
        .select()
        .single<BadHabit>();
      if (error || !data) throw error ?? new Error('insert failed');

      set({ badHabits: [...get().badHabits, data] });
      void bumpTaskHistory(profile.id, trimmed, 'bad_habit');
      return data;
    } catch (err) {
      console.warn('[useAppStore] addBadHabit failed', err);
      return null;
    }
  },

  async completeBadHabit(habitId) {
    const { profile, badHabits, dayState } = get();
    if (!profile) return;
    const habit = badHabits.find((h) => h.id === habitId);
    if (!habit || habit.is_done) return;

    const done: BadHabit = {
      ...habit,
      is_done: true,
      done_at: new Date().toISOString(),
    };
    const nextHabits = badHabits.map((h) => (h.id === habitId ? done : h));

    // XP penalty applies every time.
    const xp = applyXpDelta({
      total_xp: profile.total_xp,
      level:    profile.level,
      deltaXp:  -habit.xp_penalty,
    });
    let nextProfile: Profile = {
      ...profile,
      total_xp:   xp.total_xp,
      current_xp: xp.current_xp,
      level:      xp.level,
    };

    // The FIRST bad habit of the day is what breaks the streak.
    // Subsequent ones only cost XP. dayState tracks this transition.
    let nextDayState = dayState;
    if (dayState === 'open' || dayState === 'succeeded') {
      const streak = applyDayMiss(nextProfile);
      nextProfile = { ...nextProfile, ...streak };
      nextDayState = 'failed';
    }

    set({ badHabits: nextHabits, profile: nextProfile, dayState: nextDayState });

    try {
      await Promise.all([
        supabase.from('bad_habits')
          .update({ is_done: true, done_at: done.done_at })
          .eq('id', habitId),
        persistProfileScore(profile.id, nextProfile),
        upsertDailyLog(profile.id, currentDayFor(new Date(), profile.day_start_time), {
          streak_maintained: false,
          xp_earned:         -habit.xp_penalty,
          tasks_completed:   get().tasks.filter((t) => t.is_completed).length,
        }),
      ]);
    } catch (err) {
      console.warn('[useAppStore] completeBadHabit persist failed', err);
      await get().loadForUser(profile.id);
    }
  },

  async uncompleteBadHabit(habitId) {
    // No refund / streak un-break (intentional - undoing a bad habit
    // shouldn't restore a broken streak).
    const { profile, badHabits } = get();
    if (!profile) return;
    set({
      badHabits: badHabits.map((h) =>
        h.id === habitId ? { ...h, is_done: false, done_at: null } : h,
      ),
    });
    try {
      await supabase.from('bad_habits')
        .update({ is_done: false, done_at: null })
        .eq('id', habitId);
    } catch (err) {
      console.warn('[useAppStore] uncompleteBadHabit failed', err);
      await get().loadForUser(profile.id);
    }
  },

  async renameBadHabit(habitId, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { profile, badHabits } = get();
    if (!profile) return;
    set({ badHabits: badHabits.map((h) => (h.id === habitId ? { ...h, name: trimmed } : h)) });
    try {
      await supabase.from('bad_habits').update({ name: trimmed }).eq('id', habitId);
      void bumpTaskHistory(profile.id, trimmed, 'bad_habit');
    } catch (err) {
      console.warn('[useAppStore] renameBadHabit failed', err);
      await get().loadForUser(profile.id);
    }
  },

  async deleteBadHabit(habitId) {
    const { profile, badHabits } = get();
    if (!profile) return;
    set({ badHabits: badHabits.filter((h) => h.id !== habitId) });
    try {
      await supabase.from('bad_habits').delete().eq('id', habitId);
    } catch (err) {
      console.warn('[useAppStore] deleteBadHabit failed', err);
      await get().loadForUser(profile.id);
    }
  },

  // ---------------------------------------------------------------------
  // Misc
  // ---------------------------------------------------------------------

  async setTheme(themeId) {
    const { profile } = get();
    if (!profile) {
      set({ theme: getTheme(themeId) });
      return;
    }
    const nextProfile: Profile = { ...profile, selected_font: themeId };
    set({ profile: nextProfile, theme: getTheme(themeId) });
    try {
      await supabase.from('profiles').update({ selected_font: themeId }).eq('id', profile.id);
    } catch (err) {
      console.warn('[useAppStore] setTheme failed', err);
      await get().loadForUser(profile.id);
    }
  },

  clearLevelUpEvent() {
    set({ levelUpEvent: null });
  },
}));

// ---------------------------------------------------------------------------
// Helpers (kept private to this file)
// ---------------------------------------------------------------------------

function levelUpEventFor(toLevel: number, fromLevel: number): LevelUpEvent {
  return { from: fromLevel, to: toLevel, levelName: getLevelName(toLevel) };
}

async function persistProfileScore(userId: string, p: Profile): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      level:                          p.level,
      total_xp:                       p.total_xp,
      current_xp:                     p.current_xp,
      day_streak:                     p.day_streak,
      highest_streak:                 p.highest_streak,
      second_chance_active:           p.second_chance_active,
      second_chance_days_remaining:   p.second_chance_days_remaining,
    })
    .eq('id', userId);
  if (error) throw error;
}

async function upsertDailyLog(
  userId: string,
  date: string,
  row: { streak_maintained: boolean; xp_earned: number; tasks_completed: number },
): Promise<void> {
  const { error } = await supabase
    .from('daily_logs')
    .upsert(
      { user_id: userId, date, ...row },
      { onConflict: 'user_id,date' },
    );
  if (error) throw error;
}

async function bumpTaskHistory(
  userId: string,
  name: string,
  type: 'task' | 'bad_habit',
): Promise<void> {
  // 2-step bump (no Postgres RPC for incrementing): try to fetch
  // existing, then either update use_count or insert fresh.
  const { data: existing } = await supabase
    .from('task_history')
    .select('id, use_count')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('name', name)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('task_history')
      .update({ use_count: (existing.use_count ?? 1) + 1, last_used: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('task_history')
      .insert({ user_id: userId, name, type, use_count: 1 });
  }
}
