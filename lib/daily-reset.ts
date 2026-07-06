// Daily reset logic.
//
// iOS background-fetch is best-effort — Apple decides whether and when
// to actually fire the task. So this module is built around a single
// idempotent function, `runDailyResetIfNeeded`, that can be called
// from THREE places:
//
//   1. App launch / foreground (the reliable path)
//   2. The background-fetch task defined below (opportunistic)
//   3. After the user changes their day_start_time
//
// The pure helpers are exported separately so they can be unit-tested
// without a Supabase client.

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { BadHabit, Profile, Task } from './types';
import { applyDayComplete, applyDayMiss } from './streak';
import { applyXpDelta, dailyTaskXpAwarded, streakBonusXp } from './xp';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Returns YYYY-MM-DD for the "current" logical day, given the user's
 * day_start_time. Before today's start time the logical day is still
 * yesterday.
 */
export function currentDayFor(now: Date, dayStartTime: string): string {
  const [h, m] = parseTime(dayStartTime);
  const startMinutes = h * 60 + m;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (nowMinutes < startMinutes) date.setDate(date.getDate() - 1);
  return formatYmd(date);
}

export function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nextYmd(ymd: string): string {
  const d = parseYmd(ymd);
  d.setDate(d.getDate() + 1);
  return formatYmd(d);
}

export function previousYmd(ymd: string): string {
  const d = parseYmd(ymd);
  d.setDate(d.getDate() - 1);
  return formatYmd(d);
}

