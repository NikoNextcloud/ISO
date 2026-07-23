-- Extended company profile used by all ISO system generators.
-- Every field is optional so existing organizations remain valid.
alter table public.organizations
  add column if not exists legal_form text,
  add column if not exists city text,
  add column if not exists founded_at date,
  add column if not exists physical_scope text,
  add column if not exists system_date date,
  add column if not exists organization_context text,
  add column if not exists processes_description text,
  add column if not exists training_details text,
  add column if not exists internal_audit_date date,
  add column if not exists management_review_date date,
  add column if not exists previous_year integer,
  add column if not exists current_year integer;

alter table public.organizations
  drop constraint if exists organizations_previous_year_check,
  drop constraint if exists organizations_current_year_check;

alter table public.organizations
  add constraint organizations_previous_year_check
    check (previous_year is null or previous_year between 1900 and 2200),
  add constraint organizations_current_year_check
    check (current_year is null or current_year between 1900 and 2200);
