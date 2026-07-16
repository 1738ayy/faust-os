-- Faust OS: Analytics saved reports, filter presets, schedules, and report run history.
create extension if not exists pgcrypto;

create table if not exists public.analytics_saved_reports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  sections jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '[]'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  drilldowns jsonb not null default '[]'::jsonb,
  schedule jsonb not null default '{"frequency":"none","recipients":[]}'::jsonb,
  export_format text not null default 'csv',
  is_default boolean not null default false,
  created_by uuid,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.analytics_filter_presets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.analytics_report_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  report_id uuid references public.analytics_saved_reports(id) on delete cascade,
  status text not null check (status in ('queued','completed','failed')),
  filters jsonb not null default '{}'::jsonb,
  exported_row_count integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists analytics_saved_reports_business_idx on public.analytics_saved_reports (business_id, is_default, updated_at);
create index if not exists analytics_filter_presets_business_idx on public.analytics_filter_presets (business_id, is_default);
create index if not exists analytics_report_runs_business_idx on public.analytics_report_runs (business_id, report_id, created_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array['analytics_saved_reports','analytics_filter_presets','analytics_report_runs'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "%s read" on public.%I', table_name, table_name);
    execute format('create policy "%s read" on public.%I for select using (public.is_business_member(business_id))', table_name, table_name);
    execute format('drop policy if exists "%s write" on public.%I', table_name, table_name);
    execute format('create policy "%s write" on public.%I for all using (public.has_business_role(business_id, array[''owner'',''admin'',''operations'',''finance''])) with check (public.has_business_role(business_id, array[''owner'',''admin'',''operations'',''finance'']))', table_name, table_name);
  end loop;
end $$;
