-- Reviewer demo account setup (run AFTER the demo account has signed in once).
--
-- Replaces scripts/demo-account.sql for App Review purposes.
--
-- WHY LEVEL 4 AND NOT SUBSCRIBED:
--   * Level 4 < 5, so the reviewer can explore the entire app freely.
--   * NOT subscribed, so the reviewer can open the subscription screen and
--     see/test the real purchase flow (a subscribed account shows
--     "Subscribed" and the buy button is disabled — Apple would reject
--     again for not being able to review the IAP).
--   * Completing 3 tasks pushes them to Level 5 and demonstrates the
--     paywall gate naturally.
--
-- 1) Replace DEMO_EMAIL_HERE (appears twice) with the demo account email.
-- 2) Run in the Supabase SQL editor. Safe to re-run.

with demo as (
  select id from auth.users where email ilike 'DEMO_EMAIL_HERE'
)
update profiles p set
  level                         = 4,
  total_xp                      = 1050,   -- level 4, 150/300 into the ring
  current_xp                    = 150,
  day_streak                    = 4,
  highest_streak                = 6,
  streak_freezes                = 0,
  second_chance_active          = false,
  second_chance_days_remaining  = 0,
  is_subscribed                 = false,  -- REQUIRED so the IAP is reviewable
  subscription_expires_at       = null,
  pending_streak_milestone      = null,
  created_at                    = now()   -- 24h font test drive active
from demo
where p.id = demo.id;

-- A week of history so the Stats screen isn't empty.
insert into daily_logs (user_id, date, xp_earned, tasks_completed, streak_maintained)
select demo.id,
       d::date,
       200 + (random() * 120)::int,
       3 + (random() * 2)::int,
       random() < 0.85
from generate_series(current_date - 7, current_date - 1, interval '1 day') d
cross join (select id from auth.users where email ilike 'DEMO_EMAIL_HERE') demo
on conflict (user_id, date) do update
  set xp_earned         = excluded.xp_earned,
      tasks_completed   = excluded.tasks_completed,
      streak_maintained = excluded.streak_maintained;
