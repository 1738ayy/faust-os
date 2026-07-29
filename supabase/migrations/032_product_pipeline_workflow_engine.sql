create table if not exists public.product_pipeline_stages (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  stage text not null,
  priority numeric not null default 0,
  readiness_score numeric not null default 0,
  source_revision text not null default '',
  observed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, product_id, variant_id)
);

create table if not exists public.product_pipeline_queue_items (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  deterministic_key text not null,
  item_type text not null,
  severity text not null,
  priority numeric not null default 0,
  estimated_time integer not null default 0,
  expected_benefit text not null default '',
  blocking boolean not null default false,
  recommended_action text not null default 'Review',
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  sku text not null,
  title text not null,
  detail text not null default '',
  href text not null default '/',
  stage text not null,
  status text not null default 'open',
  generated_from text not null default 'product_pipeline',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.product_pipeline_queue_history (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  queue_item_id uuid not null references public.product_pipeline_queue_items(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  action text not null,
  detail text not null default '',
  actor text,
  created_at timestamptz not null default now()
);

create table if not exists public.product_pipeline_stage_history (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  reason text not null default '',
  source_revision text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.product_pipeline_review_sessions (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  status text not null default 'active',
  product_ids uuid[] not null default '{}',
  queue_item_ids uuid[] not null default '{}',
  estimated_minutes integer not null default 1,
  goal text not null default 'Ready for Publishing',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_pipeline_bulk_operations (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  operation_type text not null,
  status text not null default 'completed',
  queue_item_ids uuid[] not null default '{}',
  product_ids uuid[] not null default '{}',
  skipped_queue_item_ids uuid[] not null default '{}',
  result_summary text not null default '',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.product_pipeline_task_resolutions (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  queue_item_id uuid not null references public.product_pipeline_queue_items(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  resolution text not null,
  before_stage text not null,
  after_stage text not null,
  action text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now()
);

alter table public.product_pipeline_stages enable row level security;
alter table public.product_pipeline_queue_items enable row level security;
alter table public.product_pipeline_queue_history enable row level security;
alter table public.product_pipeline_stage_history enable row level security;
alter table public.product_pipeline_review_sessions enable row level security;
alter table public.product_pipeline_bulk_operations enable row level security;
alter table public.product_pipeline_task_resolutions enable row level security;

drop policy if exists "tenant product pipeline stages" on public.product_pipeline_stages;
create policy "tenant product pipeline stages" on public.product_pipeline_stages using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "tenant product pipeline queue items" on public.product_pipeline_queue_items;
create policy "tenant product pipeline queue items" on public.product_pipeline_queue_items using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "tenant product pipeline queue history" on public.product_pipeline_queue_history;
create policy "tenant product pipeline queue history" on public.product_pipeline_queue_history using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "tenant product pipeline stage history" on public.product_pipeline_stage_history;
create policy "tenant product pipeline stage history" on public.product_pipeline_stage_history using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "tenant product pipeline review sessions" on public.product_pipeline_review_sessions;
create policy "tenant product pipeline review sessions" on public.product_pipeline_review_sessions using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "tenant product pipeline bulk operations" on public.product_pipeline_bulk_operations;
create policy "tenant product pipeline bulk operations" on public.product_pipeline_bulk_operations using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "tenant product pipeline task resolutions" on public.product_pipeline_task_resolutions;
create policy "tenant product pipeline task resolutions" on public.product_pipeline_task_resolutions using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create index if not exists product_pipeline_stages_product_idx on public.product_pipeline_stages(business_id, product_id, variant_id);
create unique index if not exists product_pipeline_queue_items_open_key_idx on public.product_pipeline_queue_items(business_id, deterministic_key) where status = 'open';
create index if not exists product_pipeline_queue_items_status_idx on public.product_pipeline_queue_items(business_id, status, severity, priority desc);
create index if not exists product_pipeline_queue_items_product_idx on public.product_pipeline_queue_items(business_id, product_id, variant_id);
create index if not exists product_pipeline_queue_history_item_idx on public.product_pipeline_queue_history(business_id, queue_item_id, created_at desc);
create index if not exists product_pipeline_stage_history_product_idx on public.product_pipeline_stage_history(business_id, product_id, created_at desc);
create index if not exists product_pipeline_review_sessions_status_idx on public.product_pipeline_review_sessions(business_id, status, created_at desc);
create index if not exists product_pipeline_bulk_operations_type_idx on public.product_pipeline_bulk_operations(business_id, operation_type, created_at desc);
create index if not exists product_pipeline_task_resolutions_product_idx on public.product_pipeline_task_resolutions(business_id, product_id, created_at desc);

notify pgrst, 'reload schema';
