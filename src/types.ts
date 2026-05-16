export type ISODate = string;

export interface SleepEntry {
  date: ISODate;
  hours: number;
  quality: number;
  bedtime?: string;
  wakeTime?: string;
}

export interface FoodEntry {
  id: string;
  date: ISODate;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface WorkoutSet {
  reps: number;
  weight: number;
}

export interface ExerciseEntry {
  name: string;
  sets: WorkoutSet[];
}

export interface WorkoutEntry {
  id: string;
  date: ISODate;
  name: string;
  durationMin: number;
  intensity: 'light' | 'moderate' | 'intense';
  exercises: ExerciseEntry[];
}

export interface WaterEntry {
  date: ISODate;
  glasses: number;
}

export interface Goals {
  sleepHours: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  waterGlasses: number;
  workoutsPerWeek: number;
}

export interface Profile {
  name: string;
  createdAt: ISODate;
}

export interface QuestState {
  date: ISODate;
  completedIds: string[];
}

export interface Streaks {
  sleep: { count: number; lastDate: ISODate | null };
  nutrition: { count: number; lastDate: ISODate | null };
  workout: { count: number; lastDate: ISODate | null };
  water: { count: number; lastDate: ISODate | null };
}

export interface AppState {
  profile: Profile;
  goals: Goals;
  totalXp: number;
  sleep: SleepEntry[];
  food: FoodEntry[];
  workouts: WorkoutEntry[];
  water: WaterEntry[];
  streaks: Streaks;
  quests: QuestState;
  achievements: string[];
}

export const defaultGoals: Goals = {
  sleepHours: 8,
  calories: 2200,
  protein: 140,
  carbs: 250,
  fats: 70,
  waterGlasses: 8,
  workoutsPerWeek: 4,
};

export const defaultState: AppState = {
  profile: { name: 'Champion', createdAt: new Date().toISOString().slice(0, 10) },
  goals: defaultGoals,
  totalXp: 0,
  sleep: [],
  food: [],
  workouts: [],
  water: [],
  streaks: {
    sleep: { count: 0, lastDate: null },
    nutrition: { count: 0, lastDate: null },
    workout: { count: 0, lastDate: null },
    water: { count: 0, lastDate: null },
  },
  quests: { date: '', completedIds: [] },
  achievements: [],
};
