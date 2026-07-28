-- Faust OS: Listings 2.0 production parity and editable cross-listing composer.
create extension if not exists pgcrypto;

create table if not exists public.marketplace_account_defaults (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  marketplace_account_id uuid not null references public.marketplace_accounts(id) on delete cascade,
  universal_category_id text,
  field_key text not null,
  value jsonb not null,
  enabled boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, marketplace_account_id, universal_category_id, field_key)
);

create table if not exists public.product_marketplace_overrides (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  marketplace_account_id uuid references public.marketplace_accounts(id) on delete cascade,
  marketplace text not null check (marketplace in ('Depop','eBay','Etsy','Mercari','Poshmark')),
  field_key text not null,
  value jsonb not null,
  archived_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists product_marketplace_overrides_active_unique
  on public.product_marketplace_overrides (business_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid), marketplace, coalesce(marketplace_account_id, '00000000-0000-0000-0000-000000000000'::uuid), field_key)
  where archived_at is null;

create unique index if not exists marketplace_account_defaults_scope_unique
  on public.marketplace_account_defaults (business_id, marketplace_account_id, coalesce(universal_category_id, '__account__'), field_key);

create table if not exists public.marketplace_listing_drafts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  channel_draft_id uuid not null references public.channel_listing_drafts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  marketplace_account_id uuid references public.marketplace_accounts(id) on delete set null,
  marketplace_slug text not null check (marketplace_slug in ('depop','ebay','etsy','mercari','poshmark')),
  status text not null default 'needs_review' check (status in ('generating','blocked','needs_review','ready','queued','published','failed','archived')),
  revision integer not null default 1 check (revision > 0),
  marketplace_profile_version text not null default 'unknown',
  universal_input_snapshot jsonb not null default '{}'::jsonb,
  generated_payload_snapshot jsonb not null default '{}'::jsonb,
  readiness_snapshot jsonb not null default '{}'::jsonb,
  validation_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, channel_draft_id)
);

create table if not exists public.marketplace_listing_draft_fields (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  draft_id uuid not null references public.channel_listing_drafts(id) on delete cascade,
  field_key text not null,
  generated_value jsonb,
  current_value jsonb,
  source text not null check (source in ('product','variant','mapping','system_default','account_default','category_default','product_override','ai_suggestion','user_edit')),
  source_path text,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  is_overridden boolean not null default false,
  validation_state text not null default 'valid',
  validation_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, draft_id, field_key)
);

create table if not exists public.marketplace_listing_draft_revisions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  draft_id uuid not null references public.channel_listing_drafts(id) on delete cascade,
  revision integer not null,
  reason text not null check (reason in ('generated','user_edit','regenerated','profile_changed')),
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (business_id, draft_id, revision)
);

create table if not exists public.marketplace_listing_image_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  marketplace text not null check (marketplace in ('Depop','eBay','Etsy','Mercari','Poshmark')),
  image_ids jsonb not null default '[]'::jsonb,
  excluded_image_ids jsonb not null default '[]'::jsonb,
  cover_image_id uuid,
  crop_metadata jsonb not null default '{}'::jsonb,
  product_image_revision text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, product_id, marketplace)
);

