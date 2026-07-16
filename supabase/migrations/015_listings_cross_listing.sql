-- Faust OS: Listings & Cross-Listing normalized persistence and transactional operations.
create extension if not exists pgcrypto;

create table if not exists public.marketplace_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  marketplace text not null check (marketplace in ('Depop','eBay','Etsy','Mercari','Poshmark')),
  display_name text not null,
  status text not null default 'extension_assisted' check (status in ('manual','extension_assisted','adapter_ready','credentials_required','connected','paused')),
  supports_api_publish boolean not null default false,
  supports_extension boolean not null default true,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (business_id, marketplace, display_name)
);

create table if not exists public.listing_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  marketplace text not null check (marketplace in ('Depop','eBay','Etsy','Mercari','Poshmark','Manual')),
  category text not null,
  title_format text not null,
  description_format text not null,
  price_adjustment_percent numeric not null default 0,
  default_attributes jsonb not null default '{}'::jsonb,
  image_policy text not null default 'all' check (image_policy in ('all','first_four','square_crop')),
  shipping_profile text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.channel_listing_drafts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id),
  physical_sku text not null,
  marketplace text not null check (marketplace in ('Depop','eBay','Etsy','Mercari','Poshmark')),
  account_id uuid references public.marketplace_accounts(id),
  template_id uuid references public.listing_templates(id),
  title text not null,
  description text not null,
  price numeric not null check (price >= 0),
  category text not null,
  attributes jsonb not null default '{}'::jsonb,
  image_urls jsonb not null default '[]'::jsonb,
  quantity integer not null default 0 check (quantity >= 0),
  status text not null default 'draft' check (status in ('draft','validated','queued','published','manual_required','paused','delisted','sold','failed')),
  validation_errors jsonb not null default '[]'::jsonb,
  publish_mode text not null check (publish_mode in ('adapter','extension','manual')),
  external_listing_id text,
  external_url text,
  last_sync_at timestamptz,
  sync_state text not null default 'pending' check (sync_state in ('clean','pending','risk_locked','failed','manual')),
  risk_lock_id uuid references public.inventory_risk_locks(id),
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (business_id, variant_id, marketplace)
);

create table if not exists public.listing_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  channel_draft_id uuid not null references public.channel_listing_drafts(id) on delete cascade,
  marketplace text not null,
  action text not null check (action in ('publish','pause','delist','sync_quantity','confirm_external','sold_coordination','retry')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','dead_lettered','manual_required')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  error text,
  idempotency_key uuid,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.listing_review_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  channel_draft_id uuid references public.channel_listing_drafts(id) on delete cascade,
  marketplace text not null,
  severity text not null check (severity in ('critical','warning','info')),
  reason text not null check (reason in ('validation_error','manual_publish_required','sync_failed','risk_lock','external_confirmation_required','sold_coordination')),
  status text not null default 'open' check (status in ('open','resolved','archived')),
  detail text not null,
  action_label text not null default 'Review listing',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  archived_at timestamptz
);

create table if not exists public.listings_mutation_receipts (
  business_id uuid not null references public.businesses(id) on delete cascade,
  idempotency_key uuid not null,
  action text not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (business_id, idempotency_key)
);

create index if not exists channel_listing_drafts_variant_idx on public.channel_listing_drafts (business_id, variant_id, marketplace);
create index if not exists channel_listing_drafts_status_idx on public.channel_listing_drafts (business_id, status, sync_state);
create index if not exists listing_sync_jobs_status_idx on public.listing_sync_jobs (business_id, status, run_after);
create index if not exists listing_review_items_open_idx on public.listing_review_items (business_id, status, reason);

