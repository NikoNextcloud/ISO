alter type public.iso_standard_code add value if not exists 'ISO 9001-14001-45001';

alter table if exists public.template_versions
  drop constraint if exists template_versions_standard_check;

alter table if exists public.template_versions
  add constraint template_versions_standard_check
  check (standard in (
    'ISO 9001',
    'ISO 14001',
    'ISO 45001',
    'ISO 27001',
    'ISO 50001',
    'ISO 9-20-27',
    'ISO 9-14',
    'ISO 9001-14001-45001'
  ));
