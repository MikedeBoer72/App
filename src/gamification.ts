import { AppState, Goals } from './types';
import { todayISO, yesterdayISO } from './dates';

export const XP_REWARDS = {
  sleepGoal: 50,
  workoutCompleted: 100,
  nutritionGoal: 75,
  waterGoal: 25,
  streakDay: 25,
  weeklyStreak: 50,
};

export function xpForLevel(level: number): number {
  if (level <= 0) return 0;
  return Math.round(100 * (level * (level + 1)) / 2);
}

export function levelFromXp(totalXp: number): number {
  if (totalXp < 100) return 0;
  const n = Math.floor((-1 + Math.sqrt(1 + (8 * totalXp) / 100)) / 2);
  return Math.max(0, n);
}

export function xpProgress(totalXp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpToNext: number;
  fraction: number;
} {
  const level = levelFromXp(totalXp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const xpIntoLevel = totalXp - currentLevelXp;
  const xpToNext = nextLevelXp - totalXp;
  const span = nextLevelXp - currentLevelXp || 1;
  return {
    level,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel,
    xpToNext,
    fraction: Math.max(0, Math.min(1, xpIntoLevel / span)),
  };
}

export function bumpStreak(
  lastDate: string | null,
  count: number,
  today: string
): { count: number; lastDate: string } {
  if (lastDate === today) return { count, lastDate };
  const yest = yesterdayISO(today);
  if (lastDate === yest) return { count: count + 1, lastDate: today };
  return { count: 1, lastDate: today };
}

export interface Quest {
  id: string;
  title: string;
  xp: number;
  check: (s: AppState) => boolean;
}

function caloriesOn(state: AppState, date: string): number {
  return state.food.filter((f) => f.date === date).reduce((a, b) => a + b.calories, 0);
}
function proteinOn(state: AppState, date: string): number {
  return state.food.filter((f) => f.date === date).reduce((a, b) => a + b.protein, 0);
}
function waterOn(state: AppState, date: string): number {
  return state.water.find((w) => w.date === date)?.glasses ?? 0;
}
function workoutsOn(state: AppState, date: string): number {
  return state.workouts.filter((w) => w.date === date).length;
}
function sleepOn(state: AppState, date: string): number {
  return state.sleep.find((s) => s.date === date)?.hours ?? 0;
}

export function getDailyQuests(state: AppState): Quest[] {
  const today = todayISO();
  const goals: Goals = state.goals;
  return [
    {
      id: 'sleep',
      title: `Sleep ${goals.sleepHours}+ hours`,
      xp: XP_REWARDS.sleepGoal,
      check: (s) => sleepOn(s, today) >= goals.sleepHours,
    },
    {
      id: 'workout',
      title: 'Log a workout',
      xp: XP_REWARDS.workoutCompleted,
      check: (s) => workoutsOn(s, today) >= 1,
    },
    {
      id: 'protein',
      title: `Hit ${goals.protein}g protein`,
      xp: XP_REWARDS.nutritionGoal,
      check: (s) => proteinOn(s, today) >= goals.protein,
    },
    {
      id: 'water',
      title: `Drink ${goals.waterGlasses} glasses of water`,
      xp: XP_REWARDS.waterGoal,
      check: (s) => waterOn(s, today) >= goals.waterGlasses,
    },
    {
      id: 'calories',
      title: `Stay within ${goals.calories} calories`,
      xp: XP_REWARDS.nutritionGoal,
      check: (s) => {
        const c = caloriesOn(s, today);
        return c > 0 && c <= goals.calories;
      },
    },
  ];
}

export const ACHIEVEMENTS: { id: string; title: string; desc: string; check: (s: AppState) => boolean }[] = [
  {
    id: 'first-step',
    title: 'First Step',
    desc: 'Log your first activity',
    check: (s) => s.sleep.length + s.food.length + s.workouts.length + s.water.length > 0,
  },
  {
    id: 'level-5',
    title: 'Apprentice',
    desc: 'Reach level 5',
    check: (s) => levelFromXp(s.totalXp) >= 5,
  },
  {
    id: 'level-10',
    title: 'Adept',
    desc: 'Reach level 10',
    check: (s) => levelFromXp(s.totalXp) >= 10,
  },
  {
    id: 'level-25',
    title: 'Veteran',
    desc: 'Reach level 25',
    check: (s) => levelFromXp(s.totalXp) >= 25,
  },
  {
    id: 'streak-7-workout',
    title: 'Iron Will',
    desc: '7-day workout streak',
    check: (s) => s.streaks.workout.count >= 7,
  },
  {
    id: 'streak-7-sleep',
    title: 'Well Rested',
    desc: '7-day sleep streak',
    check: (s) => s.streaks.sleep.count >= 7,
  },
  {
    id: 'streak-30-any',
    title: 'Unshakeable',
    desc: '30-day streak in any category',
    check: (s) =>
      Math.max(
        s.streaks.sleep.count,
        s.streaks.nutrition.count,
        s.streaks.workout.count,
        s.streaks.water.count
      ) >= 30,
  },
  {
    id: 'first-workout',
    title: 'Breaking a Sweat',
    desc: 'Log your first workout',
    check: (s) => s.workouts.length >= 1,
  },
  {
    id: 'workout-10',
    title: 'Gym Rat',
    desc: 'Log 10 workouts',
    check: (s) => s.workouts.length >= 10,
  },
];
