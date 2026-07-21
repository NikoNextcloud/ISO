-- Private storage for generated ISO systems and uploaded company documents.
alter table public.organization_history
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists file_size bigint;

alter table public.documents
  add column if not exists file_path text,
  add column if not exists original_filename text,
  add column if not exists file_size bigint,
  add column if not exists mime_type text;

insert into storage.buckets (id, name, public, file_size_limit)
values ('organization-files', 'organization-files', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "Users can read owned organization files" on storage.objects;
create policy "Users can read owned organization files"
on storage.objects for select to authenticated
using (
  bucket_id = 'organization-files'
  and exists (
    select 1 from public.organizations
    where organizations.id::text = (storage.foldername(name))[1]
      and organizations.owner_id = auth.uid()
  )
);

drop policy if exists "Users can upload owned organization files" on storage.objects;
create policy "Users can upload owned organization files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'organization-files'
  and exists (
    select 1 from public.organizations
    where organizations.id::text = (storage.foldername(name))[1]
      and organizations.owner_id = auth.uid()
  )
);

drop policy if exists "Users can update owned organization files" on storage.objects;
create policy "Users can update owned organization files"
on storage.objects for update to authenticated
using (
  bucket_id = 'organization-files'
  and exists (
    select 1 from public.organizations
    where organizations.id::text = (storage.foldername(name))[1]
      and organizations.owner_id = auth.uid()
  )
)
with check (
  bucket_id = 'organization-files'
  and exists (
    select 1 from public.organizations
    where organizations.id::text = (storage.foldername(name))[1]
      and organizations.owner_id = auth.uid()
  )
);

drop policy if exists "Users can delete owned organization files" on storage.objects;
create policy "Users can delete owned organization files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'organization-files'
  and exists (
    select 1 from public.organizations
    where organizations.id::text = (storage.foldername(name))[1]
      and organizations.owner_id = auth.uid()
  )
);
