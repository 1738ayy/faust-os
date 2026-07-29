create table if not exists public.marketplace_connector_credentials (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  marketplace text not null,
  account_id uuid not null references public.marketplace_accounts(id) on delete cascade,
  auth_mode text not null,
  status text not null,
  token_ref text not null,
  scopes text[] not null default '{}',
  expires_at timestamptz,
  last_validated_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, marketplace, account_id)
);

create table if not exists public.marketplace_connector_diagnostics (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  marketplace text not null,
  account_id uuid references public.marketplace_accounts(id) on delete set null,
  draft_id uuid references public.channel_listing_drafts(id) on delete set null,
  task_id uuid references public.marketplace_publish_tasks(id) on delete set null,
  operation text not null,
  status text not null,
  http_status integer,
  request_id text,
  retryable boolean not null default false,
  failure_code text,
  message text not null,
  suggested_resolution text not null,
  connector_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_listing_snapshots (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  marketplace text not null,
  draft_id uuid not null references public.channel_listing_drafts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  external_listing_id text not null,
  external_url text,
  status text not null,
  title text not null,
  description text not null,
  price numeric not null,
  quantity integer not null,
  category text not null,
  image_urls jsonb not null default '[]'::jsonb,
  observed_at timestamptz not null default now(),
  source text not null,
  connector_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  unique (business_id, marketplace, draft_id, external_listing_id)
);

alter table public.marketplace_connector_credentials enable row level security;
alter table public.marketplace_connector_diagnostics enable row level security;
alter table public.marketplace_listing_snapshots enable row level security;

drop policy if exists "tenant marketplace connector credentials" on public.marketplace_connector_credentials;
create policy "tenant marketplace connector credentials" on public.marketplace_connector_credentials using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "tenant marketplace connector diagnostics" on public.marketplace_connector_diagnostics;
create policy "tenant marketplace connector diagnostics" on public.marketplace_connector_diagnostics using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "tenant marketplace listing snapshots" on public.marketplace_listing_snapshots;
create policy "tenant marketplace listing snapshots" on public.marketplace_listing_snapshots using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create index if not exists marketplace_connector_credentials_status_idx on public.marketplace_connector_credentials(business_id, marketplace, status);
create index if not exists marketplace_connector_diagnostics_recent_idx on public.marketplace_connector_diagnostics(business_id, marketplace, created_at desc);
create index if not exists marketplace_listing_snapshots_draft_idx on public.marketplace_listing_snapshots(business_id, draft_id, observed_at desc);

notify pgrst, 'reload schema';
