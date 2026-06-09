-- Profile pictures.
--
-- - profiles.avatar_url: public URL of the user's uploaded avatar
--   in the 'avatars' storage bucket (null = no avatar set).
-- - Storage bucket 'avatars' (public read) created via SQL so users
--   don't have to click through the Storage UI.
-- - RLS policies scope writes to the user's own folder
--   (objects whose first path segment matches auth.uid()), while
--   keeping reads open so the avatar URL can be displayed without
--   authentication on the client.

alter table profiles
  add column if not exists avatar_url text;

-- Bucket (id-conflict-safe so this migration is idempotent).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- INSERT
drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- UPDATE
drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE
drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- SELECT (public read so anyone can render the avatar via its URL).
drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
on storage.objects for select
using (bucket_id = 'avatars');