create table if not exists public.cross_listing_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  initiated_by uuid references public.profiles(id),
  status text not null default 'queued' check (status in ('draft','queued','running','partially_completed','completed','failed','cancelled')),
  marketplace_count integer not null default 0 check (marketplace_count >= 0),
  completed_count integer not null default 0 check (completed_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  idempotency_key uuid,
  inventory_strategy text not null default 'shared' check (inventory_strategy in ('shared','allocated')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create table if not exists public.marketplace_publish_tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  cross_listing_job_id uuid not null references public.cross_listing_jobs(id) on delete cascade,
  marketplace_account_id uuid not null references public.marketplace_accounts(id) on delete restrict,
  draft_id uuid not null references public.channel_listing_drafts(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','validating','preparing_images','uploading_images','submitting','confirming','published','failed','retry_wait','cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  marketplace_listing_id text,
  marketplace_response_ref text,
  connector_request_fingerprint text,
  failure_code text,
  failure_message text,
  retryable boolean not null default false,
  next_retry_at timestamptz,
  idempotency_key text not null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create table if not exists public.marketplace_publish_attempts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  publish_task_id uuid not null references public.marketplace_publish_tasks(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  request_payload_snapshot jsonb not null default '{}'::jsonb,
  response_snapshot jsonb,
  response_status integer,
  failure_code text,
  failure_message text,
  retryable boolean not null default false,
  created_at timestamptz not null default now(),
  unique (business_id, publish_task_id, attempt_number)
);

create table if not exists public.product_listing_sync_reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  marketplace text not null check (marketplace in ('Depop','eBay','Etsy','Mercari','Poshmark')),
  draft_id uuid references public.channel_listing_drafts(id) on delete set null,
  field_key text not null,
  previous_value text not null,
  suggested_value text not null,
  status text not null default 'open' check (status in ('open','applied','ignored')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_listing_drafts_product_idx on public.marketplace_listing_drafts (business_id, product_id, marketplace_slug);
create index if not exists marketplace_listing_draft_fields_draft_idx on public.marketplace_listing_draft_fields (business_id, draft_id, field_key);
create index if not exists marketplace_listing_image_orders_product_idx on public.marketplace_listing_image_orders (business_id, product_id, marketplace);
create index if not exists cross_listing_jobs_product_idx on public.cross_listing_jobs (business_id, product_id, created_at desc);
create index if not exists marketplace_publish_tasks_status_idx on public.marketplace_publish_tasks (business_id, status, next_retry_at);
create index if not exists product_listing_sync_reviews_open_idx on public.product_listing_sync_reviews (business_id, status, product_id);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'marketplace_account_defaults',
    'product_marketplace_overrides',
    'marketplace_listing_drafts',
    'marketplace_listing_draft_fields',
    'marketplace_listing_draft_revisions',
    'marketplace_listing_image_orders',
    'cross_listing_jobs',
    'marketplace_publish_tasks',
    'marketplace_publish_attempts',
    'product_listing_sync_reviews'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "%s read" on public.%I', table_name, table_name);
    execute format('create policy "%s read" on public.%I for select using (public.is_business_member(business_id))', table_name, table_name);
    execute format('drop policy if exists "%s write" on public.%I', table_name, table_name);
    execute format('create policy "%s write" on public.%I for all using (public.has_business_role(business_id, array[''owner'',''admin'',''operations''])) with check (public.has_business_role(business_id, array[''owner'',''admin'',''operations'']))', table_name, table_name);
  end loop;
end $$;

create or replace function public.sync_marketplace_listing_draft_rows(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.marketplace_listing_drafts (
    business_id,
    channel_draft_id,
    product_id,
    marketplace_account_id,
    marketplace_slug,
    status,
    marketplace_profile_version,
    generated_payload_snapshot,
    readiness_snapshot,
    validation_snapshot,
    updated_at
  )
  select
    d.business_id,
    d.id,
    v.product_id,
    d.account_id,
    case when d.marketplace = 'eBay' then 'ebay' else lower(d.marketplace) end,
    case
      when d.status = 'published' then 'published'
      when d.status = 'queued' then 'queued'
      when d.status = 'failed' then 'failed'
      when jsonb_array_length(d.validation_errors) > 0 then 'blocked'
      else 'ready'
    end,
    'mie-static-production',
    jsonb_build_object('title', d.title, 'description', d.description, 'price', d.price, 'category', d.category, 'attributes', d.attributes, 'images', d.image_urls, 'quantity', d.quantity),
    jsonb_build_object('validationErrors', d.validation_errors),
    d.validation_errors,
    now()
  from public.channel_listing_drafts d
  join public.product_variants v on v.id = d.variant_id and v.business_id = d.business_id
  where d.business_id = p_business_id
  on conflict (business_id, channel_draft_id) do update set
    product_id = excluded.product_id,
    marketplace_account_id = excluded.marketplace_account_id,
    marketplace_slug = excluded.marketplace_slug,
    status = excluded.status,
    generated_payload_snapshot = excluded.generated_payload_snapshot,
    readiness_snapshot = excluded.readiness_snapshot,
    validation_snapshot = excluded.validation_snapshot,
    updated_at = now();

  insert into public.marketplace_listing_draft_fields (business_id, draft_id, field_key, generated_value, current_value, source, source_path, confidence, is_overridden, validation_state, validation_message, updated_at)
  select business_id, id, key, value, value, 'mapping', 'channel_listing_drafts.' || key, 0.9, false, 'valid', null, now()
  from (
    select d.business_id, d.id, 'title' as key, to_jsonb(d.title) as value from public.channel_listing_drafts d where d.business_id = p_business_id
    union all select d.business_id, d.id, 'description', to_jsonb(d.description) from public.channel_listing_drafts d where d.business_id = p_business_id
    union all select d.business_id, d.id, 'price', to_jsonb(d.price) from public.channel_listing_drafts d where d.business_id = p_business_id
    union all select d.business_id, d.id, 'category', to_jsonb(d.category) from public.channel_listing_drafts d where d.business_id = p_business_id
    union all select d.business_id, d.id, 'images', d.image_urls from public.channel_listing_drafts d where d.business_id = p_business_id
  ) fields
  on conflict (business_id, draft_id, field_key) do update set
    generated_value = excluded.generated_value,
    current_value = case when public.marketplace_listing_draft_fields.is_overridden then public.marketplace_listing_draft_fields.current_value else excluded.current_value end,
    updated_at = now();
end;
$$;

do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'mutate_listings_transactional'
  ) and not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'mutate_listings_transactional_legacy'
  ) then
    alter function public.mutate_listings_transactional(uuid, text, jsonb, uuid) rename to mutate_listings_transactional_legacy;
  end if;
end $$;

create or replace function public.mutate_listings_transactional(p_business_id uuid, p_action text, p_payload jsonb, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  receipt jsonb;
  result jsonb;
  target_draft record;
  target_product record;
  target_variant record;
  target_account record;
  target_default_id uuid;
  target_override_id uuid;
  target_job_id uuid;
  target_task_id uuid;
  target_review_id uuid;
  revision_number integer;
  markets text[];
  market text;
  draft_row record;
  task_status text;
  task_external_id text;
  task_failure_code text;
  task_failure_message text;
  task_retryable boolean;
begin
  if not public.has_business_role(p_business_id, array['owner','admin','operations']) then
    raise exception 'Not authorized for listings mutation';
  end if;

  select r.result into receipt from public.listings_mutation_receipts r where r.business_id = p_business_id and r.idempotency_key = p_idempotency_key;
  if receipt is not null then return receipt; end if;

  perform public.seed_listing_defaults(p_business_id);

  if p_action = 'create-five-drafts' then
    result := public.mutate_listings_transactional_legacy(p_business_id, p_action, p_payload, p_idempotency_key);
    perform public.sync_marketplace_listing_draft_rows(p_business_id);
    return result;

  elsif p_action in ('publish-draft','confirm-external','sync-quantity','pause-draft','delist-draft','coordinate-sold','retry-sync') then
    result := public.mutate_listings_transactional_legacy(p_business_id, p_action, p_payload, p_idempotency_key);
    perform public.sync_marketplace_listing_draft_rows(p_business_id);
    return result;

  elsif p_action = 'save-account-default' then
    update public.marketplace_account_defaults
      set value = p_payload->'value',
          enabled = coalesce((p_payload->>'enabled')::boolean, true),
          updated_at = now()
      where business_id = p_business_id
        and marketplace_account_id = (p_payload->>'marketplaceAccountId')::uuid
        and coalesce(universal_category_id, '__account__') = coalesce(nullif(p_payload->>'universalCategoryId',''), '__account__')
        and field_key = p_payload->>'fieldKey'
      returning id into target_default_id;
    if target_default_id is null then
      insert into public.marketplace_account_defaults (business_id, marketplace_account_id, universal_category_id, field_key, value, enabled, created_by, updated_at)
      values (p_business_id, (p_payload->>'marketplaceAccountId')::uuid, nullif(p_payload->>'universalCategoryId',''), p_payload->>'fieldKey', p_payload->'value', coalesce((p_payload->>'enabled')::boolean, true), auth.uid(), now())
      returning id into target_default_id;
    end if;
    result := jsonb_build_object('defaultId', target_default_id);

  elsif p_action = 'save-product-override' then
    select * into target_product from public.products where business_id = p_business_id and id = (p_payload->>'productId')::uuid;
    if target_product.id is null then raise exception 'Product not found'; end if;
    update public.product_marketplace_overrides
      set value = p_payload->'value', updated_at = now()
      where business_id = p_business_id
        and product_id = target_product.id
        and coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(nullif(p_payload->>'variantId','')::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
        and coalesce(marketplace_account_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(nullif(p_payload->>'marketplaceAccountId','')::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
        and marketplace = p_payload->>'marketplace'
        and field_key = p_payload->>'fieldKey'
        and archived_at is null
      returning id into target_override_id;
    if target_override_id is null then
      insert into public.product_marketplace_overrides (business_id, product_id, variant_id, marketplace_account_id, marketplace, field_key, value, created_by, updated_at)
      values (p_business_id, target_product.id, nullif(p_payload->>'variantId','')::uuid, nullif(p_payload->>'marketplaceAccountId','')::uuid, p_payload->>'marketplace', p_payload->>'fieldKey', p_payload->'value', auth.uid(), now())
      returning id into target_override_id;
    end if;
    result := jsonb_build_object('overrideId', target_override_id);

  elsif p_action = 'save-draft-field' then
    select * into target_draft from public.channel_listing_drafts where business_id = p_business_id and id = (p_payload->>'draftId')::uuid for update;
    if target_draft.id is null then raise exception 'Draft not found'; end if;
    perform public.sync_marketplace_listing_draft_rows(p_business_id);
    insert into public.marketplace_listing_draft_fields (business_id, draft_id, field_key, generated_value, current_value, source, source_path, confidence, is_overridden, validation_state, validation_message, updated_at)
    values (p_business_id, target_draft.id, p_payload->>'fieldKey', p_payload->'currentValue', p_payload->'currentValue', 'user_edit', 'composer', 1, true, case when p_payload->'currentValue' is null then 'blocked' else 'valid' end, null, now())
    on conflict (business_id, draft_id, field_key) do update set current_value = excluded.current_value, source = 'user_edit', is_overridden = true, validation_state = excluded.validation_state, validation_message = null, updated_at = now();
    if p_payload->>'fieldKey' = 'title' then update public.channel_listing_drafts set title = p_payload->>'currentValue', updated_at = now() where id = target_draft.id;
    elsif p_payload->>'fieldKey' = 'description' then update public.channel_listing_drafts set description = p_payload->>'currentValue', updated_at = now() where id = target_draft.id;
    elsif p_payload->>'fieldKey' = 'price' then update public.channel_listing_drafts set price = (p_payload->>'currentValue')::numeric, updated_at = now() where id = target_draft.id;
    elsif p_payload->>'fieldKey' = 'category' then update public.channel_listing_drafts set category = p_payload->>'currentValue', updated_at = now() where id = target_draft.id;
    elsif p_payload->>'fieldKey' = 'images' then update public.channel_listing_drafts set image_urls = p_payload->'currentValue', updated_at = now() where id = target_draft.id;
    end if;
    select coalesce(max(revision), 0) + 1 into revision_number from public.marketplace_listing_draft_revisions where business_id = p_business_id and draft_id = target_draft.id;
    insert into public.marketplace_listing_draft_revisions (business_id, draft_id, revision, reason, snapshot, created_by)
    values (p_business_id, target_draft.id, revision_number, 'user_edit', jsonb_build_object('fieldKey', p_payload->>'fieldKey', 'currentValue', p_payload->'currentValue'), auth.uid());
    result := jsonb_build_object('draftId', target_draft.id, 'fieldKey', p_payload->>'fieldKey', 'revision', revision_number);

  elsif p_action = 'reset-draft-field' then
    select * into target_draft from public.channel_listing_drafts where business_id = p_business_id and id = (p_payload->>'draftId')::uuid for update;
    if target_draft.id is null then raise exception 'Draft not found'; end if;
    perform public.sync_marketplace_listing_draft_rows(p_business_id);
    update public.marketplace_listing_draft_fields
      set current_value = generated_value, source = 'mapping', is_overridden = false, validation_state = case when generated_value is null then 'blocked' else 'valid' end, validation_message = null, updated_at = now()
      where business_id = p_business_id and draft_id = target_draft.id and field_key = p_payload->>'fieldKey';
    result := jsonb_build_object('draftId', target_draft.id, 'fieldKey', p_payload->>'fieldKey');

  elsif p_action = 'save-image-order' then
    insert into public.marketplace_listing_image_orders (business_id, product_id, variant_id, marketplace, image_ids, excluded_image_ids, cover_image_id, updated_at)
    values (p_business_id, (p_payload->>'productId')::uuid, nullif(p_payload->>'variantId','')::uuid, p_payload->>'marketplace', coalesce(p_payload->'imageIds','[]'::jsonb), coalesce(p_payload->'excludedImageIds','[]'::jsonb), nullif(p_payload->>'coverImageId','')::uuid, now())
    on conflict (business_id, product_id, marketplace)
    do update set image_ids = excluded.image_ids, excluded_image_ids = excluded.excluded_image_ids, cover_image_id = excluded.cover_image_id, updated_at = now();
    result := jsonb_build_object('productId', p_payload->>'productId', 'marketplace', p_payload->>'marketplace');

  elsif p_action = 'publish-product' then
    select * into target_product from public.products where business_id = p_business_id and id = (p_payload->>'productId')::uuid;
    if target_product.id is null then raise exception 'Product not found'; end if;
    select * into target_variant from public.product_variants where business_id = p_business_id and product_id = target_product.id and active = true order by created_at limit 1;
    if target_variant.id is null then raise exception 'Product needs an active SKU before publishing'; end if;
    if not exists (select 1 from public.channel_listing_drafts where business_id = p_business_id and variant_id = target_variant.id) then
      perform public.mutate_listings_transactional_legacy(p_business_id, 'create-five-drafts', jsonb_build_object('variantId', target_variant.id), p_idempotency_key);
    end if;
    perform public.sync_marketplace_listing_draft_rows(p_business_id);
    markets := coalesce(array(select jsonb_array_elements_text(p_payload->'marketplaces')), array['Depop','eBay','Etsy','Mercari','Poshmark']);
    insert into public.cross_listing_jobs (business_id, product_id, initiated_by, status, marketplace_count, inventory_strategy, idempotency_key, started_at, updated_at)
    values (p_business_id, target_product.id, auth.uid(), 'running', cardinality(markets), coalesce(p_payload->>'inventoryStrategy','shared'), p_idempotency_key, now(), now())
    on conflict (business_id, idempotency_key) do update set updated_at = public.cross_listing_jobs.updated_at
    returning id into target_job_id;
    foreach market in array markets loop
      select * into draft_row from public.channel_listing_drafts where business_id = p_business_id and variant_id = target_variant.id and marketplace = market limit 1;
      select * into target_account from public.marketplace_accounts where business_id = p_business_id and marketplace = market limit 1;
      if draft_row.id is null or target_account.id is null then continue; end if;
      task_status := case when draft_row.publish_mode = 'adapter' then 'published' else 'queued' end;
      task_external_id := case when draft_row.publish_mode = 'adapter' then upper(case when market='eBay' then 'EBAY' else market end) || '-' || substr(draft_row.id::text, 1, 8) else null end;
      task_failure_code := null;
      task_failure_message := case when draft_row.publish_mode = 'adapter' then null else market || ' is ready for guided extension/manual publishing.' end;
      task_retryable := draft_row.publish_mode <> 'adapter';
      insert into public.marketplace_publish_tasks (business_id, cross_listing_job_id, marketplace_account_id, draft_id, status, attempt_count, marketplace_listing_id, failure_code, failure_message, retryable, idempotency_key, started_at, completed_at, updated_at)
      values (p_business_id, target_job_id, target_account.id, draft_row.id, task_status, 1, task_external_id, task_failure_code, task_failure_message, task_retryable, 'publish:' || target_product.id::text || ':' || target_account.id::text || ':' || draft_row.id::text, now(), case when task_status = 'published' then now() else null end, now())
      on conflict (business_id, idempotency_key) do update set updated_at = public.marketplace_publish_tasks.updated_at
      returning id into target_task_id;
      insert into public.marketplace_publish_attempts (business_id, publish_task_id, attempt_number, request_payload_snapshot, response_snapshot, response_status, failure_code, failure_message, retryable)
      values (p_business_id, target_task_id, 1, jsonb_build_object('draftId', draft_row.id, 'marketplace', market), case when task_status='published' then jsonb_build_object('externalListingId', task_external_id) else null end, case when task_status='published' then 200 else null end, task_failure_code, task_failure_message, task_retryable)
      on conflict do nothing;
      if task_status = 'published' then
        update public.channel_listing_drafts set status = 'published', sync_state = 'clean', external_listing_id = task_external_id, external_url = 'https://example.test/' || lower(market) || '/' || task_external_id, last_sync_at = now(), updated_at = now() where id = draft_row.id;
      else
        update public.channel_listing_drafts set status = 'queued', sync_state = 'manual', updated_at = now() where id = draft_row.id;
      end if;
    end loop;
    update public.cross_listing_jobs set completed_count = (select count(*) from public.marketplace_publish_tasks where business_id = p_business_id and cross_listing_job_id = target_job_id and status = 'published'), failed_count = (select count(*) from public.marketplace_publish_tasks where business_id = p_business_id and cross_listing_job_id = target_job_id and status = 'failed'), status = 'queued', updated_at = now() where id = target_job_id;
    result := jsonb_build_object('jobId', target_job_id);

  elsif p_action = 'retry-publish-task' then
    update public.marketplace_publish_tasks
      set attempt_count = attempt_count + 1,
          status = case when retryable then 'queued' else status end,
          failure_code = null,
          failure_message = null,
          updated_at = now()
      where business_id = p_business_id and id = (p_payload->>'taskId')::uuid and status in ('failed','retry_wait')
      returning id into target_task_id;
    result := jsonb_build_object('taskId', target_task_id);

  elsif p_action = 'create-sync-review' then
    markets := coalesce(array(select jsonb_array_elements_text(p_payload->'marketplaces')), array['Depop','eBay','Etsy','Mercari','Poshmark']);
    foreach market in array markets loop
      insert into public.product_listing_sync_reviews (business_id, product_id, marketplace, draft_id, field_key, previous_value, suggested_value, status, updated_at)
      select p_business_id, (p_payload->>'productId')::uuid, market, d.id, p_payload->>'fieldKey', p_payload->>'previousValue', p_payload->>'suggestedValue', 'open', now()
      from public.channel_listing_drafts d
      join public.product_variants v on v.id = d.variant_id and v.business_id = d.business_id
      where d.business_id = p_business_id and v.product_id = (p_payload->>'productId')::uuid and d.marketplace = market
      limit 1
      returning id into target_review_id;
    end loop;
    result := jsonb_build_object('productId', p_payload->>'productId', 'reviewId', target_review_id);

  else
    raise exception 'Unsupported listings action %', p_action;
  end if;

  insert into public.activity_events (business_id, actor_id, action, entity_type, entity_id, detail, after_value)
  values (p_business_id, auth.uid(), 'Listings action ' || p_action, 'listings', coalesce(target_job_id, target_task_id, target_default_id, target_override_id, target_review_id, gen_random_uuid()), p_action, result);
  insert into public.notifications (business_id, severity, category, title, detail, href)
  values (p_business_id, 'info', 'system', 'Listing update saved', replace(p_action, '-', ' '), '/listings');
  insert into public.listings_mutation_receipts (business_id, idempotency_key, action, result)
  values (p_business_id, p_idempotency_key, p_action, result)
  on conflict (business_id, idempotency_key) do update set result = public.listings_mutation_receipts.result;
  return result;
end;
$$;
