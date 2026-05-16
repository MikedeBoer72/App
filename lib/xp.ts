// XP + level math for MAXING.ai.
//
// Everything here is a pure function so the rules are unit-testable
// without touching Supabase or the store.

import { LEVEL_TIERS, XP_BANDS } from '@/constants/levels';

// ---------------------------------------------------------------------------
// Rule constants
// ---------------------------------------------------------------------------

/** Max XP a user can earn from completing tasks in one day. */
export const DAILY_TASK_XP_CAP = 300;

/** XP awarded for one of the first 3 tasks of the day. */
export const PRIMARY_TASK_XP = 100;

/** XP awarded for tasks 4+ of the day. */
export const EXTRA_TASK_XP = 50;

/** First N tasks of the day are "primary" and worth more. */
export const PRIMARY_TASK_LIMIT = 3;

/** Flat XP penalty when a bad habit is marked done. */
export const BAD_HABIT_PENALTY = 200;

/** Streak bonus XP awarded per day in the streak (stacks, no cap). */
export const STREAK_BONUS_PER_DAY = 5;

// ---------------------------------------------------------------------------
// Level <-> XP curve
// ---------------------------------------------------------------------------

/** XP needed to advance from `level` to `level + 1`. */
export function calculateXpForLevel(level: number): number {
  for (const band of XP_BANDS) {
    if (level >= band.minLevel && level <= band.maxLevel) return band.xpPerLevel;
  }
  // Fallback for sub-1 inputs: behave like level 1.
  return XP_BANDS[0]!.xpPerLevel;
}

/** Cumulative XP required to *reach* `level`. Level 1 = 0 XP. */
export function calculateTotalXpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 1; l < level; l++) total += calculateXpForLevel(l);
  return total;
}

/** Highest level whose cumulative threshold is <= totalXp. */
export function getLevelFromXp(totalXp: number): number {
  if (totalXp <= 0) return 1;
  let level = 1;
  let needed = calculateXpForLevel(level);
  while (totalXp >= needed) {
    totalXp -= needed;
    level += 1;
    needed = calculateXpForLevel(level);
  }
  return level;
}

export interface XpProgress {
  level:           number;
  currentXp:       number;   // XP earned toward the next level
  xpToNextLevel:   number;   // total XP required to reach next level
  progress:        number;   // 0..1
  levelName:       string;
}

/** All the numbers the dashboard's LevelCircle needs in one call. */
export function getXpProgress(totalXp: number): XpProgress {
  const level = getLevelFromXp(totalXp);
  const cumulative = calculateTotalXpForLevel(level);
  const xpToNextLevel = calculateXpForLevel(level);
  const currentXp = Math.max(0, totalXp - cumulative);
  return {
    level,
    currentXp,
    xpToNextLevel,
    progress: xpToNextLevel > 0 ? currentXp / xpToNextLevel : 0,
    levelName: getLevelName(level),
  };
}

/** Tier name for `level` — the highest tier whose minLevel <= level. */
export function getLevelName(level: number): string {
  let name = LEVEL_TIERS[0]!.name;
  for (const tier of LEVEL_TIERS) {
    if (level >= tier.minLevel) name = tier.name;
    else break;
  }
  return name;
}

// ---------------------------------------------------------------------------
// Per-task helpers (used at task creation + completion time)
// ---------------------------------------------------------------------------

/** Is this task a primary one given how many tasks are already on today's list? */
export function isPrimaryTask(currentTaskCountToday: number): boolean {
  return currentTaskCountToday < PRIMARY_TASK_LIMIT;
}

/** XP value to stamp onto a brand-new task at creation time. */
export function xpValueForNewTask(currentTaskCountToday: number): number {
  return isPrimaryTask(currentTaskCountToday) ? PRIMARY_TASK_XP : EXTRA_TASK_XP;
}

/**
 * Clamps a raw task-XP award against the daily cap.
 * Returns the XP that should actually be granted (>= 0).
 */
export function clampDailyTaskXp(rawXp: number, alreadyEarnedToday: number): number {
  const remaining = Math.max(0, DAILY_TASK_XP_CAP - alreadyEarnedToday);
  return Math.max(0, Math.min(rawXp, remaining));
}

/** Streak bonus XP for a given streak length. */
export function streakBonusXp(streakDays: number): number {
  return Math.max(0, streakDays) * STREAK_BONUS_PER_DAY;
}

// ---------------------------------------------------------------------------
// XP application (combines: raw delta -> new total_xp / current_xp / level)
// ---------------------------------------------------------------------------

export interface XpDeltaResult {
  total_xp:       number;
  current_xp:     number;
  level:          number;
  leveledUpFrom:  number | null;   // previous level if a level-up happened
}

/**
 * Applies a positive or negative XP delta to a running total.
 *
 * Levels are monotonic: a penalty can shave XP but never costs you a
 * level. The floor is `calculateTotalXpForLevel(currentLevel)` — i.e.
 * a penalty at the very start of a level is a no-op. This keeps users
 * from getting kicked back through the L5 paywall by a bad habit.
 */
export function applyXpDelta(opts: {
  total_xp:   number;
  level:      number;
  deltaXp:    number;
}): XpDeltaResult {
  const rawTotal = Math.max(0, opts.total_xp + opts.deltaXp);
  const recomputed = getLevelFromXp(rawTotal);
  const finalLevel = Math.max(opts.level, recomputed);
  const floor = calculateTotalXpForLevel(finalLevel);
  const newTotal = Math.max(rawTotal, floor);
  return {
    total_xp:      newTotal,
    current_xp:    newTotal - floor,
    level:         finalLevel,
    leveledUpFrom: finalLevel > opts.level ? opts.level : null,
  };
}

// ---------------------------------------------------------------------------
// Daily roll-up
// ---------------------------------------------------------------------------

/**
 * Total task-XP the user has actually been awarded today, respecting
 * the 300/day cap. Re-clamps in completion order so tasks completed
 * after the cap was hit correctly contribute zero.
 */
export function dailyTaskXpAwarded(tasks: Array<{
  is_completed:  boolean;
  xp_value:      number;
  completed_at:  string | null;
}>): number {
  const ordered = tasks
    .filter((t) => t.is_completed && t.completed_at)
    .slice()
    .sort((a, b) => (a.completed_at! < b.completed_at! ? -1 : 1));
  let awarded = 0;
  for (const t of ordered) {
    awarded += clampDailyTaskXp(t.xp_value, awarded);
  }
  return awarded;
}
