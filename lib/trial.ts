// Font TEST DRIVE: for the first 24 hours after account creation,
// EVERY font/theme is unlocked to try. Tasting Cyberpunk or Galaxy on
// day one is the hook that makes the level grind (and Pro) desirable.
//
// No DB migration needed — the window is derived from
// profile.created_at. When it lapses, the store's load guard reverts
// an un-owned selected font to the best theme the player actually
// owns (see useAppStore.loadForUser).

import { DEFAULT_THEME_ID, THEMES, type Theme, type ThemeId } from '@/constants/themes';
import type { Profile } from '@/lib/types';

export const TRIAL_HOURS = 24;

export interface FontTrial {
  active: boolean;
  msLeft: number;
}

export function getFontTrial(profile: Profile | null): FontTrial {
  if (!profile) return { active: false, msLeft: 0 };
  const start = Date.parse(profile.created_at);
  if (Number.isNaN(start)) return { active: false, msLeft: 0 };
  const msLeft = start + TRIAL_HOURS * 3_600_000 - Date.now();
  return { active: msLeft > 0, msLeft };
}

/** "23h 4m" / "45m" for the countdown chips. */
export function formatTrialTimeLeft(msLeft: number): string {
  const totalMins = Math.max(1, Math.ceil(msLeft / 60_000));
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Does the player legitimately own this theme (ignoring the trial)? */
export function ownsTheme(t: Theme, level: number, subscribed: boolean): boolean {
  return t.unlockLevel <= level && (!t.isPaid || subscribed);
}

/** Highest theme the player actually owns — the post-trial fallback. */
export function bestOwnedThemeId(level: number, subscribed: boolean): ThemeId {
  // THEMES is sorted by unlockLevel ascending.
  const owned = THEMES.filter((t) => ownsTheme(t, level, subscribed));
  return owned.length > 0 ? owned[owned.length - 1]!.id : DEFAULT_THEME_ID;
}
