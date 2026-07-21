-- Adds company certificates and a permanent activity history.
create table if not exists public.organization_certificates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  standard public.iso_standard_code not null,
  certificate_number text,
  certification_body text,
  issued_at date,
  valid_until date,
  next_certification_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  description text not null,
  event_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists organization_certificates_organization_id_idx on public.organization_certificates(organization_id);
create index if not exists organization_certificates_next_date_idx on public.organization_certificates(next_certification_date);
create index if not exists organization_history_organization_id_idx on public.organization_history(organization_id);
create index if not exists organization_history_event_date_idx on public.organization_history(event_date desc);

drop trigger if exists organization_certificates_set_updated_at on public.organization_certificates;
create trigger organization_certificates_set_updated_at
before update on public.organization_certificates
for each row execute function public.set_updated_at();

alter table public.organization_certificates enable row level security;
alter table public.organization_history enable row level security;

drop policy if exists "Users can manage certificates for owned organizations" on public.organization_certificates;
create policy "Users can manage certificates for owned organizations"
on public.organization_certificates for all
using (exists (select 1 from public.organizations where organizations.id = organization_certificates.organization_id and organizations.owner_id = auth.uid()))
with check (exists (select 1 from public.organizations where organizations.id = organization_certificates.organization_id and organizations.owner_id = auth.uid()));

drop policy if exists "Users can manage history for owned organizations" on public.organization_history;
create policy "Users can manage history for owned organizations"
on public.organization_history for all
using (exists (select 1 from public.organizations where organizations.id = organization_history.organization_id and organizations.owner_id = auth.uid()))
with check (exists (select 1 from public.organizations where organizations.id = organization_history.organization_id and organizations.owner_id = auth.uid()));

-- These MVP modules were removed from the application.
alter table if exists public.documents drop column if exists template_id;
drop table if exists public.tasks;
drop table if exists public.ai_requests;
drop table if exists public.document_templates;
drop type if exists public.task_status;
