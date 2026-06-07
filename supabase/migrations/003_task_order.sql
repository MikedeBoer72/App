-- Manual ordering for tasks and bad habits.
--
-- Without an explicit order column the dashboard always renders by
-- created_at. Adding order_index lets the user drag rows to a custom
-- order; ties broken by created_at so newly-added rows fall to the
-- bottom of the existing list.

alter table tasks       add column if not exists order_index integer not null default 0;
alter table bad_habits  add column if not exists order_index integer not null default 0;

create index if not exists tasks_order_idx       on tasks      (user_id, date, order_index, created_at);
create index if not exists bad_habits_order_idx  on bad_habits (user_id, date, order_index, created_at);
