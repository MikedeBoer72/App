-- MAXING.ai initial schema
-- Run this once in the Supabase SQL editor (or via `supabase db push`).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists profiles (
  id                              uuid primary key references auth.users(id) on delete cascade,
  username                        text,
  level                           integer     not null default 1,
  total_xp                        integer     not null default 0,
  current_xp                      integer     not null default 0,
  day_streak                      integer     not null default 0,
  highest_streak                  integer     not null default 0,
  second_chance_active            boolean     not null default false,
  second_chance_days_remaining    integer     not null default 0,
  is_subscribed                   boolean     not null default false,
  subscription_expires_at         timestamptz,
  day_start_time                  time        not null default '00:00:00',
  day_start_changes_this_month    integer     not null default 0,
  last_day_start_change           timestamptz,
  selected_font                   text        not null default 'default',
  onboarding_completed            boolean     not null default false,
  created_at                      timestamptz not null default now(),
  last_active_date                date        not null default current_date,
  constraint profiles_level_nonneg          check (level >= 1),
  constraint profiles_total_xp_nonneg       check (total_xp >= 0),
  constraint profiles_current_xp_nonneg     check (current_xp >= 0),
  constraint profiles_day_streak_nonneg     check (day_streak >= 0),
  constraint profiles_highest_streak_nonneg check (highest_streak >= 0)
);

create table if not exists tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  name          text not null,
  is_primary    boolean     not null default true,
  is_completed  boolean     not null default false,
  xp_value      integer     not null default 100,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  date          date        not null default current_date
);

create table if not exists bad_habits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  name         text not null,
  is_done      boolean     not null default false,
  xp_penalty   integer     not null default 200,
  created_at   timestamptz not null default now(),
  done_at      timestamptz,
  date         date        not null default current_date
);

create table if not exists task_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  name       text not null,
  type       text not null check (type in ('task', 'bad_habit')),
  use_count  integer     not null default 1,
  last_used  timestamptz not null default now(),
  unique (user_id, type, name)
);

create table if not exists daily_logs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references profiles(id) on delete cascade,
  date               date not null,
  xp_earned          integer     not null default 0,
  tasks_completed    integer     not null default 0,
  streak_maintained  boolean     not null default false,
  created_at         timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists referrals (
  id                 uuid primary key default gen_random_uuid(),
  referrer_id        uuid not null references profiles(id) on delete cascade,
  referred_id        uuid references profiles(id) on delete set null,
  referral_code      text not null unique,
  is_converted       boolean     not null default false,
  converted_at       timestamptz,
  free_month_given   boolean     not null default false,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes (hot paths: "give me today's items for this user")
-- ---------------------------------------------------------------------------

create index if not exists tasks_user_date_idx       on tasks (user_id, date);
create index if not exists bad_habits_user_date_idx  on bad_habits (user_id, date);
create index if not exists task_history_lookup_idx   on task_history (user_id, type, last_used desc);
create index if not exists daily_logs_user_date_idx  on daily_logs (user_id, date desc);
create index if not exists referrals_referrer_idx    on referrals (referrer_id);
create index if not exists referrals_referred_idx    on referrals (referred_id);

-- ---------------------------------------------------------------------------
-- Auto-create a profile row when a new auth user is created.
-- Keeps onboarding code simpler: the client can rely on a row existing
-- the moment the OAuth callback completes.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Users only see / mutate their own rows. WITH CHECK protects inserts and
-- updates from being assigned to another user.
-- ---------------------------------------------------------------------------

alter table profiles      enable row level security;
alter table tasks         enable row level security;
alter table bad_habits    enable row level security;
alter table task_history  enable row level security;
alter table daily_logs    enable row level security;
alter table referrals     enable row level security;

drop policy if exists "profiles_self" on profiles;
create policy "profiles_self" on profiles
  for all
  using      (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "tasks_self" on tasks;
create policy "tasks_self" on tasks
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "bad_habits_self" on bad_habits;
create policy "bad_habits_self" on bad_habits
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "task_history_self" on task_history;
create policy "task_history_self" on task_history
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "daily_logs_self" on daily_logs;
create policy "daily_logs_self" on daily_logs
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "referrals_participants" on referrals;
create policy "referrals_participants" on referrals
  for all
  using      (auth.uid() = referrer_id or auth.uid() = referred_id)
  with check (auth.uid() = referrer_id);
