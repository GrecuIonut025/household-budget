-- Allow any authenticated user to read media that backs the global community feed
-- (published recipe photos + avatars of community authors/commenters).
-- Private household files stay locked to household membership.

create or replace function public.is_community_feed_media(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    object_name is not null
    and (
      exists (
        select 1
        from public.recipes r
        where r.image_path = object_name
          and r.community_published_at is not null
      )
      or exists (
        select 1
        from public.profiles p
        where p.avatar_path = object_name
          and (
            exists (
              select 1
              from public.recipes r
              where r.created_by = p.id
                and r.community_published_at is not null
            )
            or exists (
              select 1
              from public.community_comments c
              where c.author_id = p.id
            )
          )
      )
    );
$$;

revoke all on function public.is_community_feed_media(text) from public, anon;
grant execute on function public.is_community_feed_media(text) to authenticated, service_role;

drop policy if exists household_media_community_select on storage.objects;
create policy household_media_community_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'household-media'
    and public.is_community_feed_media(name)
  );

-- Dedicated community-media bucket: authenticated read for all signed-in users.
-- Writers still use household-media; this bucket is available for community-scoped
-- copies / future uploads without loosening private product/receipt paths.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-media',
  'community-media',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

drop policy if exists community_media_select on storage.objects;
create policy community_media_select on storage.objects
  for select to authenticated
  using (bucket_id = 'community-media');

drop policy if exists community_media_insert on storage.objects;
create policy community_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'community-media'
    and public.is_household_member(public.storage_household_id(name))
    and public.can_write_household(public.storage_household_id(name))
  );

drop policy if exists community_media_update on storage.objects;
create policy community_media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'community-media'
    and public.can_write_household(public.storage_household_id(name))
  )
  with check (
    bucket_id = 'community-media'
    and public.can_write_household(public.storage_household_id(name))
  );

drop policy if exists community_media_delete on storage.objects;
create policy community_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'community-media'
    and public.can_write_household(public.storage_household_id(name))
  );
