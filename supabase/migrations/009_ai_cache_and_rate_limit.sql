-- Persistent AI image cache and generation accounting.
create table if not exists public.ai_generation_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  request_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_generation_events_owner_created
  on public.ai_generation_events (owner_id, created_at desc);

alter table public.ai_generation_events enable row level security;

drop policy if exists "Users manage own AI generation events" on public.ai_generation_events;
create policy "Users manage own AI generation events"
on public.ai_generation_events for all to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ai-visual-cache', 'ai-visual-cache', false, 10485760, array['application/json'])
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['application/json'];

drop policy if exists "Users can read AI visual cache" on storage.objects;
drop policy if exists "Users can upload AI visual cache" on storage.objects;
drop policy if exists "Users can update AI visual cache" on storage.objects;
drop policy if exists "Users can delete AI visual cache" on storage.objects;

create policy "Users can read AI visual cache"
on storage.objects for select to authenticated
using (bucket_id = 'ai-visual-cache' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload AI visual cache"
on storage.objects for insert to authenticated
with check (bucket_id = 'ai-visual-cache' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update AI visual cache"
on storage.objects for update to authenticated
using (bucket_id = 'ai-visual-cache' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'ai-visual-cache' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete AI visual cache"
on storage.objects for delete to authenticated
using (bucket_id = 'ai-visual-cache' and (storage.foldername(name))[1] = auth.uid()::text);
