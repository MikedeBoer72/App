// Home-screen widget bridge.
//
// Writes the level/streak/XP snapshot into the App Group's shared
// UserDefaults, where the WidgetKit extension (targets/widget/
// index.swift) reads it, then asks iOS to re-render the widget.
//
// @bacons/apple-targets' native module only exists in real builds —
// in Expo Go the require fails and everything no-ops.

import { Platform } from 'react-native';

import type { Theme } from '@/constants/themes';
import type { Profile } from '@/lib/types';

export const WIDGET_APP_GROUP = 'group.com.yourlevel.app';

let ExtensionStorageCtor: any = null;
let storage: any = null;
if (Platform.OS === 'ios') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ExtensionStorageCtor = require('@bacons/apple-targets').ExtensionStorage;
    storage = new ExtensionStorageCtor(WIDGET_APP_GROUP);
  } catch {
    ExtensionStorageCtor = null;
    storage = null;
  }
}

export function syncWidget(profile: Profile, theme: Theme, xpToNextLevel: number): void {
  if (!storage) return;
  try {
    storage.set('yl_level', profile.level);
    storage.set('yl_streak', profile.day_streak);
    storage.set('yl_current_xp', profile.current_xp);
    storage.set('yl_xp_to_next', Math.max(1, xpToNextLevel));
    storage.set('yl_accent', theme.colors.accent);
    storage.set('yl_bg', theme.colors.background);
    storage.set('yl_fg', theme.colors.primary);
    ExtensionStorageCtor.reloadWidget();
  } catch (err) {
    console.warn('[widget] sync failed', err);
  }
}
