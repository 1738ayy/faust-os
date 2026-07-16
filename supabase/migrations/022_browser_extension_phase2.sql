-- Browser Extension Phase 2: device/session auth, artifacts, and action observability.
create table if not exists extension_devices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  browser text not null,
  environment text not null check (environment in ('local','staging','production')),
  version text not null,
  permissions jsonb not null default '[]'::jsonb,
  status text not null check (status in ('active','revoked')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists extension_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  device_id uuid not null references extension_devices(id) on delete cascade,
  token_hash text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  rotated_at timestamptz,
  revoked_at timestamptz,
  last_nonce text,
  used_nonces jsonb not null default '[]'::jsonb,
  unique (business_id, token_hash)
);

create table if not exists extension_artifacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  device_id uuid references extension_devices(id) on delete set null,
  channel_listing_draft_id uuid references channel_listing_drafts(id) on delete set null,
  marketplace text,
  artifact_type text not null check (artifact_type in ('screenshot','dom_snapshot','log','failed_field','publish_confirmation')),
  storage_provider text not null default 'supabase_storage_ready',
  url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists extension_action_audits (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  device_id uuid references extension_devices(id) on delete set null,
  action text not null,
  status text not null check (status in ('succeeded','failed','blocked')),
  marketplace text,
  channel_listing_draft_id uuid references channel_listing_drafts(id) on delete set null,
  correlation_id uuid not null,
  nonce text,
  detail text not null,
  artifact_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists extension_devices_business_status_idx on extension_devices(business_id, status, last_seen_at desc);
create index if not exists extension_sessions_device_active_idx on extension_sessions(device_id, expires_at) where revoked_at is null;
create index if not exists extension_artifacts_business_marketplace_idx on extension_artifacts(business_id, marketplace, created_at desc);
create index if not exists extension_action_audits_business_created_idx on extension_action_audits(business_id, created_at desc);

alter table extension_devices enable row level security;
alter table extension_sessions enable row level security;
alter table extension_artifacts enable row level security;
alter table extension_action_audits enable row level security;

create policy "extension_devices_tenant_read" on extension_devices for select using (business_id in (select business_id from business_memberships where user_id = auth.uid()));
create policy "extension_devices_tenant_write" on extension_devices for all using (business_id in (select business_id from business_memberships where user_id = auth.uid() and role in ('owner','admin'))) with check (business_id in (select business_id from business_memberships where user_id = auth.uid() and role in ('owner','admin')));
create policy "extension_sessions_tenant_admin" on extension_sessions for all using (business_id in (select business_id from business_memberships where user_id = auth.uid() and role in ('owner','admin'))) with check (business_id in (select business_id from business_memberships where user_id = auth.uid() and role in ('owner','admin')));
create policy "extension_artifacts_tenant_read" on extension_artifacts for select using (business_id in (select business_id from business_memberships where user_id = auth.uid()));
create policy "extension_artifacts_tenant_write" on extension_artifacts for all using (business_id in (select business_id from business_memberships where user_id = auth.uid() and role in ('owner','admin'))) with check (business_id in (select business_id from business_memberships where user_id = auth.uid() and role in ('owner','admin')));
create policy "extension_action_audits_tenant_read" on extension_action_audits for select using (business_id in (select business_id from business_memberships where user_id = auth.uid()));
create policy "extension_action_audits_tenant_write" on extension_action_audits for all using (business_id in (select business_id from business_memberships where user_id = auth.uid() and role in ('owner','admin'))) with check (business_id in (select business_id from business_memberships where user_id = auth.uid() and role in ('owner','admin')));
