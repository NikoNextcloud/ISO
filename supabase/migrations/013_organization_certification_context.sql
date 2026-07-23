-- Certification context used to adapt ISO documentation to the real organization.
alter table public.organizations
  add column if not exists products_services text,
  add column if not exists environmental_aspects text,
  add column if not exists occupational_risks text,
  add column if not exists external_parties text,
  add column if not exists waste_management text,
  add column if not exists design_development text,
  add column if not exists post_delivery_activities text;

alter table public.organizations
  drop constraint if exists organizations_design_development_check;

alter table public.organizations
  add constraint organizations_design_development_check
    check (
      design_development is null
      or design_development in ('applicable', 'not_applicable')
    );