/** Inclusive day count between two YYYY-MM-DD strings. */
export function daysBetween(fromYmd: string, toYmd: string): number {
  const ms = parseYmd(toYmd).getTime() - parseYmd(fromYmd).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export interface DaySummary {
  allTasksComplete:      boolean;
  anyBadHabitDone:       boolean;
  successful:            boolean;
  tasksCompletedCount:   number;
  taskCount:             number;
}

/** Summarize whether a day was a streak success. Empty days count as a miss. */
export function summarizeDay(opts: { tasks: Task[]; badHabits: BadHabit[] }): DaySummary {
  const tasksCompletedCount = opts.tasks.filter((t) => t.is_completed).length;
  const taskCount = opts.tasks.length;
  const allTasksComplete = taskCount > 0 && tasksCompletedCount === taskCount;
  const anyBadHabitDone = opts.badHabits.some((h) => h.is_done);
  return {
    allTasksComplete,
    anyBadHabitDone,
    successful: allTasksComplete && !anyBadHabitDone,
    tasksCompletedCount,
    taskCount,
  };
}

function parseTime(s: string): [number, number] {
  const [h = '0', m = '0'] = s.split(':');
  return [Number(h) || 0, Number(m) || 0];
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

// ---------------------------------------------------------------------------
// Orchestration (Supabase-backed)
// ---------------------------------------------------------------------------

export interface DailyResetResult {
  daysProcessed:  string[];
  newProfile:     Profile | null;
}

/**
 * Closes out every logical day that has elapsed since `last_active_date`
 * up to (but not including) "today". Updates streak + XP, writes a
 * daily_logs row per closed day, and finally clears today's task
 * completion state.
 *
 * Idempotent: re-running on the same day is a no-op.
 */
export async function runDailyResetIfNeeded(opts: {
  supabase:  SupabaseClient;
  userId:    string;
  now?:      Date;
  /**
   * Close out the CURRENT day even though its date hasn't advanced.
   * Used when the user moves day_start_time to later today: the
   * boundary passes without a calendar-date change, which the normal
   * date-walk can't see. The closed day keeps its date; the "new" day
   * continues under the same date (its next close-out upserts over
   * the same daily_logs row).
   */
  forceToday?: boolean;
}): Promise<DailyResetResult> {
  const now = opts.now ?? new Date();

  const { data: profile, error } = await opts.supabase
    .from('profiles')
    .select('*')
    .eq('id', opts.userId)
    .single<Profile>();
  if (error || !profile) {
    throw error ?? new Error('profile not found');
  }

  const today = currentDayFor(now, profile.day_start_time);
  if (profile.last_active_date >= today) {
    if (!opts.forceToday) {
      return { daysProcessed: [], newProfile: profile };
    }
    // Same-date boundary crossing: evaluate + log the current day,
    // wipe the lists, zero the daily caps — but keep last_active_date.
    const closed = await closeOutDay({
      supabase: opts.supabase,
      userId:   opts.userId,
      profile,
      day:      profile.last_active_date,
    });
    await opts.supabase.from('tasks').delete().eq('user_id', opts.userId);
    await opts.supabase.from('bad_habits').delete().eq('user_id', opts.userId);
    const { data: forced, error: fErr } = await opts.supabase
      .from('profiles')
      .update({
        level:                          closed.profile.level,
        total_xp:                       closed.profile.total_xp,
        current_xp:                     closed.profile.current_xp,
        day_streak:                     closed.profile.day_streak,
        highest_streak:                 closed.profile.highest_streak,
        second_chance_active:           closed.profile.second_chance_active,
        second_chance_days_remaining:   closed.profile.second_chance_days_remaining,
        daily_task_xp_earned:           0,
        daily_bad_habit_xp_lost:        0,
        bad_habits_penalized_today:     [],
      })
      .eq('id', opts.userId)
      .select('*')
      .single<Profile>();
    if (fErr) throw fErr;
    return { daysProcessed: [profile.last_active_date], newProfile: forced };
  }

  let running: Profile = { ...profile };
  const daysProcessed: string[] = [];

  // Walk every day from last_active_date up to (but not including) today.
  let cursor = running.last_active_date;
  while (cursor < today) {
    const closed = await closeOutDay({ supabase: opts.supabase, userId: opts.userId, profile: running, day: cursor });
    running = closed.profile;
    daysProcessed.push(cursor);
    cursor = nextYmd(cursor);
  }

  // Wipe the prior day's tasks AND bad habits so the user starts
  // each new day with empty lists and has to consciously re-add
  // what matters / what they're fighting. task_history is untouched
  // so the suggestion chips still surface recent names for one-tap
  // re-add.
  await opts.supabase
    .from('tasks')
    .delete()
    .eq('user_id', opts.userId);
  await opts.supabase
    .from('bad_habits')
    .delete()
    .eq('user_id', opts.userId);

  // Persist the running profile.
  const profilePatch = {
    level:                          running.level,
    total_xp:                       running.total_xp,
    current_xp:                     running.current_xp,
    day_streak:                     running.day_streak,
    highest_streak:                 running.highest_streak,
    second_chance_active:           running.second_chance_active,
    second_chance_days_remaining:   running.second_chance_days_remaining,
    last_active_date:               today,
    // Reset the daily caps now that a new day has started.
    daily_task_xp_earned:           0,
    daily_bad_habit_xp_lost:        0,
    bad_habits_penalized_today:     [],
  };
  const { data: updated, error: upErr } = await opts.supabase
    .from('profiles')
    .update(profilePatch)
    .eq('id', opts.userId)
    .select('*')
    .single<Profile>();
  if (upErr) throw upErr;

  return { daysProcessed, newProfile: updated };
}

async function closeOutDay(opts: {
  supabase:  SupabaseClient;
  userId:    string;
  profile:   Profile;
  day:       string;
}): Promise<{ profile: Profile }> {
  const { data: rawTasks } = await opts.supabase
    .from('tasks')
    .select('*')
    .eq('user_id', opts.userId)
    .eq('date', opts.day);
  const { data: rawHabits } = await opts.supabase
    .from('bad_habits')
    .select('*')
    .eq('user_id', opts.userId)
    .eq('date', opts.day);

  const tasks     = (rawTasks  ?? []) as Task[];
  const badHabits = (rawHabits ?? []) as BadHabit[];
  const summary = summarizeDay({ tasks, badHabits });

  // Net XP earned during the day = task XP (re-clamped to the 300/day
  // cap in completion order) - sum of bad-habit penalties applied
  // in real time + streak bonus on a successful day.
  const taskXp     = dailyTaskXpAwarded(tasks);
  const penaltyXp  = badHabits.filter((h) => h.is_done).reduce((s, h) => s + h.xp_penalty, 0);

  let p = opts.profile;
  let bonus = 0;

  if (summary.successful) {
    const streakNext = applyDayComplete(p);
    bonus = streakBonusXp(streakNext.day_streak);
    const xp = applyXpDelta({ total_xp: p.total_xp, level: p.level, deltaXp: bonus });
    p = { ...p, ...streakNext, total_xp: xp.total_xp, current_xp: xp.current_xp, level: xp.level };
  } else {
    p = { ...p, ...applyDayMiss(p) };
  }

  const xpEarnedForLog = taskXp + bonus - penaltyXp;

  await opts.supabase
    .from('daily_logs')
    .upsert(
      {
        user_id:            opts.userId,
        date:               opts.day,
        xp_earned:          xpEarnedForLog,
        tasks_completed:    summary.tasksCompletedCount,
        streak_maintained:  summary.successful,
      },
      { onConflict: 'user_id,date' },
    );

  return { profile: p };
}

// ---------------------------------------------------------------------------
// Background-fetch wiring (iOS best-effort)
// ---------------------------------------------------------------------------

export const DAILY_RESET_TASK_NAME = 'yourlevel-daily-reset';

/**
 * Defines the background task. Must be called at module scope (i.e.
 * from a file imported by the app entry) — TaskManager requires it.
 * The provided handler should call `runDailyResetIfNeeded` for the
 * currently logged-in user.
 */
export function defineDailyResetBackgroundTask(handler: () => Promise<void>): void {
  if (TaskManager.isTaskDefined(DAILY_RESET_TASK_NAME)) return;
  TaskManager.defineTask(DAILY_RESET_TASK_NAME, async () => {
    try {
      await handler();
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

/**
 * Asks iOS to schedule the task. iOS may still ignore the request or
 * fire it whenever it pleases — treat success as best-effort and
 * always run the foreground reset on app open.
 *
 * Wrapped in try/catch because Expo Go on iOS ships without the
 * `fetch` UIBackgroundMode entitlement and registerTaskAsync throws.
 * Once you build a real dev client / production build via EAS with
 * app.json's UIBackgroundModes intact, this will actually register.
 */
export async function ensureDailyResetBackgroundFetch(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      return;
    }
    const registered = await TaskManager.isTaskRegisteredAsync(DAILY_RESET_TASK_NAME);
    if (registered) return;
    await BackgroundFetch.registerTaskAsync(DAILY_RESET_TASK_NAME, {
      minimumInterval: 15 * 60,   // iOS treats this as a hint
      stopOnTerminate: false,
      startOnBoot:     true,
    });
  } catch (err) {
    console.warn('[daily-reset] background fetch not available (expected in Expo Go):', err);
  }
}
