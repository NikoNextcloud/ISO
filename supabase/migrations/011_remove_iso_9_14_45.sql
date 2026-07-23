-- Removes the retired ISO 9-14-45 system from existing projects.
delete from public.organization_history
where description ilike '%ISO 9-14-45%';

delete from public.template_versions
where standard = 'ISO 9-14-45';

delete from public.organization_certificates
where standard::text = 'ISO 9-14-45';

delete from public.organization_standards
where standard_id in (
  select id from public.standards where code::text = 'ISO 9-14-45'
);

do $$
begin
  if exists (
    select 1
    from pg_enum
    join pg_type on pg_type.oid = pg_enum.enumtypid
    join pg_namespace on pg_namespace.oid = pg_type.typnamespace
    where pg_namespace.nspname = 'public'
      and pg_type.typname = 'iso_standard_code'
      and pg_enum.enumlabel = 'ISO 9-14-45'
  ) then
    execute $sql$
      update public.organizations
      set standards = array_remove(standards, 'ISO 9-14-45'::public.iso_standard_code)
      where 'ISO 9-14-45'::public.iso_standard_code = any(standards)
    $sql$;

    execute $sql$
      update public.documents
      set standards = array_remove(standards, 'ISO 9-14-45'::public.iso_standard_code)
      where 'ISO 9-14-45'::public.iso_standard_code = any(standards)
    $sql$;
  end if;
end
$$;

delete from public.standards
where code::text = 'ISO 9-14-45';
