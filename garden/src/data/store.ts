// App state, persistence, and everything derived from it (wins, streaks, inventory).

import {
  ALL_EXERCISES,
  ItemKind,
  LandmarkKind,
  Split,
  TASKS,
  TaskId,
  FlowerSpecies,
  landmarkForWin,
  tasksFor,
} from './config';
import { addDays, todayKey } from './dates';

export interface SetEntry {
  reps: number | null;
  weight: number | null;
}

export interface Session {
  split: Split;
  /** exerciseId -> sets */
  sets: Record<string, SetEntry[]>;
  finished: boolean;
}

export interface DayEntry {
  done: Partial<Record<TaskId, boolean>>;
  reflection?: string;
}

export interface Placed {
  token: string;
  kind: ItemKind;
  species?: FlowerSpecies;
  x: number;
  z: number;
  rot: number;
  seed: number;
  at: number; // timestamp placed
}

export type TimeOfDay = 'live' | 'morning' | 'day' | 'evening' | 'night';

export interface State {
  version: 1;
  startDate: string;
  days: Record<string, DayEntry>;
  sessions: Record<string, Session>;
  placed: Placed[];
  settings: { timeOfDay: TimeOfDay; quality: 'high' | 'battery' };
}

const KEY = 'bloom-garden/v1';

function fresh(): State {
  return {
    version: 1,
    startDate: todayKey(),
    days: {},
    sessions: {},
    placed: [],
    settings: { timeOfDay: 'live', quality: 'high' },
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as State;
      const f = fresh();
      return { ...f, ...s, settings: { ...f.settings, ...s.settings } };
    }
  } catch {
    /* storage blocked or corrupt: start fresh */
  }
  return fresh();
}

type Listener = (s: State) => void;

class Store {
  state: State = load();
  private listeners = new Set<Listener>();
  private saveTimer = 0;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  update(mut: (s: State) => void) {
    mut(this.state);
    this.persist();
    this.listeners.forEach((l) => l(this.state));
  }

  private persist() {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.saveNow(), 150);
  }

  saveNow() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
    } catch {
      /* ignore */
    }
  }

  replace(s: State) {
    this.state = s;
    this.saveNow();
    this.listeners.forEach((l) => l(this.state));
  }

  // ----- Tasks -----

  day(key: string): DayEntry {
    return this.state.days[key] ?? { done: {} };
  }

  setTask(key: string, id: TaskId, value: boolean) {
    this.update((s) => {
      const d = (s.days[key] ??= { done: {} });
      d.done[id] = value;
    });
  }

  setReflection(key: string, text: string) {
    this.update((s) => {
      const d = (s.days[key] ??= { done: {} });
      d.reflection = text;
    });
  }

  // ----- Workouts -----

  session(key: string): Session | undefined {
    return this.state.sessions[key];
  }

  ensureSession(key: string, split: Split): Session {
    const existing = this.state.sessions[key];
    if (existing && existing.split === split) return existing;
    const s: Session = { split, sets: {}, finished: false };
    this.update((st) => {
      st.sessions[key] = s;
    });
    return s;
  }

  setSet(key: string, exId: string, idx: number, field: keyof SetEntry, value: number | null) {
    this.update((s) => {
      const sess = s.sessions[key];
      if (!sess) return;
      const arr = (sess.sets[exId] ??= []);
      while (arr.length <= idx) arr.push({ reps: null, weight: null });
      arr[idx][field] = value;
    });
  }

  /** Most recent session before `key` that contains data for an exercise. */
  lastFor(exId: string, beforeKey: string): { date: string; sets: SetEntry[] } | null {
    const keys = Object.keys(this.state.sessions)
      .filter((k) => k < beforeKey)
      .sort()
      .reverse();
    for (const k of keys) {
      const sets = this.state.sessions[k].sets[exId];
      if (sets && sets.some((x) => x.reps != null)) return { date: k, sets };
    }
    return null;
  }

  /** All sessions that logged this exercise, oldest first. */
  historyFor(exId: string): { date: string; sets: SetEntry[] }[] {
    return Object.keys(this.state.sessions)
      .sort()
      .map((k) => ({ date: k, sets: (this.state.sessions[k].sets[exId] ?? []).filter((x) => x.reps != null) }))
      .filter((h) => h.sets.length > 0);
  }

  // ----- Garden -----

  place(p: Omit<Placed, 'at'>) {
    this.update((s) => {
      s.placed.push({ ...p, at: Date.now() });
    });
  }

  undoLastPlace(): Placed | undefined {
    let removed: Placed | undefined;
    this.update((s) => {
      removed = s.placed.pop();
    });
    return removed;
  }
}

export const store = new Store();

// ---------- Derived values ----------

export function isWon(s: State, key: string): boolean {
  const d = s.days[key];
  if (!d) return false;
  return tasksFor(key).every((t) => d.done[t]);
}

export function wonDays(s: State): string[] {
  return Object.keys(s.days)
    .filter((k) => isWon(s, k))
    .sort();
}

export function currentStreak(s: State): number {
  let k = todayKey();
  if (!isWon(s, k)) k = addDays(k, -1); // today still in progress
  let n = 0;
  while (isWon(s, k)) {
    n++;
    k = addDays(k, -1);
  }
  return n;
}

export function bestStreak(s: State): number {
  const won = wonDays(s);
  let best = 0;
  let run = 0;
  let prev = '';
  for (const k of won) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

export interface Token {
  token: string;
  kind: ItemKind;
  species?: FlowerSpecies;
  date: string;
  reason: string;
}

/** Everything ever earned. Unchecking a task removes its token. */
export function earnedTokens(s: State): Token[] {
  const out: Token[] = [];
  const keys = Object.keys(s.days).sort();
  let winCount = 0;
  for (const k of keys) {
    const d = s.days[k];
    for (const t of tasksFor(k)) {
      if (d.done[t]) {
        out.push({ token: `f:${k}:${t}`, kind: 'flower', species: TASKS[t].flower, date: k, reason: TASKS[t].title });
      }
    }
    if (isWon(s, k)) {
      winCount++;
      const kind: LandmarkKind = landmarkForWin(winCount);
      out.push({ token: `w:${winCount}`, kind, date: k, reason: `Won day #${winCount}` });
    }
  }
  return out;
}

export function inventory(s: State): Token[] {
  const used = new Set(s.placed.map((p) => p.token));
  return earnedTokens(s).filter((t) => !used.has(t.token));
}

// ---------- Workout maths ----------

/** Epley estimated one-rep max. */
export function e1rm(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

export interface SessionSummary {
  date: string;
  topWeight: number;
  topReps: number; // reps at top weight
  bestE1rm: number;
  totalReps: number;
  volume: number;
}

export function summarize(h: { date: string; sets: SetEntry[] }): SessionSummary {
  let topWeight = 0;
  let topReps = 0;
  let bestE1rm = 0;
  let totalReps = 0;
  let volume = 0;
  for (const st of h.sets) {
    const r = st.reps ?? 0;
    const w = st.weight ?? 0;
    totalReps += r;
    volume += r * w;
    if (w > topWeight || (w === topWeight && r > topReps)) {
      topWeight = w;
      topReps = r;
    }
    bestE1rm = Math.max(bestE1rm, e1rm(w, r));
  }
  return { date: h.date, topWeight, topReps, bestE1rm, totalReps, volume };
}

export function exerciseById(id: string) {
  return ALL_EXERCISES.find((e) => e.id === id);
}
