-- Private bucket for household media (product / recipe images, receipts).
-- Object path convention: <household_id>/<anything>. Access follows household membership.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'household-media',
  'household-media',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf']
)
on conflict (id) do nothing;

create or replace function public.storage_household_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return (string_to_array(object_name, '/'))[1]::uuid;
exception when others then
  return null;
end;
$$;

create policy household_media_select on storage.objects for select to authenticated
  using (bucket_id = 'household-media' and public.is_household_member(public.storage_household_id(name)));
create policy household_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'household-media' and public.can_write_household(public.storage_household_id(name)));
create policy household_media_update on storage.objects for update to authenticated
  using (bucket_id = 'household-media' and public.can_write_household(public.storage_household_id(name)))
  with check (bucket_id = 'household-media' and public.can_write_household(public.storage_household_id(name)));
create policy household_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'household-media' and public.can_write_household(public.storage_household_id(name)));
