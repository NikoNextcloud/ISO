-- Fixes Storage RLS for the application's single-user deployment.
-- Existing organizations are assigned to the first Supabase Auth user.
do $$
declare
  app_user_id uuid;
begin
  select id into app_user_id
  from auth.users
  order by created_at asc
  limit 1;

  if app_user_id is null then
    raise exception 'No Supabase Auth user exists. Create the application user first.';
  end if;

  update public.organizations
  set owner_id = app_user_id
  where owner_id is distinct from app_user_id;
end $$;

insert into storage.buckets (id, name, public, file_size_limit)
values ('organization-files', 'organization-files', false, 52428800)
on conflict (id) do update
set public = false,
    file_size_limit = 52428800;

drop policy if exists "Users can read owned organization files" on storage.objects;
drop policy if exists "Users can upload owned organization files" on storage.objects;
drop policy if exists "Users can update owned organization files" on storage.objects;
drop policy if exists "Users can delete owned organization files" on storage.objects;
drop policy if exists "Single user can read organization files" on storage.objects;
drop policy if exists "Single user can upload organization files" on storage.objects;
drop policy if exists "Single user can update organization files" on storage.objects;
drop policy if exists "Single user can delete organization files" on storage.objects;

create policy "Single user can read organization files"
on storage.objects for select to authenticated
using (bucket_id = 'organization-files');

create policy "Single user can upload organization files"
on storage.objects for insert to authenticated
with check (bucket_id = 'organization-files');

create policy "Single user can update organization files"
on storage.objects for update to authenticated
using (bucket_id = 'organization-files')
with check (bucket_id = 'organization-files');

create policy "Single user can delete organization files"
on storage.objects for delete to authenticated
using (bucket_id = 'organization-files');
