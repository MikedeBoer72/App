import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, defaultState } from './types';

const KEY = 'questfit:state:v1';

export async function loadState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return { ...defaultState, ...parsed, goals: { ...defaultState.goals, ...(parsed.goals ?? {}) } };
  } catch {
    return defaultState;
  }
}

export async function saveState(state: AppState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore persistence failures
  }
}

export async function clearState(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
