-- Daily XP cap tracking that survives task/bad-habit deletion.
--
-- Previously the 300 XP/day cap was computed from the current
-- tasks array, so deleting completed tasks reset the cap (a way
-- to grind unlimited XP). Now we track cumulative awarded XP as a
-- counter on the profile, reset only by the daily reset. Same for
-- bad-habit penalties, plus a name array that dedupes so deleting
-- and re-adding the same bad habit doesn't re-penalize.

alter table profiles
  add column if not exists daily_task_xp_earned       integer not null default 0,
  add column if not exists daily_bad_habit_xp_lost    integer not null default 0,
  add column if not exists bad_habits_penalized_today text[]  not null default '{}';
