create table if not exists public.operations_feedback (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('bug', 'feature_request', 'workflow_friction')),
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  status text not null check (status in ('open', 'triaged', 'in_progress', 'resolved', 'deferred')),
  workflow text not null,
  title text not null,
  expected_action text,
  actual_action text,
  time_lost_minutes integer not null default 0,
  frequency integer not null default 1,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  linked_record_type text,
  linked_record_id text,
  workaround text,
  proposed_improvement text,
  fix_version text,
  source text not null default 'dogfooding' check (source in ('dogfooding', 'internal_ops', 'support', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dogfooding_sessions (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  session_date date not null,
  products_imported integer not null default 0,
  review_time_minutes integer not null default 0,
  publishing_time_minutes integer not null default 0,
  corrections_made integer not null default 0,
  automation_actions integer not null default 0,
  failures_encountered integer not null default 0,
  ui_friction_count integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.operations_feedback enable row level security;
alter table public.dogfooding_sessions enable row level security;

drop policy if exists "tenant operations feedback" on public.operations_feedback;
create policy "tenant operations feedback" on public.operations_feedback using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "tenant dogfooding sessions" on public.dogfooding_sessions;
create policy "tenant dogfooding sessions" on public.dogfooding_sessions using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create index if not exists operations_feedback_business_status_idx on public.operations_feedback(business_id, status, severity, updated_at desc);
create index if not exists operations_feedback_linked_record_idx on public.operations_feedback(business_id, linked_record_type, linked_record_id);
create index if not exists dogfooding_sessions_business_date_idx on public.dogfooding_sessions(business_id, session_date desc);

notify pgrst, 'reload schema';
