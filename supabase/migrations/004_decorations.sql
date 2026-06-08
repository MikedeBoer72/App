-- Background decorations: a second unlock track alongside fonts.
-- The user picks one (or "none") on a dedicated settings screen;
-- it renders as an absolute layer behind the dashboard content.

alter table profiles
  add column if not exists selected_decoration text not null default 'none';
