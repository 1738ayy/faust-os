create table if not exists public.intelligence_decision_timeline (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  event_type text not null,
  title text not null,
  detail text not null,
  evidence_ids uuid[] not null default '{}',
  decision_ids uuid[] not null default '{}',
  source_records jsonb not null default '[]'::jsonb,
  confidence numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.intelligence_benchmark_runs (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  suite text not null check (suite in ('product_knowledge', 'visual_category', 'marketplace_adapter', 'automation_rules')),
  version_label text not null default 'current',
  fixture_count integer not null default 0,
  field_result_count integer not null default 0,
  accuracy numeric not null default 0,
  previous_accuracy numeric,
  improvement numeric,
  regression_count integer not null default 0,
  improvement_count integer not null default 0,
  failed_fixtures jsonb not null default '[]'::jsonb,
  confidence_buckets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.intelligence_replay_runs (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  version_label text not null default 'current',
  historical_field_count integer not null default 0,
  current_field_count integer not null default 0,
  changed_fields jsonb not null default '[]'::jsonb,
  deterministic boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.intelligence_repository_parity_checks (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  local_counts jsonb not null default '{}'::jsonb,
  production_counts jsonb not null default '{}'::jsonb,
  mismatches jsonb not null default '[]'::jsonb,
  schema_version text not null,
  ready boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.intelligence_diagnostics_bundles (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  label text not null,
  summary text not null,
  sections jsonb not null default '[]'::jsonb,
  artifact jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.intelligence_decision_timeline enable row level security;
alter table public.intelligence_benchmark_runs enable row level security;
alter table public.intelligence_replay_runs enable row level security;
alter table public.intelligence_repository_parity_checks enable row level security;
alter table public.intelligence_diagnostics_bundles enable row level security;

drop policy if exists "tenant intelligence decision timeline" on public.intelligence_decision_timeline;
create policy "tenant intelligence decision timeline" on public.intelligence_decision_timeline using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "tenant intelligence benchmark runs" on public.intelligence_benchmark_runs;
create policy "tenant intelligence benchmark runs" on public.intelligence_benchmark_runs using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "tenant intelligence replay runs" on public.intelligence_replay_runs;
create policy "tenant intelligence replay runs" on public.intelligence_replay_runs using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "tenant intelligence repository parity checks" on public.intelligence_repository_parity_checks;
create policy "tenant intelligence repository parity checks" on public.intelligence_repository_parity_checks using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "tenant intelligence diagnostics bundles" on public.intelligence_diagnostics_bundles;
create policy "tenant intelligence diagnostics bundles" on public.intelligence_diagnostics_bundles using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create index if not exists intelligence_decision_timeline_product_idx on public.intelligence_decision_timeline(business_id, product_id, created_at desc);
create index if not exists intelligence_benchmark_runs_recent_idx on public.intelligence_benchmark_runs(business_id, suite, created_at desc);
create index if not exists intelligence_replay_runs_product_idx on public.intelligence_replay_runs(business_id, product_id, created_at desc);
create index if not exists intelligence_repository_parity_recent_idx on public.intelligence_repository_parity_checks(business_id, created_at desc);
create index if not exists intelligence_diagnostics_bundles_recent_idx on public.intelligence_diagnostics_bundles(business_id, created_at desc);

notify pgrst, 'reload schema';
