// Global app store. One Zustand store holds the cached Supabase
// data + everything the dashboard needs in one place.
//
// Conventions used everywhere below:
//   - Server is the source of truth. Mutations call Supabase first
//     (or optimistically + persist) and reconcile from the response.
//     Errors trigger a loadForUser refetch rather than silent drift.
//   - "Today" always means the user's logical day (respects
//     profile.day_start_time via currentDayFor()).
//
// Streak transitions are intentionally NOT applied in real time.
// Doing them eagerly creates an order-dependency bug: completing all
// tasks then a bad habit would award +1 streak then burn it again
// (possibly chewing through the user's second chance in one move).
// Instead, completeTask / completeBadHabit only adjust XP. The
// streak number you see all day reflects what you had going into
// today; it ticks over (up, down, or into second-chance) when daily
// reset closes the day out. The dashboard surfaces a "at risk"
// indicator when there's a bad habit done today so the user still
// sees immediate feedback.

import { create } from 'zustand';

import {
  DEFAULT_THEME_ID,
  getTheme,
  type Theme,
  type ThemeId,
} from '@/constants/themes';
import { currentDayFor, runDailyResetIfNeeded } from '@/lib/daily-reset';
import { supabase } from '@/lib/supabase';
import type { BadHabit, Profile, Task } from '@/lib/types';
import {
  applyXpDelta,
  BAD_HABIT_PENALTY,
  clampDailyTaskXp,
  dailyTaskXpAwarded,
  getLevelName,
  isPrimaryTask,
  xpValueForNewTask,
} from '@/lib/xp';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  loadError:     string | null;
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
  completeTask:    (taskId: string) => Promise<{ awarded: number; leveledUp: boolean }>;
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
  loadError:     null,
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
      // Idempotent multi-day catch-up. Non-fatal: if the trigger that
      // creates the profile is still in flight we'll just load what we
      // have and try again next session.
      try {
        await runDailyResetIfNeeded({ supabase, userId });
      } catch (resetErr) {
        console.warn('[useAppStore] daily reset failed (non-fatal)', resetErr);
      }

      // Fetch the profile. If it's missing, create one - covers two
      // cases:
      //   - the handle_new_user trigger somehow didn't fire
      //   - the user previously hit "Delete Account" then signed back in
      //     with the same provider (no auth.users INSERT, so the trigger
      //     wouldn't refire)
      let profile: Profile | null = null;
      {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle<Profile>();
        if (error && error.code !== 'PGRST116') throw error;
        profile = data;
      }
      if (!profile) {
        const { data: created, error: cErr } = await supabase
          .from('profiles')
          .insert({ id: userId })
          .select('*')
          .single<Profile>();
        if (cErr || !created) throw cErr ?? new Error('Failed to create profile');
        profile = created;
      }

      const today = currentDayFor(new Date(), profile.day_start_time);

      const [{ data: tasks }, { data: habits }] = await Promise.all([
        supabase.from('tasks')      .select('*').eq('user_id', userId).eq('date', today),
        supabase.from('bad_habits') .select('*').eq('user_id', userId).eq('date', today),
      ]);

      set({
        profile,
        theme:         getTheme(profile.selected_font),
        isSubscribed:  profile.is_subscribed,
        tasks:         (tasks  ?? []) as Task[],
        badHabits:     (habits ?? []) as BadHabit[],
        loadError:     null,
        hydrated:      true,
      });
    } catch (err) {
      console.warn('[useAppStore] loadForUser failed', err);
      set({
        loadError: err instanceof Error ? err.message : 'Failed to load profile',
        hydrated:  true,
      });
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
      loadError:     null,
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
    const { profile, tasks } = get();
    if (!profile) return { awarded: 0, leveledUp: false };
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.is_completed) return { awarded: 0, leveledUp: false };

    // Cap is enforced against the profile counter, not the current
    // tasks array, so deleting+re-adding completed tasks can't grind
    // past the 300/day limit.
    const award = clampDailyTaskXp(task.xp_value, profile.daily_task_xp_earned);
    const completed: Task = {
      ...task,
      is_completed: true,
      completed_at: new Date().toISOString(),
    };
    const nextTasks = tasks.map((t) => (t.id === taskId ? completed : t));

    let nextProfile = profile;
    let levelUpEvent: LevelUpEvent | null = null;

    if (award > 0) {
      const xp = applyXpDelta({ total_xp: profile.total_xp, level: profile.level, deltaXp: award });
      nextProfile = {
        ...nextProfile,
        total_xp:               xp.total_xp,
        current_xp:             xp.current_xp,
        level:                  xp.level,
        daily_task_xp_earned:   profile.daily_task_xp_earned + award,
      };
      if (xp.leveledUpFrom != null) {
        levelUpEvent = levelUpEventFor(xp.level, xp.leveledUpFrom);
      }
    }

    set({ tasks: nextTasks, profile: nextProfile, isSubscribed: nextProfile.is_subscribed });
    if (levelUpEvent) set({ levelUpEvent });

    try {
      await Promise.all([
        supabase.from('tasks')
          .update({ is_completed: true, completed_at: completed.completed_at })
          .eq('id', taskId),
        award > 0 ? persistProfileScore(profile.id, nextProfile) : Promise.resolve(),
      ]);
    } catch (err) {
      console.warn('[useAppStore] completeTask persist failed', err);
      await get().loadForUser(profile.id);
    }

    return { awarded: award, leveledUp: levelUpEvent != null };
  },

  async uncompleteTask(taskId) {
    const { profile, tasks } = get();
    if (!profile) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.is_completed) return;

    // Local: just mark not-complete. We do NOT refund XP — keeps the
    // store rules simple and prevents users from gaming the daily cap
    // by toggle-spamming.
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
    const { profile, badHabits } = get();
    if (!profile) return;
    const habit = badHabits.find((h) => h.id === habitId);
    if (!habit || habit.is_done) return;

    const done: BadHabit = {
      ...habit,
      is_done: true,
      done_at: new Date().toISOString(),
    };
    const nextHabits = badHabits.map((h) => (h.id === habitId ? done : h));

    // Penalty is skipped if a bad habit with this name has already
    // been penalized today - prevents gaming by deleting + re-adding
    // the same habit. Streak break still happens at daily-reset
    // close-out, not here, so the order of completions can't
    // double-apply applyDayMiss.
    const normalized = habit.name.trim().toLowerCase();
    const alreadyPenalized = profile.bad_habits_penalized_today.includes(normalized);

    let nextProfile: Profile;
    if (alreadyPenalized) {
      // Mark done locally + remote, but no XP change.
      nextProfile = profile;
    } else {
      const xp = applyXpDelta({
        total_xp: profile.total_xp,
        level:    profile.level,
        deltaXp:  -habit.xp_penalty,
      });
      nextProfile = {
        ...profile,
        total_xp:                   xp.total_xp,
        current_xp:                 xp.current_xp,
        level:                      xp.level,
        daily_bad_habit_xp_lost:    profile.daily_bad_habit_xp_lost + habit.xp_penalty,
        bad_habits_penalized_today: [...profile.bad_habits_penalized_today, normalized],
      };
    }

    set({ badHabits: nextHabits, profile: nextProfile });

    try {
      await Promise.all([
        supabase.from('bad_habits')
          .update({ is_done: true, done_at: done.done_at })
          .eq('id', habitId),
        alreadyPenalized ? Promise.resolve() : persistProfileScore(profile.id, nextProfile),
      ]);
    } catch (err) {
      console.warn('[useAppStore] completeBadHabit persist failed', err);
      await get().loadForUser(profile.id);
    }
  },

  async uncompleteBadHabit(habitId) {
    // No XP refund (gaming defense). Streak isn't restored either,
    // but since the streak transition only fires at daily reset and
    // reset checks the current (post-undo) state, undoing all bad
    // habits today before reset DOES restore tomorrow's +1.
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
      daily_task_xp_earned:           p.daily_task_xp_earned,
      daily_bad_habit_xp_lost:        p.daily_bad_habit_xp_lost,
      bad_habits_penalized_today:     p.bad_habits_penalized_today,
    })
    .eq('id', userId);
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
