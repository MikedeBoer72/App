// Background task registration.
//
// `defineTask` MUST run at module load (before any background fire),
// not inside a useEffect, or TaskManager won't find a definition when
// iOS launches the JS context headlessly for the task. Importing
// this file from app/_layout.tsx ensures it runs on every JS boot,
// including headless launches.
//
// The handler is a thin wrapper around runDailyResetIfNeeded that
// reads the current Supabase session - background runs don't have
// access to the Zustand store (the React tree isn't mounted), so
// every dependency is loaded fresh from disk.

import { defineDailyResetBackgroundTask, runDailyResetIfNeeded } from './daily-reset';
import { supabase } from './supabase';

defineDailyResetBackgroundTask(async () => {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) return;
  await runDailyResetIfNeeded({ supabase, userId });
});
