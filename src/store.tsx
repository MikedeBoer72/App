import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { AppState, defaultState, FoodEntry, Goals, SleepEntry, WaterEntry, WorkoutEntry } from './types';
import { loadState, saveState, clearState } from './storage';
import { ACHIEVEMENTS, XP_REWARDS, bumpStreak, getDailyQuests, levelFromXp } from './gamification';
import { todayISO } from './dates';

type Action =
  | { type: 'HYDRATE'; state: AppState }
  | { type: 'ADD_SLEEP'; entry: SleepEntry }
  | { type: 'ADD_FOOD'; entry: FoodEntry }
  | { type: 'DELETE_FOOD'; id: string }
  | { type: 'ADD_WORKOUT'; entry: WorkoutEntry }
  | { type: 'DELETE_WORKOUT'; id: string }
  | { type: 'SET_WATER'; date: string; glasses: number }
  | { type: 'UPDATE_GOALS'; goals: Partial<Goals> }
  | { type: 'SET_NAME'; name: string }
  | { type: 'AWARD_XP'; xp: number }
  | { type: 'CLAIM_QUEST'; id: string }
  | { type: 'CHECK_ACHIEVEMENTS' }
  | { type: 'RESET' };

function upsertWater(list: WaterEntry[], date: string, glasses: number): WaterEntry[] {
  const idx = list.findIndex((w) => w.date === date);
  if (idx === -1) return [...list, { date, glasses }];
  const next = list.slice();
  next[idx] = { date, glasses };
  return next;
}

function upsertSleep(list: SleepEntry[], entry: SleepEntry): SleepEntry[] {
  const idx = list.findIndex((s) => s.date === entry.date);
  if (idx === -1) return [...list, entry];
  const next = list.slice();
  next[idx] = entry;
  return next;
}

function ensureTodaysQuests(state: AppState): AppState {
  const t = todayISO();
  if (state.quests.date === t) return state;
  return { ...state, quests: { date: t, completedIds: [] } };
}

function applyAchievements(state: AppState): AppState {
  const earned = new Set(state.achievements);
  let xpBonus = 0;
  for (const a of ACHIEVEMENTS) {
    if (!earned.has(a.id) && a.check(state)) {
      earned.add(a.id);
      xpBonus += 50;
    }
  }
  if (xpBonus === 0 && earned.size === state.achievements.length) return state;
  return { ...state, achievements: Array.from(earned), totalXp: state.totalXp + xpBonus };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'HYDRATE':
      return ensureTodaysQuests(action.state);
    case 'ADD_SLEEP': {
      const today = todayISO();
      const goalMet = action.entry.hours >= state.goals.sleepHours;
      const streaks = goalMet
        ? { ...state.streaks, sleep: bumpStreak(state.streaks.sleep.lastDate, state.streaks.sleep.count, today) }
        : state.streaks;
      return applyAchievements({
        ...state,
        sleep: upsertSleep(state.sleep, action.entry),
        streaks,
      });
    }
    case 'ADD_FOOD':
      return applyAchievements({ ...state, food: [...state.food, action.entry] });
    case 'DELETE_FOOD':
      return { ...state, food: state.food.filter((f) => f.id !== action.id) };
    case 'ADD_WORKOUT': {
      const today = todayISO();
      const streaks = {
        ...state.streaks,
        workout: bumpStreak(state.streaks.workout.lastDate, state.streaks.workout.count, today),
      };
      return applyAchievements({
        ...state,
        workouts: [...state.workouts, action.entry],
        streaks,
        totalXp: state.totalXp + XP_REWARDS.workoutCompleted,
      });
    }
    case 'DELETE_WORKOUT':
      return { ...state, workouts: state.workouts.filter((w) => w.id !== action.id) };
    case 'SET_WATER': {
      const today = todayISO();
      const wasMet = (state.water.find((w) => w.date === action.date)?.glasses ?? 0) >= state.goals.waterGlasses;
      const nowMet = action.glasses >= state.goals.waterGlasses;
      const water = upsertWater(state.water, action.date, action.glasses);
      let streaks = state.streaks;
      let totalXp = state.totalXp;
      if (!wasMet && nowMet && action.date === today) {
        streaks = {
          ...state.streaks,
          water: bumpStreak(state.streaks.water.lastDate, state.streaks.water.count, today),
        };
        totalXp += XP_REWARDS.waterGoal;
      }
      return applyAchievements({ ...state, water, streaks, totalXp });
    }
    case 'UPDATE_GOALS':
      return { ...state, goals: { ...state.goals, ...action.goals } };
    case 'SET_NAME':
      return { ...state, profile: { ...state.profile, name: action.name } };
    case 'AWARD_XP':
      return { ...state, totalXp: state.totalXp + action.xp };
    case 'CLAIM_QUEST': {
      if (state.quests.completedIds.includes(action.id)) return state;
      const quest = getDailyQuests(state).find((q) => q.id === action.id);
      if (!quest || !quest.check(state)) return state;
      return applyAchievements({
        ...state,
        quests: { ...state.quests, completedIds: [...state.quests.completedIds, action.id] },
        totalXp: state.totalXp + quest.xp,
      });
    }
    case 'CHECK_ACHIEVEMENTS':
      return applyAchievements(state);
    case 'RESET':
      return defaultState;
    default:
      return state;
  }
}

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  hydrated: boolean;
  reset: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultState);
  const hydratedRef = useRef(false);
  const [hydrated, setHydrated] = React.useState(false);

  useEffect(() => {
    let active = true;
    loadState().then((s) => {
      if (!active) return;
      dispatch({ type: 'HYDRATE', state: s });
      hydratedRef.current = true;
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    saveState(state);
  }, [state]);

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      dispatch,
      hydrated,
      reset: async () => {
        await clearState();
        dispatch({ type: 'RESET' });
      },
    }),
    [state, hydrated]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

export function useLevel() {
  const { state } = useStore();
  return useMemo(() => ({ level: levelFromXp(state.totalXp), totalXp: state.totalXp }), [state.totalXp]);
}