do $$
declare table_name text;
begin
  foreach table_name in array array['marketplace_accounts','listing_templates','channel_listing_drafts','listing_sync_jobs','listing_review_items','listings_mutation_receipts'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "%s read" on public.%I', table_name, table_name);
    execute format('create policy "%s read" on public.%I for select using (public.is_business_member(business_id))', table_name, table_name);
    execute format('drop policy if exists "%s write" on public.%I', table_name, table_name);
    execute format('create policy "%s write" on public.%I for all using (public.has_business_role(business_id, array[''owner'',''admin'',''operations''])) with check (public.has_business_role(business_id, array[''owner'',''admin'',''operations'']))', table_name, table_name);
  end loop;
end $$;

create or replace function public.seed_listing_defaults(p_business_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare market text;
begin
  foreach market in array array['Depop','eBay','Etsy','Mercari','Poshmark'] loop
    insert into public.marketplace_accounts (business_id, marketplace, display_name, status, supports_api_publish, supports_extension)
    values (p_business_id, market, market || ' default', case when market in ('Depop','eBay') then 'adapter_ready' else 'extension_assisted' end, market in ('Depop','eBay'), market in ('Etsy','Mercari','Poshmark'))
    on conflict do nothing;
    insert into public.listing_templates (business_id, marketplace, name, category, title_format, description_format, price_adjustment_percent, default_attributes, image_policy, shipping_profile)
    values (p_business_id, market, market || ' streetwear template', case when market='Etsy' then 'Clothing' else 'Menswear' end, '{title} - {sku}', '{title}\n\nCondition: {condition}\nPhysical SKU: {physicalSku}\nShips from Faust OS inventory.', case when market='Poshmark' then 12 when market='eBay' then 8 else 0 end, '{"brand":"Unbranded","style":"Streetwear","condition":"New with tags"}', case when market='Poshmark' then 'square_crop' else 'all' end, 'Standard seller-paid shipping')
    on conflict do nothing;
  end loop;
end;
$$;

create or replace function public.mutate_listings_transactional(p_business_id uuid, p_action text, p_payload jsonb, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  receipt jsonb;
  variant_row record;
  product_row record;
  market text;
  listing_id uuid;
  draft_id uuid;
  account_id uuid;
  template_id uuid;
  physical_sku text;
  price numeric;
  qty integer;
  draft record;
begin
  if not public.has_business_role(p_business_id, array['owner','admin','operations']) then
    raise exception 'Not authorized for listings mutation';
  end if;
  select result into receipt from public.listings_mutation_receipts where business_id = p_business_id and idempotency_key = p_idempotency_key;
  if receipt is not null then return receipt; end if;
  perform public.seed_listing_defaults(p_business_id);

  if p_action = 'create-five-drafts' then
    select * into variant_row from public.product_variants where business_id = p_business_id and id = (p_payload->>'variantId')::uuid;
    if variant_row.id is null then raise exception 'Variant not found'; end if;
    select * into product_row from public.products where business_id = p_business_id and id = variant_row.product_id;
    physical_sku := coalesce(p_payload->>'physicalSku', variant_row.sku);
    price := coalesce((p_payload->>'basePrice')::numeric, variant_row.default_price);
    select coalesce(sum(on_hand - reserved - damaged - quarantined - lost), 0)::integer into qty from public.inventory_balances where business_id = p_business_id and variant_id = variant_row.id;
    foreach market in array array['Depop','eBay','Etsy','Mercari','Poshmark'] loop
      select id into account_id from public.marketplace_accounts where business_id = p_business_id and marketplace = market limit 1;
      select id into template_id from public.listing_templates where business_id = p_business_id and marketplace = market limit 1;
      insert into public.listings (business_id, variant_id, marketplace, title, price, quantity, status, sync_state)
      values (p_business_id, variant_row.id, market, product_row.title || ' - ' || variant_row.sku, price, greatest(qty,0), 'draft', 'manual')
      on conflict do nothing returning id into listing_id;
      if listing_id is null then select id into listing_id from public.listings where business_id=p_business_id and variant_id=variant_row.id and marketplace=market limit 1; end if;
      insert into public.physical_sku_mappings (business_id, variant_id, physical_sku, channel_listing_id, channel, external_sku, status, confidence)
      values (p_business_id, variant_row.id, physical_sku, listing_id, market, physical_sku, 'active', 1)
      on conflict (business_id, variant_id, channel_listing_id) do update set physical_sku=excluded.physical_sku, updated_at=now();
      insert into public.channel_listing_drafts (business_id, listing_id, variant_id, physical_sku, marketplace, account_id, template_id, title, description, price, category, attributes, image_urls, quantity, status, validation_errors, publish_mode, sync_state, idempotency_key)
      values (p_business_id, listing_id, variant_row.id, physical_sku, market, account_id, template_id, product_row.title || ' - ' || variant_row.sku, product_row.title || E'\n\nCondition: ' || coalesce(variant_row.condition,'New') || E'\nPhysical SKU: ' || physical_sku, price, case when market='Etsy' then 'Clothing' else 'Menswear' end, '{"brand":"Unbranded","style":"Streetwear","condition":"New with tags"}', coalesce(p_payload->'imageUrls','[]'::jsonb), greatest(qty,0), 'validated', '[]'::jsonb, case when market in ('Depop','eBay') then 'adapter' when market in ('Etsy','Mercari','Poshmark') then 'extension' else 'manual' end, 'pending', p_idempotency_key)
      on conflict (business_id, variant_id, marketplace) do update set updated_at=now() returning id into draft_id;
      insert into public.listing_sync_jobs (business_id, channel_draft_id, marketplace, action, status, idempotency_key) values (p_business_id, draft_id, market, 'publish', case when market in ('Depop','eBay') then 'queued' else 'manual_required' end, p_idempotency_key);
      insert into public.transactional_outbox_events (business_id, topic, aggregate_type, aggregate_id, payload, idempotency_key) values (p_business_id, 'listing.publish_requested', 'channel_listing_draft', draft_id, jsonb_build_object('draftId', draft_id, 'marketplace', market), p_idempotency_key) on conflict do nothing;
      if market in ('Etsy','Mercari','Poshmark') then insert into public.listing_review_items (business_id, channel_draft_id, marketplace, severity, reason, detail, action_label) values (p_business_id, draft_id, market, 'info', 'manual_publish_required', market || ' requires extension/manual publishing until credentials are connected.', 'Open manual workflow'); end if;
    end loop;
    insert into public.activity_events (business_id, action, entity_type, entity_id, detail) values (p_business_id, 'Five channel drafts created', 'variant', variant_row.id, physical_sku);
    receipt := jsonb_build_object('variant_id', variant_row.id, 'drafts', 5);

  elsif p_action = 'publish-draft' then
    select * into draft from public.channel_listing_drafts where business_id=p_business_id and id=(p_payload->>'draftId')::uuid for update;
    if draft.id is null then raise exception 'Draft not found'; end if;
    if draft.publish_mode = 'adapter' then
      update public.channel_listing_drafts set status='published', sync_state='clean', external_listing_id=upper(draft.marketplace)||'-'||substr(draft.id::text,1,8), external_url='https://example.test/'||lower(draft.marketplace)||'/listing/'||substr(draft.id::text,1,8), last_sync_at=now(), updated_at=now() where id=draft.id;
      update public.listings set status='active', sync_state='connected', external_url='https://example.test/'||lower(draft.marketplace)||'/listing/'||substr(draft.id::text,1,8) where id=draft.listing_id;
    else
      update public.channel_listing_drafts set status='manual_required', sync_state='manual', updated_at=now() where id=draft.id;
      insert into public.listing_review_items (business_id, channel_draft_id, marketplace, severity, reason, detail, action_label) values (p_business_id, draft.id, draft.marketplace, 'info', 'manual_publish_required', 'Use the extension-assisted workflow, then confirm external ID and URL.', 'Open manual workflow');
    end if;
    insert into public.activity_events (business_id, action, entity_type, entity_id, detail) values (p_business_id, 'Channel listing publish requested', 'channel_listing_draft', draft.id, draft.marketplace);
    receipt := jsonb_build_object('draft_id', draft.id);

  elsif p_action = 'confirm-external' then
    update public.channel_listing_drafts set external_listing_id=p_payload->>'externalListingId', external_url=p_payload->>'externalUrl', status='published', sync_state='clean', last_sync_at=now(), updated_at=now() where business_id=p_business_id and id=(p_payload->>'draftId')::uuid returning * into draft;
    update public.listings set status='active', sync_state='manual', external_url=p_payload->>'externalUrl' where id=draft.listing_id;
    update public.physical_sku_mappings set external_listing_id=p_payload->>'externalListingId', updated_at=now() where business_id=p_business_id and channel_listing_id=draft.listing_id;
    update public.listing_review_items set status='resolved', resolved_at=now() where business_id=p_business_id and channel_draft_id=draft.id and status='open';
    receipt := jsonb_build_object('draft_id', draft.id, 'external_id', p_payload->>'externalListingId');

  elsif p_action in ('sync-quantity','pause-draft','delist-draft','coordinate-sold','retry-sync') then
    select * into draft from public.channel_listing_drafts where business_id=p_business_id and id=(p_payload->>'draftId')::uuid for update;
    if draft.id is null then raise exception 'Draft not found'; end if;
    if p_action='sync-quantity' then
      update public.channel_listing_drafts set quantity=coalesce((p_payload->>'quantity')::integer, quantity), sync_state='pending', updated_at=now() where id=draft.id;
      insert into public.listing_sync_jobs (business_id, channel_draft_id, marketplace, action, status, idempotency_key) values (p_business_id, draft.id, draft.marketplace, 'sync_quantity', 'queued', p_idempotency_key);
    elsif p_action='pause-draft' or p_action='delist-draft' then
      update public.channel_listing_drafts set status=case when p_action='pause-draft' then 'paused' else 'delisted' end, sync_state=case when publish_mode='adapter' then 'pending' else 'manual' end, updated_at=now() where id=draft.id;
      insert into public.listing_sync_jobs (business_id, channel_draft_id, marketplace, action, status, idempotency_key) values (p_business_id, draft.id, draft.marketplace, case when p_action='pause-draft' then 'pause' else 'delist' end, case when draft.publish_mode='adapter' then 'queued' else 'manual_required' end, p_idempotency_key);
    elsif p_action='coordinate-sold' then
      update public.channel_listing_drafts set status='sold', quantity=0, sync_state='clean', updated_at=now() where id=draft.id;
      update public.channel_listing_drafts set status='delisted', quantity=0, sync_state=case when publish_mode='adapter' then 'pending' else 'manual' end, updated_at=now() where business_id=p_business_id and variant_id=draft.variant_id and id<>draft.id and status not in ('delisted','sold');
      insert into public.listing_review_items (business_id, channel_draft_id, marketplace, severity, reason, detail, action_label)
      select p_business_id, id, marketplace, 'critical', 'sold_coordination', 'Sibling listing must be delisted after sale.', 'Coordinate delist' from public.channel_listing_drafts where business_id=p_business_id and variant_id=draft.variant_id and id<>draft.id;
    else
      update public.channel_listing_drafts set sync_state='pending', status=case when status='failed' then 'queued' else status end, updated_at=now() where id=draft.id;
      update public.listing_sync_jobs set status='queued', attempts=0, error=null, updated_at=now() where business_id=p_business_id and channel_draft_id=draft.id and status in ('failed','dead_lettered');
    end if;
    insert into public.activity_events (business_id, action, entity_type, entity_id, detail) values (p_business_id, 'Listing action '||p_action, 'channel_listing_draft', draft.id, draft.marketplace);
    receipt := jsonb_build_object('draft_id', draft.id, 'action', p_action);
  else
    raise exception 'Unsupported listings action %', p_action;
  end if;

  insert into public.listings_mutation_receipts (business_id, idempotency_key, action, result) values (p_business_id, p_idempotency_key, p_action, receipt);
  return receipt;
end;
$$;
