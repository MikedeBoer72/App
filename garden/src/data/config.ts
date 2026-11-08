// Everything about "the plan" lives here: daily tasks, the training split,
// which flower each task grows, and what winning days unlock.
// Change an exercise or a task here and the whole app follows.

import { weekday } from './dates';

export type TaskId = 'workout' | 'clean' | 'coffee' | 'kzbb' | 'jumbo' | 'reflect' | 'walk';

export interface TaskDef {
  id: TaskId;
  title: string;
  hint: string;
  flower: FlowerSpecies;
}

export type FlowerSpecies =
  | 'poppy'
  | 'daisy'
  | 'lavender'
  | 'sunflower'
  | 'cornflower'
  | 'foxglove'
  | 'tulip';

export const FLOWER_NAMES: Record<FlowerSpecies, string> = {
  poppy: 'Red poppy',
  daisy: 'Daisy',
  lavender: 'Lavender',
  sunflower: 'Sunflower',
  cornflower: 'Cornflower',
  foxglove: 'Foxglove',
  tulip: 'Wild tulip',
};

/** Swatch colour for UI chips. */
export const FLOWER_COLORS: Record<FlowerSpecies, string> = {
  poppy: '#c8382c',
  daisy: '#f4f1e8',
  lavender: '#8f7cc8',
  sunflower: '#e8b62c',
  cornflower: '#4d73c9',
  foxglove: '#d585b4',
  tulip: '#ec9a72',
};

export const TASKS: Record<TaskId, TaskDef> = {
  workout: { id: 'workout', title: 'Morning workout', hint: 'Before work. Log it in the Workout tab.', flower: 'poppy' },
  clean: { id: 'clean', title: 'Ate clean', hint: 'Nothing bad. Cooked my own food, no Jumbo ready-meals.', flower: 'daisy' },
  coffee: { id: 'coffee', title: 'Coffee only', hint: 'No Monster, no energy drinks.', flower: 'lavender' },
  kzbb: { id: 'kzbb', title: '2+ KZBB sales', hint: 'Two is the floor. Top seller.', flower: 'sunflower' },
  jumbo: { id: 'jumbo', title: 'Groceries at Jumbo', hint: 'Shop for the week. Ingredients, not snacks.', flower: 'cornflower' },
  reflect: { id: 'reflect', title: 'Reflect on the week', hint: 'Write down what went well and what is next.', flower: 'foxglove' },
  walk: { id: 'walk', title: 'Take a walk', hint: 'Slow down. Get outside.', flower: 'tulip' },
};

export const WEEKDAY_TASKS: TaskId[] = ['workout', 'clean', 'coffee', 'kzbb'];
export const SUNDAY_TASKS: TaskId[] = ['jumbo', 'reflect', 'walk'];

export function tasksFor(dateKey: string): TaskId[] {
  return weekday(dateKey) === 0 ? SUNDAY_TASKS : WEEKDAY_TASKS;
}

// ---------- Training ----------

export type Split = 'legs' | 'push' | 'pull';

/** weight = kg + reps, reps = reps only, bodyweight = reps + optional added kg */
export type ExerciseMode = 'weight' | 'reps' | 'bodyweight';

export interface ExerciseDef {
  id: string;
  name: string;
  mode: ExerciseMode;
}

export const SETS_PER_EXERCISE = 3;

export const WORKOUTS: Record<Split, { title: string; exercises: ExerciseDef[] }> = {
  legs: {
    title: 'Legs',
    exercises: [
      { id: 'leg-press', name: 'Leg press', mode: 'weight' },
      { id: 'leg-extension', name: 'Leg extensions', mode: 'weight' },
      { id: 'leg-curl', name: 'Leg curls', mode: 'weight' },
      { id: 'calf-raise', name: 'Calf raises', mode: 'weight' },
    ],
  },
  push: {
    title: 'Push',
    exercises: [
      { id: 'incline-db-press', name: 'Incline dumbbell press', mode: 'weight' },
      { id: 'chest-press', name: 'Chest press', mode: 'weight' },
      { id: 'chest-fly', name: 'Chest flies', mode: 'weight' },
      { id: 'tricep-extension', name: 'Tricep extensions', mode: 'weight' },
      { id: 'side-raise', name: 'Side raises', mode: 'weight' },
      { id: 'leg-raise', name: 'Leg raises', mode: 'reps' },
    ],
  },
  pull: {
    title: 'Pull',
    exercises: [
      { id: 'pull-up', name: 'Pull-ups', mode: 'bodyweight' },
      { id: 'seated-row', name: 'Seated 1-arm rows', mode: 'weight' },
      { id: 'preacher-curl', name: 'Preacher curls', mode: 'weight' },
      { id: 'db-shrug', name: 'Dumbbell shrugs', mode: 'weight' },
    ],
  },
};

export const ALL_EXERCISES: (ExerciseDef & { split: Split })[] = (Object.keys(WORKOUTS) as Split[]).flatMap((s) =>
  WORKOUTS[s].exercises.map((e) => ({ ...e, split: s })),
);

/** Mon legs, Tue push, Wed pull, Thu legs, Fri push, Sat pull, Sun rest. */
export function splitFor(dateKey: string): Split | null {
  const wd = weekday(dateKey);
  if (wd === 0) return null;
  return (['legs', 'push', 'pull'] as Split[])[(wd - 1) % 3];
}

// ---------- Garden rewards ----------

export type LandmarkKind =
  | 'birch'
  | 'boulder'
  | 'bush'
  | 'oak'
  | 'lantern'
  | 'pine'
  | 'bench'
  | 'cherry'
  | 'pond'
  | 'waterfall';

export type ItemKind = 'flower' | LandmarkKind;

export const LANDMARK_NAMES: Record<LandmarkKind, string> = {
  birch: 'Silver birch',
  boulder: 'Mossy boulders',
  bush: 'Elderflower bush',
  oak: 'Oak tree',
  lantern: 'Stone lantern',
  pine: 'Scots pine',
  bench: 'Garden bench',
  cherry: 'Cherry blossom',
  pond: 'Lily pond',
  waterfall: 'Waterfall',
};

const LANDMARK_CYCLE: LandmarkKind[] = ['birch', 'boulder', 'bush', 'oak', 'lantern', 'pine', 'bench', 'cherry'];

/** What the n-th won day (1-based) unlocks. Every 5th is a pond, every 10th a waterfall. */
export function landmarkForWin(n: number): LandmarkKind {
  if (n % 10 === 0) return 'waterfall';
  if (n % 5 === 0) return 'pond';
  const nonSpecial = n - Math.floor(n / 5); // count of regular wins so far
  return LANDMARK_CYCLE[(nonSpecial - 1) % LANDMARK_CYCLE.length];
}

export interface HouseLevel {
  wins: number;
  name: string;
}

/** House grows with total won days, so it never goes backwards. */
export const HOUSE_LEVELS: HouseLevel[] = [
  { wins: 0, name: 'An empty plot, marked for your home' },
  { wins: 3, name: 'A small stone cottage' },
  { wins: 7, name: 'A covered porch with flower boxes' },
  { wins: 14, name: 'A chimney and a garden fence' },
  { wins: 30, name: 'A second wing' },
  { wins: 60, name: 'A glass greenhouse' },
  { wins: 100, name: 'A stone tower' },
];

export function houseLevelFor(wins: number): number {
  let lvl = 0;
  HOUSE_LEVELS.forEach((h, i) => {
    if (wins >= h.wins) lvl = i;
  });
  return lvl;
}
