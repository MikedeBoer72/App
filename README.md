# QuestFit

RPG-style fitness tracker built with Expo + React Native. Phase 1 MVP: sleep, nutrition, workouts, hydration, daily quests, streaks, XP/leveling, achievements. Data persists locally via AsyncStorage.

## Run

```bash
npm install
npm start          # opens Expo dev tools; scan QR with Expo Go (iOS/Android)
npm run ios        # iOS simulator (macOS only)
npm run android    # Android emulator
npm run web        # browser preview
```

## Stack

- Expo SDK 51 (React Native 0.74) — iOS, Android, web from one codebase
- TypeScript (strict)
- `@react-navigation/bottom-tabs` for navigation
- `@react-native-async-storage/async-storage` for local persistence
- Zero chart deps — bars are plain `View`s

## XP curve

Total XP needed to reach level `n` is `100 * n * (n+1) / 2` (triangular). So:

| Level | Total XP |
|-------|----------|
| 1     | 100      |
| 5     | 1,500    |
| 10    | 5,500    |
| 25    | 32,500   |

Activities award XP via the rules in `src/gamification.ts` (`XP_REWARDS`).

## Layout

```
App.tsx                  # tab navigator + providers
src/
  theme.ts               # colors, spacing, radii
  types.ts               # AppState + entry shapes
  dates.ts               # ISO date helpers
  gamification.ts        # XP curve, streaks, quests, achievements
  storage.ts             # AsyncStorage load/save
  store.tsx              # Context + reducer
  components/            # Card, Button, XPBar, StatTile, BarChart, ...
  screens/               # Dashboard, Sleep, Nutrition, Workout, Water, Profile
```

## Not in this phase

Social / clans, wearable integrations, third-party food DB, notifications, mood + measurements, and the rest of the spec. Hooks for adding them: extend `AppState` in `src/types.ts`, add a reducer case in `src/store.tsx`, add a screen + tab in `App.tsx`.
