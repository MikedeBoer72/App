-- Bad habit penalty reduced from 200 to 150 XP.
--
-- The app stamps xp_penalty at insert time from BAD_HABIT_PENALTY, so
-- this default only matters for rows created outside the app. Existing
-- rows are wiped daily by the reset, so no data update is needed.

alter table bad_habits alter column xp_penalty set default 150;
