-- Demo / screenshot account dress-up.
--
-- Run in the Supabase SQL editor AFTER the demo account has signed in
-- once and finished onboarding (so its profile row exists).
--
-- 1) Replace DEMO_EMAIL_HERE below (keep the quotes) with the demo
--    account's email, e.g. 'yourlevel.demo@gmail.com'
-- 2) Run. Safe to re-run any time (it just re-applies the state).
--
-- What it does:
--   * Level 52 (unlocks Default→Vampire: 8 themes owned)
--   * Pro subscribed (no paywall for the App Review reviewer)
--   * 23-day streak + 1 streak freeze banked
--   * created_at = now  -> the 24h FONT TEST DRIVE is active, so ALL
--     fonts (Cyberpunk, Galaxy...) are selectable for screenshots
--   * 6 weeks of mostly-green daily_logs so the stats heatmap glows

with demo as (
  select id from auth.users where email ilike 'DEMO_EMAIL_HERE'
)
update profiles p set
  level                         = 52,
  total_xp                      = 33130,   -- level 52 + 430 into the ring
  current_xp                    = 430,
  day_streak                    = 23,
  highest_streak                = 23,
  streak_freezes                = 1,
  second_chance_active          = false,
  second_chance_days_remaining  = 0,
  is_subscribed                 = true,
  subscription_expires_at       = (now() + interval '30 days'),
  pending_streak_milestone      = null,
  created_at                    = now()    -- font test drive ON for 24h
from demo
where p.id = demo.id;

-- Six weeks of history: ~90% successful days, solid XP -> green heatmap.
insert into daily_logs (user_id, date, xp_earned, tasks_completed, streak_maintained)
select demo.id,
       d::date,
       260 + (random() * 150)::int,
       3 + (random() * 3)::int,
       random() < 0.9
from generate_series(current_date - 42, current_date - 1, interval '1 day') d
cross join (select id from auth.users where email ilike 'DEMO_EMAIL_HERE') demo
on conflict (user_id, date) do update
  set xp_earned         = excluded.xp_earned,
      tasks_completed   = excluded.tasks_completed,
      streak_maintained = excluded.streak_maintained;
