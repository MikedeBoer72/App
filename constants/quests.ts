// First-week quest ladder. Bridges the "empty early game" between
// download and the streak becoming the habit hook.
//
// Every quest is checkable from state the dashboard already holds —
// no extra queries. Claimed ids persist in profiles.quests_claimed;
// once everything is claimed the quest card disappears forever.
// Reward XP intentionally BYPASSES the 300/day task cap (it's a
// bonus, not task income).

import type { BadHabit, Profile, Task } from '@/lib/types';

export interface QuestCheckState {
  profile:   Profile;
  tasks:     Task[];
  badHabits: BadHabit[];
}

export interface Quest {
  id:        string;
  title:     string;
  /** Shown while the quest isn't met yet. */
  hint:      string;
  rewardXp:  number;
  isMet:     (s: QuestCheckState) => boolean;
}

export const QUESTS: readonly Quest[] = [
  {
    id:       'first-task',
    title:    'Complete your first task',
    hint:     'Tap the checkbox on any task.',
    rewardXp: 50,
    isMet:    (s) => s.tasks.some((t) => t.is_completed) || s.profile.total_xp > 0,
  },
  {
    id:       'track-habit',
    title:    'Track a bad habit',
    hint:     'Add one thing you want to quit.',
    rewardXp: 50,
    isMet:    (s) => s.badHabits.length > 0,
  },
  {
    id:       'three-in-a-day',
    title:    'Complete 3 tasks in one day',
    hint:     'Knock out three today.',
    rewardXp: 75,
    isMet:    (s) => s.tasks.filter((t) => t.is_completed).length >= 3,
  },
  {
    id:       'clean-day',
    title:    'Finish a clean day',
    hint:     'All tasks done, zero bad habits.',
    rewardXp: 75,
    isMet:    (s) => s.profile.day_streak >= 1,
  },
  {
    id:       'reach-level-2',
    title:    'Reach Level 2',
    hint:     'Earn 500 XP total.',
    rewardXp: 50,
    isMet:    (s) => s.profile.level >= 2,
  },
  {
    id:       'try-theme',
    title:    'Try a different look',
    hint:     'Settings → Fonts. Paper unlocks at Level 2.',
    rewardXp: 50,
    isMet:    (s) => s.profile.selected_font !== 'default',
  },
  {
    id:       'two-day-streak',
    title:    'Hit a 2-day streak',
    hint:     'Two clean days back to back.',
    rewardXp: 100,
    isMet:    (s) => s.profile.day_streak >= 2,
  },
] as const;
