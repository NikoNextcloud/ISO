-- Versioned ISO template packages. The active ZIP package overrides the bundled templates.
create table if not exists public.template_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  standard text not null,
  version text not null,
  original_filename text not null,
  storage_path text not null unique,
  file_size bigint not null default 0,
  mime_type text,
  notes text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  check (standard in ('ISO 9001', 'ISO 14001', 'ISO 45001', 'ISO 27001', 'ISO 50001', 'ISO 9-20-27', 'ISO 9-14-45', 'ISO 9-14'))
);

create unique index if not exists template_versions_one_active_per_standard
  on public.template_versions (owner_id, standard)
  where is_active;

alter table public.template_versions enable row level security;

drop policy if exists "Users manage own template versions" on public.template_versions;
create policy "Users manage own template versions"
on public.template_versions for all to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('iso-templates', 'iso-templates', false, 52428800, array['application/zip', 'application/x-zip-compressed'])
on conflict (id) do update
set public = false,
    file_size_limit = 52428800,
    allowed_mime_types = array['application/zip', 'application/x-zip-compressed'];

drop policy if exists "Single user can read ISO templates" on storage.objects;
drop policy if exists "Single user can upload ISO templates" on storage.objects;
drop policy if exists "Single user can update ISO templates" on storage.objects;
drop policy if exists "Single user can delete ISO templates" on storage.objects;

create policy "Single user can read ISO templates"
on storage.objects for select to authenticated
using (bucket_id = 'iso-templates');

create policy "Single user can upload ISO templates"
on storage.objects for insert to authenticated
with check (bucket_id = 'iso-templates');

create policy "Single user can update ISO templates"
on storage.objects for update to authenticated
using (bucket_id = 'iso-templates')
with check (bucket_id = 'iso-templates');

create policy "Single user can delete ISO templates"
on storage.objects for delete to authenticated
using (bucket_id = 'iso-templates');
