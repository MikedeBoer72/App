-- Streak Freeze + streak milestone celebrations.
--
-- streak_freezes: banked freezes (earn 1 per 7 consecutive clean days,
-- capped at 2). A missed day consumes one instead of touching the
-- streak — checked BEFORE the 20-day Second Chance rule.
--
-- pending_streak_milestone: set by the daily reset when the streak
-- crosses 7 / 30 / 100 (bonus XP is granted at the same moment). The
-- dashboard shows the celebration on next open, then clears it.

alter table profiles
  add column if not exists streak_freezes integer not null default 0,
  add column if not exists pending_streak_milestone integer;
