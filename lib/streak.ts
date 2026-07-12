// Streak rules for YourLevel. Pure functions returning a new
// StreakState — they never mutate their input, never touch Supabase.
//
// Protection layers, in the order they absorb a missed day:
//   1. STREAK FREEZE — banked item. Earn 1 for every 7 consecutive
//      clean days (capped at MAX_STREAK_FREEZES). A miss silently
//      consumes one and the streak is untouched.
//   2. SECOND CHANCE (from spec) — if streak >= 20 and the user
//      misses a day, the streak is NOT reset. A 20-day redemption
//      window begins; each clean day counts it down; surviving the
//      window replenishes the second chance; failing inside it (with
//      no freeze left) zeroes the streak.
//
// Freezes survive streak resets — they were earned; losing them with
// the streak would double-punish.

import type { StreakState } from './types';

/** Streak length at which the second chance becomes available. */
export const SECOND_CHANCE_MIN_STREAK = 20;

/** Number of clean days required to replenish a used second chance. */
export const SECOND_CHANCE_WINDOW_DAYS = 20;

/** Earn one freeze every N consecutive clean days... */
export const FREEZE_EARN_EVERY_DAYS = 7;

/** ...but never bank more than this many. */
export const MAX_STREAK_FREEZES = 2;

/** Bonus XP granted when the streak reaches these lengths. */
export const STREAK_MILESTONES: Record<number, number> = {
  7:   100,
  30:  500,
  100: 2000,
};

/** Returns true iff a miss right now would zero the streak. */
export function shouldLoseStreakOnMiss(state: StreakState): boolean {
  if ((state.streak_freezes ?? 0) > 0) return false;     // a freeze absorbs it
  if (state.second_chance_active) return true;           // already burned it
  return state.day_streak < SECOND_CHANCE_MIN_STREAK;    // never qualified
}

/** State after a perfectly completed day (all tasks done, no bad habits). */
export function applyDayComplete(state: StreakState): StreakState {
  const newStreak = state.day_streak + 1;
  const highest = Math.max(state.highest_streak, newStreak);
  // Every 7th consecutive clean day banks a freeze (capped).
  const freezes =
    newStreak % FREEZE_EARN_EVERY_DAYS === 0
      ? Math.min(MAX_STREAK_FREEZES, (state.streak_freezes ?? 0) + 1)
      : (state.streak_freezes ?? 0);

  if (!state.second_chance_active) {
    return {
      ...state,
      day_streak:                    newStreak,
      highest_streak:                highest,
      streak_freezes:                freezes,
    };
  }

  // Inside a redemption window: count this day down toward replenishment.
  const remaining = state.second_chance_days_remaining - 1;
  if (remaining <= 0) {
    return {
      day_streak:                    newStreak,
      highest_streak:                highest,
      second_chance_active:          false,
      second_chance_days_remaining:  0,
      streak_freezes:                freezes,
    };
  }
  return {
    day_streak:                    newStreak,
    highest_streak:                highest,
    second_chance_active:          true,
    second_chance_days_remaining:  remaining,
    streak_freezes:                freezes,
  };
}

/** State after a missed day (incomplete tasks or a bad habit was done). */
export function applyDayMiss(state: StreakState): StreakState {
  // Layer 1: a banked freeze absorbs the miss entirely.
  if ((state.streak_freezes ?? 0) > 0) {
    return {
      ...state,
      streak_freezes: (state.streak_freezes ?? 0) - 1,
    };
  }

  // Layer 2a: already burning a second chance? Failure zeroes everything.
  if (state.second_chance_active) {
    return {
      day_streak:                    0,
      highest_streak:                state.highest_streak,
      second_chance_active:          false,
      second_chance_days_remaining:  0,
      streak_freezes:                state.streak_freezes ?? 0,
    };
  }

  // Layer 2b: qualified for a second chance? Activate the redemption
  // window; the streak number itself is preserved.
  if (state.day_streak >= SECOND_CHANCE_MIN_STREAK) {
    return {
      ...state,
      second_chance_active:          true,
      second_chance_days_remaining:  SECOND_CHANCE_WINDOW_DAYS,
    };
  }

  // No protection — reset.
  return resetStreak(state);
}

/** Force-zero the streak (used by Start Over and by failures w/o second chance). */
export function resetStreak(state: StreakState): StreakState {
  return {
    day_streak:                    0,
    highest_streak:                state.highest_streak,
    second_chance_active:          false,
    second_chance_days_remaining:  0,
    streak_freezes:                state.streak_freezes ?? 0,
  };
}
