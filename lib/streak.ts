// Streak rules for MAXING.ai. Pure functions returning a new
// StreakState — they never mutate their input, never touch Supabase.
//
// Second Chance rule (from spec):
//   - If streak >= 20 and the user misses a day, the streak is NOT
//     reset. Instead a "second chance" flag is set and a 20-day
//     redemption window begins.
//   - Each clean day in the window decrements the counter.
//   - If the counter reaches 0, the second chance is "replenished"
//     (cleared, can be used again on a future miss).
//   - If the user fails during the window, the streak resets to 0
//     and the flag is cleared.

import type { StreakState } from './types';

/** Streak length at which the second chance becomes available. */
export const SECOND_CHANCE_MIN_STREAK = 20;

/** Number of clean days required to replenish a used second chance. */
export const SECOND_CHANCE_WINDOW_DAYS = 20;

/** Returns true iff a miss right now would zero the streak. */
export function shouldLoseStreakOnMiss(state: StreakState): boolean {
  if (state.second_chance_active) return true;          // already burned it
  return state.day_streak < SECOND_CHANCE_MIN_STREAK;   // never qualified
}

/** State after a perfectly completed day (all tasks done, no bad habits). */
export function applyDayComplete(state: StreakState): StreakState {
  const newStreak = state.day_streak + 1;
  const highest = Math.max(state.highest_streak, newStreak);

  if (!state.second_chance_active) {
    return {
      ...state,
      day_streak:                    newStreak,
      highest_streak:                highest,
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
    };
  }
  return {
    day_streak:                    newStreak,
    highest_streak:                highest,
    second_chance_active:          true,
    second_chance_days_remaining:  remaining,
  };
}

/** State after a missed day (incomplete tasks or a bad habit was done). */
export function applyDayMiss(state: StreakState): StreakState {
  // Already burning a second chance? Failure zeroes everything.
  if (state.second_chance_active) {
    return {
      day_streak:                    0,
      highest_streak:                state.highest_streak,
      second_chance_active:          false,
      second_chance_days_remaining:  0,
    };
  }

  // Qualified for a second chance? Activate the redemption window;
  // the streak number itself is preserved.
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
  };
}
