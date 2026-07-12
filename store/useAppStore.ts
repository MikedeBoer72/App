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

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

/** Set by onboarding when a fresh account finishes sign-up. */
export const TUTORIAL_PENDING_KEY = 'yourlevel:tutorial-pending';
/** Set once the walkthrough has been completed or skipped. */
export const TUTORIAL_DONE_KEY = 'yourlevel:tutorial-done';

import {
  DEFAULT_THEME_ID,
  getTheme,
  THEMES,
  type Theme,
  type ThemeId,
} from '@/constants/themes';
import { DECORATIONS, type DecorationId } from '@/constants/decorations';
import { QUESTS } from '@/constants/quests';
import { runDailyResetIfNeeded } from '@/lib/daily-reset';
import { syncRemindersToDayStart } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import type { BadHabit, Profile, Task } from '@/lib/types';
import {
  applyXpDelta,
  BAD_HABIT_PENALTY,
  clampDailyTaskXp,
  DAILY_TASK_XP_CAP,
  getLevelName,
  MAX_ITEMS_PER_DAY,
  xpValuePerTask,
} from '@/lib/xp';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LevelUpEvent {
  from:                 number;
  to:                   number;
  levelName:            string;
  /** Themes / decorations whose unlockLevel was crossed by this level-up. */
  unlockedThemes:       ThemeId[];
  unlockedDecorations:  DecorationId[];
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
  loadForUser:   (userId: string, opts?: { forceReset?: boolean }) => Promise<void>;
  reset:         () => void;

  // ---- task actions ----
  addTask:         (name: string) => Promise<Task | null>;
  completeTask:    (taskId: string) => Promise<{ awarded: number; leveledUp: boolean }>;
  uncompleteTask:  (taskId: string) => Promise<void>;
  renameTask:      (taskId: string, name: string) => Promise<void>;
  deleteTask:      (taskId: string) => Promise<void>;
  reorderTasks:    (orderedIds: string[]) => Promise<void>;

  // ---- bad habit actions ----
  addBadHabit:         (name: string) => Promise<BadHabit | null>;
  completeBadHabit:    (habitId: string) => Promise<void>;
  uncompleteBadHabit:  (habitId: string) => Promise<void>;
  renameBadHabit:      (habitId: string, name: string) => Promise<void>;
  deleteBadHabit:      (habitId: string) => Promise<void>;
  reorderBadHabits:    (orderedIds: string[]) => Promise<void>;

  // ---- misc ----
  setTheme:            (themeId: ThemeId) => Promise<void>;
  setDecoration:       (decorationId: DecorationId) => Promise<void>;
  setUsername:         (name: string) => Promise<void>;
  uploadAvatar:        (localUri: string) => Promise<boolean>;
  clearLevelUpEvent:   () => void;
  /** Claim a met first-week quest; returns the reward XP (0 = not claimable). */
  claimQuest:          (questId: string) => Promise<number>;

  // ---- interactive tutorial (first-run walkthrough on the dashboard) ----
  /** null = not running; otherwise index into the dashboard's step list. */
  tutorialStep:        number | null;
  startTutorial:       () => void;
  advanceTutorial:     () => void;
  finishTutorial:      () => Promise<void>;
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

  async loadForUser(userId, opts) {
    try {
      // Idempotent multi-day catch-up. Non-fatal: if the trigger that
      // creates the profile is still in flight we'll just load what we
      // have and try again next session. forceReset closes out the
      // current day even without a date advance (used when the
      // day-start boundary passes because the user moved it to later
      // the same day).
      try {
        await runDailyResetIfNeeded({ supabase, userId, forceToday: opts?.forceReset });
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

      // The active day is last_active_date (the daily reset above just
      // brought it current). Never recompute it from the wall clock
      // here: changing day_start_time mid-day would shift the computed
      // day and make the task list point at a day nothing is stamped
      // with.
      const today = profile.last_active_date;

      const [{ data: tasks }, { data: habits }] = await Promise.all([
        supabase.from('tasks')
          .select('*').eq('user_id', userId).eq('date', today)
          .order('order_index', { ascending: true })
          .order('created_at',  { ascending: true }),
        supabase.from('bad_habits')
          .select('*').eq('user_id', userId).eq('date', today)
          .order('order_index', { ascending: true })
          .order('created_at',  { ascending: true }),
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

      // Refresh reminder copy with the live streak ("14-day streak on
      // the line") — fire-and-forget, no-op when reminders are off.
      void syncRemindersToDayStart(profile.day_start_time, profile.day_streak);
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
    if (get().tasks.length >= MAX_ITEMS_PER_DAY) return null;

    const today = profile.last_active_date;
    // The 300/day cap is distributed evenly across today's tasks.
    // After this insert there'll be currentCount + 1 tasks, so each
    // incomplete task is worth floor(300 / newTotal).
    const newTotal = get().tasks.length + 1;
    const xpValue = xpValuePerTask(newTotal);
    const nextOrderIndex = Math.max(0, ...get().tasks.map((t) => t.order_index)) + 1;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id:     profile.id,
          name:        trimmed,
          is_primary:  true,
          xp_value:    xpValue,
          date:        today,
          order_index: nextOrderIndex,
        })
        .select()
        .single<Task>();
      if (error || !data) throw error ?? new Error('insert failed');

      // Re-stamp every *incomplete* task with the new shared value so
      // the displayed XP per task stays in sync. Completed tasks keep
      // the value they had at completion (locked).
      await supabase
        .from('tasks')
        .update({ xp_value: xpValue })
        .eq('user_id',     profile.id)
        .eq('date',        today)
        .eq('is_completed', false);

      set({
        tasks: [
          ...get().tasks.map((t) =>
            t.is_completed ? t : { ...t, xp_value: xpValue },
          ),
          data,
        ],
      });
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
    // Lock the *awarded* amount into xp_value so uncomplete refunds
    // exactly what was given. Without this, a cap-clamped task would
    // refund its full displayed value, costing the user XP they
    // never received.
    const completed: Task = {
      ...task,
      is_completed: true,
      completed_at: new Date().toISOString(),
      xp_value:     award,
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
          .update({
            is_completed: true,
            completed_at: completed.completed_at,
            xp_value:     award,
          })
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

    // Refund exactly what was awarded. completeTask wrote the
    // post-clamp award into xp_value so this undoes the prior
    // completion symmetrically. allowLevelDown so a level-up
    // triggered by the original completion can be reversed too.
    const refund = task.xp_value;
    const xp = applyXpDelta({
      total_xp:        profile.total_xp,
      level:           profile.level,
      deltaXp:         -refund,
      allowLevelDown:  true,
    });
    const newCounter = Math.max(0, profile.daily_task_xp_earned - refund);

    // After refund, the task rejoins the incomplete pool at the
    // current dynamic value.
    const xpValue = xpValuePerTask(tasks.length);
    const nextTasks = tasks.map((t) =>
      t.id === taskId
        ? { ...t, is_completed: false, completed_at: null, xp_value: xpValue }
        : t,
    );
    const nextProfile: Profile = {
      ...profile,
      total_xp:              xp.total_xp,
      current_xp:            xp.current_xp,
      level:                 xp.level,
      daily_task_xp_earned:  newCounter,
    };
    set({ tasks: nextTasks, profile: nextProfile });

    try {
      await Promise.all([
        supabase.from('tasks')
          .update({ is_completed: false, completed_at: null, xp_value: xpValue })
          .eq('id', taskId),
        persistProfileScore(profile.id, nextProfile),
      ]);
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

    // One fewer task means the remaining incomplete tasks each get
    // a bigger slice of the 300/day cap. Re-stamp them.
    const remaining = tasks.filter((t) => t.id !== taskId);
    const xpValue = xpValuePerTask(remaining.length);
    const next = remaining.map((t) =>
      t.is_completed ? t : { ...t, xp_value: xpValue },
    );
    set({ tasks: next });

    const today = profile.last_active_date;
    try {
      await supabase.from('tasks').delete().eq('id', taskId);
      if (remaining.length > 0) {
        await supabase
          .from('tasks')
          .update({ xp_value: xpValue })
          .eq('user_id',     profile.id)
          .eq('date',        today)
          .eq('is_completed', false);
      }
    } catch (err) {
      console.warn('[useAppStore] deleteTask failed', err);
      await get().loadForUser(profile.id);
    }
  },

  async reorderTasks(orderedIds) {
    const { profile, tasks } = get();
    if (!profile) return;

    // Apply the new order locally first (optimistic) then push the
    // order_index updates in parallel. Rows missing from orderedIds
    // (concurrent insert) keep their existing order_index.
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const reordered = orderedIds
      .map((id) => byId.get(id))
      .filter((t): t is Task => !!t);
    if (reordered.length !== tasks.length) {
      // Append any tasks not in the new order so we don't lose them.
      for (const t of tasks) if (!orderedIds.includes(t.id)) reordered.push(t);
    }
    const stamped = reordered.map((t, i) => ({ ...t, order_index: i }));
    set({ tasks: stamped });

    try {
      await Promise.all(
        stamped.map((t, i) =>
          supabase.from('tasks').update({ order_index: i }).eq('id', t.id),
        ),
      );
    } catch (err) {
      console.warn('[useAppStore] reorderTasks failed', err);
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
    if (get().badHabits.length >= MAX_ITEMS_PER_DAY) return null;

    const today = profile.last_active_date;
    const nextOrderIndex = Math.max(0, ...get().badHabits.map((h) => h.order_index)) + 1;

    try {
      const { data, error } = await supabase
        .from('bad_habits')
        .insert({
          user_id:     profile.id,
          name:        trimmed,
          xp_penalty:  BAD_HABIT_PENALTY,
          date:        today,
          order_index: nextOrderIndex,
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
    const { profile, badHabits } = get();
    if (!profile) return;
    const habit = badHabits.find((h) => h.id === habitId);
    if (!habit || !habit.is_done) return;

    const normalized = habit.name.trim().toLowerCase();
    const wasPenalized = profile.bad_habits_penalized_today.includes(normalized);

    let nextProfile: Profile = profile;
    if (wasPenalized) {
      // Refund the penalty + remove the name from the penalized list
      // so re-completing this name later applies the penalty again.
      const xp = applyXpDelta({
        total_xp: profile.total_xp,
        level:    profile.level,
        deltaXp:  habit.xp_penalty,
      });
      nextProfile = {
        ...profile,
        total_xp:                   xp.total_xp,
        current_xp:                 xp.current_xp,
        level:                      xp.level,
        daily_bad_habit_xp_lost:    Math.max(0, profile.daily_bad_habit_xp_lost - habit.xp_penalty),
        bad_habits_penalized_today: profile.bad_habits_penalized_today.filter((n) => n !== normalized),
      };
    }

    set({
      badHabits: badHabits.map((h) =>
        h.id === habitId ? { ...h, is_done: false, done_at: null } : h,
      ),
      profile: nextProfile,
    });

    try {
      await Promise.all([
        supabase.from('bad_habits')
          .update({ is_done: false, done_at: null })
          .eq('id', habitId),
        wasPenalized ? persistProfileScore(profile.id, nextProfile) : Promise.resolve(),
      ]);
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

  async reorderBadHabits(orderedIds) {
    const { profile, badHabits } = get();
    if (!profile) return;
    const byId = new Map(badHabits.map((h) => [h.id, h]));
    const reordered = orderedIds
      .map((id) => byId.get(id))
      .filter((h): h is BadHabit => !!h);
    if (reordered.length !== badHabits.length) {
      for (const h of badHabits) if (!orderedIds.includes(h.id)) reordered.push(h);
    }
    const stamped = reordered.map((h, i) => ({ ...h, order_index: i }));
    set({ badHabits: stamped });

    try {
      await Promise.all(
        stamped.map((h, i) =>
          supabase.from('bad_habits').update({ order_index: i }).eq('id', h.id),
        ),
      );
    } catch (err) {
      console.warn('[useAppStore] reorderBadHabits failed', err);
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

  async setDecoration(decorationId) {
    const { profile } = get();
    if (!profile) return;
    const nextProfile: Profile = { ...profile, selected_decoration: decorationId };
    set({ profile: nextProfile });
    try {
      await supabase.from('profiles').update({ selected_decoration: decorationId }).eq('id', profile.id);
    } catch (err) {
      console.warn('[useAppStore] setDecoration failed', err);
      await get().loadForUser(profile.id);
    }
  },

  async setUsername(name) {
    const { profile } = get();
    if (!profile) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const nextProfile: Profile = { ...profile, username: trimmed };
    set({ profile: nextProfile });
    try {
      await supabase.from('profiles').update({ username: trimmed }).eq('id', profile.id);
    } catch (err) {
      console.warn('[useAppStore] setUsername failed', err);
      await get().loadForUser(profile.id);
    }
  },

  async uploadAvatar(localUri) {
    const { profile } = get();
    if (!profile) return false;
    try {
      // Read the picked image as an ArrayBuffer and push to storage.
      // Path is namespaced under the user id so the RLS policies
      // (which gate by storage.foldername(name)[1] === auth.uid())
      // accept the upload.
      const response = await fetch(localUri);
      const buffer = await response.arrayBuffer();
      const path = `${profile.id}/avatar.jpg`;

      const { error: upErr } = await supabase
        .storage
        .from('avatars')
        .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      // Cache-bust so the freshly-uploaded image overrides the old
      // cached one immediately on the device.
      const url = `${pub.publicUrl}?t=${Date.now()}`;

      const nextProfile: Profile = { ...profile, avatar_url: url };
      set({ profile: nextProfile });

      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', profile.id);
      if (dbErr) throw dbErr;

      return true;
    } catch (err) {
      console.warn('[useAppStore] uploadAvatar failed', err);
      return false;
    }
  },

  clearLevelUpEvent() {
    set({ levelUpEvent: null });
  },

  async claimQuest(questId) {
    const { profile, tasks, badHabits } = get();
    if (!profile) return 0;
    const quest = QUESTS.find((q) => q.id === questId);
    if (!quest) return 0;
    if (profile.quests_claimed.includes(questId)) return 0;
    if (!quest.isMet({ profile, tasks, badHabits })) return 0;

    // Quest XP is a bonus: it bypasses the 300/day task cap on purpose.
    const xp = applyXpDelta({
      total_xp: profile.total_xp,
      level:    profile.level,
      deltaXp:  quest.rewardXp,
    });
    const nextProfile: Profile = {
      ...profile,
      total_xp:       xp.total_xp,
      current_xp:     xp.current_xp,
      level:          xp.level,
      quests_claimed: [...profile.quests_claimed, questId],
    };
    set({ profile: nextProfile });
    if (xp.leveledUpFrom != null) {
      set({ levelUpEvent: levelUpEventFor(xp.level, xp.leveledUpFrom) });
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          total_xp:       nextProfile.total_xp,
          current_xp:     nextProfile.current_xp,
          level:          nextProfile.level,
          quests_claimed: nextProfile.quests_claimed,
        })
        .eq('id', profile.id);
      if (error) throw error;
    } catch (err) {
      console.warn('[useAppStore] claimQuest persist failed', err);
      await get().loadForUser(profile.id);
      return 0;
    }
    return quest.rewardXp;
  },

  tutorialStep: null,

  startTutorial() {
    set({ tutorialStep: 0 });
  },

  advanceTutorial() {
    const cur = get().tutorialStep;
    if (cur == null) return;
    set({ tutorialStep: cur + 1 });
  },

  async finishTutorial() {
    set({ tutorialStep: null });
    try {
      await AsyncStorage.setItem(TUTORIAL_DONE_KEY, 'true');
      await AsyncStorage.removeItem(TUTORIAL_PENDING_KEY);
    } catch {
      // non-fatal: worst case the tutorial offers itself again
    }
  },
}));

// ---------------------------------------------------------------------------
// Helpers (kept private to this file)
// ---------------------------------------------------------------------------

function levelUpEventFor(toLevel: number, fromLevel: number): LevelUpEvent {
  return {
    from:      fromLevel,
    to:        toLevel,
    levelName: getLevelName(toLevel),
    unlockedThemes: THEMES
      .filter((t) => t.unlockLevel > fromLevel && t.unlockLevel <= toLevel)
      .map((t) => t.id),
    unlockedDecorations: DECORATIONS
      .filter((d) => d.unlockLevel > fromLevel && d.unlockLevel <= toLevel)
      .map((d) => d.id),
  };
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
