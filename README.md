# YourLevel

iOS habit & task tracker with gamification (XP, levels, streaks, bad habits).

## Stack

- Expo SDK 54 (React Native 0.81), iOS only
- Expo Router (file-based)
- Supabase (auth + database)
- RevenueCat (subscriptions)
- Zustand (state)
- TypeScript (strict)

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in Supabase + RevenueCat keys.
3. Apply the Supabase migration from `supabase/migrations/`.
4. `npm run ios` (requires macOS + Xcode) or `npm start` then open in Expo Go on iOS.

## Bundle

- Display name: `YourLevel`
- Bundle id: `com.yourlevel.app`
- Scheme: `yourlevel`

## Folder structure

```
app/                  expo-router routes
  (auth)/login        OAuth (Google + Apple)
  (tabs)/             dashboard
  onboarding/         day-start-time picker on first login
  settings/           all settings sub-screens
  tasks/              add task / add bad habit
components/           shared UI
lib/                  xp, streak, daily-reset, supabase client
store/                zustand store
constants/            level + theme definitions
supabase/migrations/  SQL migrations
```
