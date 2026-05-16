// Domain types mirroring the Supabase schema in
// supabase/migrations/001_initial.sql. Kept in lib/ so xp, streak,
// daily-reset, the store, and screen code can all import from one
// place.

import type { ThemeId } from '@/constants/themes';

export interface Profile {
  id:                              string;
  username:                        string | null;
  level:                           number;
  total_xp:                        number;
  current_xp:                      number;
  day_streak:                      number;
  highest_streak:                  number;
  second_chance_active:            boolean;
  second_chance_days_remaining:    number;
  is_subscribed:                   boolean;
  subscription_expires_at:         string | null;
  day_start_time:                  string;          // 'HH:MM:SS'
  day_start_changes_this_month:    number;
  last_day_start_change:           string | null;
  selected_font:                   ThemeId;
  onboarding_completed:            boolean;
  created_at:                      string;
  last_active_date:                string;          // 'YYYY-MM-DD'
}

export interface Task {
  id:            string;
  user_id:       string;
  name:          string;
  is_primary:    boolean;
  is_completed:  boolean;
  xp_value:      number;
  created_at:    string;
  completed_at:  string | null;
  date:          string;
}

export interface BadHabit {
  id:           string;
  user_id:      string;
  name:         string;
  is_done:      boolean;
  xp_penalty:   number;
  created_at:   string;
  done_at:      string | null;
  date:         string;
}

export interface TaskHistoryEntry {
  id:         string;
  user_id:    string;
  name:       string;
  type:       'task' | 'bad_habit';
  use_count:  number;
  last_used:  string;
}

export interface DailyLog {
  id:                  string;
  user_id:             string;
  date:                string;
  xp_earned:           number;
  tasks_completed:     number;
  streak_maintained:   boolean;
  created_at:          string;
}

export interface Referral {
  id:                 string;
  referrer_id:        string;
  referred_id:        string | null;
  referral_code:      string;
  is_converted:       boolean;
  converted_at:       string | null;
  free_month_given:   boolean;
  created_at:         string;
}

// Slice of Profile that the streak rules operate on. Streak code stays
// independent of the wider profile object so it's trivial to unit-test.
export interface StreakState {
  day_streak:                      number;
  highest_streak:                  number;
  second_chance_active:            boolean;
  second_chance_days_remaining:    number;
}
