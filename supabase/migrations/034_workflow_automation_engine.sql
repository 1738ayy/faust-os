create table if not exists public.automation_policies (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  profile text not null check (profile in ('manual', 'suggested', 'assisted', 'automatic')),
  enabled boolean not null default true,
  safe_actions_autonomous boolean not null default true,
  approval_required_actions boolean not null default true,
  blocked_actions_prevented boolean not null default true,
  cooldown_minutes integer not null default 5 check (cooldown_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (business_id, id)
);

create table if not exists public.automation_dry_run_summaries (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  rule_id uuid references public.automation_rules_v2(id) on delete set null,
  event_type text,
  profile text not null check (profile in ('manual', 'suggested', 'assisted', 'automatic')),
  would_run_count integer not null default 0,
  would_skip_count integer not null default 0,
  safe_action_count integer not null default 0,
  approval_action_count integer not null default 0,
  blocked_action_count integer not null default 0,
  estimated_time_saved_minutes numeric not null default 0,
  changes_applied boolean not null default false,
  action_breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.automation_metric_snapshots (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  total_runs integer not null default 0,
  success_rate numeric not null default 0,
  failure_rate numeric not null default 0,
  dry_run_count integer not null default 0,
  approval_count integer not null default 0,
  time_saved_minutes numeric not null default 0,
  manual_interventions_avoided integer not null default 0,
  disabled_rules integer not null default 0,
  average_duration_ms integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.automation_policies enable row level security;
alter table public.automation_dry_run_summaries enable row level security;
alter table public.automation_metric_snapshots enable row level security;

drop policy if exists "tenant automation policies" on public.automation_policies;
create policy "tenant automation policies" on public.automation_policies using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "tenant automation dry run summaries" on public.automation_dry_run_summaries;
create policy "tenant automation dry run summaries" on public.automation_dry_run_summaries using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "tenant automation metric snapshots" on public.automation_metric_snapshots;
create policy "tenant automation metric snapshots" on public.automation_metric_snapshots using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create index if not exists automation_policies_business_profile_idx on public.automation_policies(business_id, profile);
create index if not exists automation_dry_run_summaries_recent_idx on public.automation_dry_run_summaries(business_id, created_at desc);
create index if not exists automation_metric_snapshots_recent_idx on public.automation_metric_snapshots(business_id, created_at desc);

notify pgrst, 'reload schema';
