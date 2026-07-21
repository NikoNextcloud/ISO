-- Run this migration when 001_initial_schema.sql has already been applied.
alter table public.organizations
  add column if not exists standards public.iso_standard_code[] not null default '{}';

create index if not exists organizations_standards_idx
  on public.organizations using gin (standards);
