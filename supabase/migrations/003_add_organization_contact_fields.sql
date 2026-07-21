-- Run this migration when the Supabase project was created with an earlier version.
alter table public.organizations
  add column if not exists representative text,
  add column if not exists contact_name text,
  add column if not exists contact_phone text;
