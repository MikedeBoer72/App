-- First-week quest ladder: ids of claimed quests. The quest list and
-- completion checks live in the app (constants/quests.ts); the server
-- only remembers what has been claimed so rewards can't repeat.

alter table profiles
  add column if not exists quests_claimed text[] not null default '{}';
