create extension if not exists "pgcrypto";

create type public.iso_standard_code as enum (
  'ISO 9001',
  'ISO 14001',
  'ISO 45001',
  'ISO 27001',
  'ISO 50001'
);

create type public.organization_status as enum (
  'draft',
  'implementation',
  'ready',
  'certified',
  'attention'
);

create type public.document_status as enum (
  'draft',
  'review',
  'approved',
  'needs_update'
);

create type public.document_type as enum (
  'policy',
  'procedure',
  'register',
  'plan',
  'report',
  'matrix',
  'form'
);

create type public.task_status as enum (
  'open',
  'in_progress',
  'overdue',
  'done'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  uic text not null,
  address text,
  manager text,
  representative text,
  contact_name text,
  contact_phone text,
  contact_email text,
  employees_count integer not null default 0 check (employees_count >= 0),
  activity text,
  sites_count integer not null default 1 check (sites_count >= 0),
  certification_body text,
  status public.organization_status not null default 'draft',
  readiness_percent integer not null default 0 check (readiness_percent between 0 and 100),
  next_audit_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.standards (
  id uuid primary key default gen_random_uuid(),
  code public.iso_standard_code not null unique,
  title text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.organization_standards (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  standard_id uuid not null references public.standards(id) on delete cascade,
  implementation_scope text,
  selected_at timestamptz not null default now(),
  primary key (organization_id, standard_id)
);

create table public.processes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  owner text,
  description text,
  inputs text,
  outputs text,
  kpi text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  document_type public.document_type not null,
  standards public.iso_standard_code[] not null default '{}',
  placeholders jsonb not null default '[]'::jsonb,
  body text,
  version text not null default '1.0',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid references public.document_templates(id) on delete set null,
  title text not null,
  document_type public.document_type not null,
  standards public.iso_standard_code[] not null default '{}',
  owner text,
  status public.document_status not null default 'draft',
  version text not null default '0.1',
  content jsonb not null default '{}'::jsonb,
  file_url text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  title text not null,
  description text,
  due_date date,
  owner text,
  status public.task_status not null default 'open',
  related_standard public.iso_standard_code,
  reminder_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null default 'mock',
  prompt text not null,
  standards public.iso_standard_code[] not null default '{}',
  response jsonb,
  created_document_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index organizations_owner_id_idx on public.organizations(owner_id);
create index organizations_uic_idx on public.organizations(uic);
create index documents_organization_id_idx on public.documents(organization_id);
create index documents_standards_idx on public.documents using gin (standards);
create index tasks_organization_id_idx on public.tasks(organization_id);
create index tasks_due_date_idx on public.tasks(due_date);
create index ai_requests_organization_id_idx on public.ai_requests(organization_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger processes_set_updated_at
before update on public.processes
for each row execute function public.set_updated_at();

create trigger document_templates_set_updated_at
before update on public.document_templates
for each row execute function public.set_updated_at();

create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.organization_standards enable row level security;
alter table public.processes enable row level security;
alter table public.document_templates enable row level security;
alter table public.documents enable row level security;
alter table public.tasks enable row level security;
alter table public.ai_requests enable row level security;
alter table public.audit_log enable row level security;

create policy "Users can manage owned organizations"
on public.organizations for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Users can read active templates"
on public.document_templates for select
using (active = true);

create policy "Users can manage organization standards for owned organizations"
on public.organization_standards for all
using (
  exists (
    select 1 from public.organizations
    where organizations.id = organization_standards.organization_id
      and organizations.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.organizations
    where organizations.id = organization_standards.organization_id
      and organizations.owner_id = auth.uid()
  )
);

create policy "Users can manage processes for owned organizations"
on public.processes for all
using (
  exists (
    select 1 from public.organizations
    where organizations.id = processes.organization_id
      and organizations.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.organizations
    where organizations.id = processes.organization_id
      and organizations.owner_id = auth.uid()
  )
);

create policy "Users can manage data for owned organizations"
on public.documents for all
using (
  exists (
    select 1 from public.organizations
    where organizations.id = documents.organization_id
      and organizations.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.organizations
    where organizations.id = documents.organization_id
      and organizations.owner_id = auth.uid()
  )
);

create policy "Users can manage tasks for owned organizations"
on public.tasks for all
using (
  exists (
    select 1 from public.organizations
    where organizations.id = tasks.organization_id
      and organizations.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.organizations
    where organizations.id = tasks.organization_id
      and organizations.owner_id = auth.uid()
  )
);

create policy "Users can manage AI requests for owned organizations"
on public.ai_requests for all
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.organizations
    where organizations.id = ai_requests.organization_id
      and organizations.owner_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.organizations
    where organizations.id = ai_requests.organization_id
      and organizations.owner_id = auth.uid()
  )
);

create policy "Users can read audit log for owned organizations"
on public.audit_log for select
using (
  exists (
    select 1 from public.organizations
    where organizations.id = audit_log.organization_id
      and organizations.owner_id = auth.uid()
  )
);

insert into public.standards (code, title, description) values
  ('ISO 9001', 'Quality management system', 'Processes, customer satisfaction, supplier control and improvement.'),
  ('ISO 14001', 'Environmental management system', 'Environmental aspects, compliance obligations, monitoring and emergency preparedness.'),
  ('ISO 45001', 'Occupational health and safety management system', 'Hazards, risk assessment, controls, incidents and worker participation.'),
  ('ISO 27001', 'Information security management system', 'Assets, risk treatment, Statement of Applicability and security controls.'),
  ('ISO 50001', 'Energy management system', 'Energy review, baselines, EnPI, objectives and monitoring.')
on conflict (code) do nothing;

insert into public.document_templates (title, document_type, standards, placeholders, body) values
  (
    'Интегрирана политика',
    'policy',
    array['ISO 9001','ISO 14001','ISO 45001','ISO 27001','ISO 50001']::public.iso_standard_code[],
    '["company_name","scope","standards","manager","approval_date"]'::jsonb,
    'Шаблон за интегрирана политика на системата за управление.'
  ),
  (
    'Контекст на организацията',
    'report',
    array['ISO 9001','ISO 14001','ISO 45001','ISO 27001','ISO 50001']::public.iso_standard_code[],
    '["activity","internal_issues","external_issues","interested_parties"]'::jsonb,
    'Шаблон за анализ на контекст, заинтересовани страни и обхват.'
  ),
  (
    'Оценка на риска',
    'matrix',
    array['ISO 9001','ISO 45001','ISO 27001','ISO 50001']::public.iso_standard_code[],
    '["process","hazards","threats","controls","risk_level","actions"]'::jsonb,
    'Шаблон за оценка на риск и план за мерки.'
  );
