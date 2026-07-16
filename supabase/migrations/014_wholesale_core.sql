-- Faust OS: wholesale accounting core for lots, landed cost, FIFO, journal, jobs, and channel risk.
create extension if not exists pgcrypto;

create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  base_currency text not null check (base_currency in ('RMB')),
  quote_currency text not null check (quote_currency in ('USD')),
  rate numeric not null check (rate > 0),
  effective_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual','provider','invoice')),
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_purchase_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid references public.suppliers(id),
  purchase_order_id uuid references public.purchase_orders(id),
  reference text not null,
  currency text not null check (currency in ('USD','RMB')),
  exchange_rate_id uuid references public.exchange_rates(id),
  status text not null default 'costed' check (status in ('draft','received','costed','closed','cancelled')),
  item_count integer not null default 0 check (item_count >= 0),
  subtotal_original numeric not null default 0 check (subtotal_original >= 0),
  subtotal_usd numeric not null default 0 check (subtotal_usd >= 0),
  landed_cost_usd numeric not null default 0 check (landed_cost_usd >= 0),
  total_cost_usd numeric not null default 0 check (total_cost_usd >= 0),
  received_at timestamptz not null default now(),
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create table if not exists public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  batch_id uuid references public.inventory_purchase_batches(id),
  variant_id uuid not null references public.product_variants(id),
  sku text not null,
  physical_sku text,
  quantity_received integer not null check (quantity_received >= 0),
  quantity_remaining integer not null check (quantity_remaining >= 0),
  quantity_reserved integer not null default 0 check (quantity_reserved >= 0),
  unit_product_cost_usd numeric not null default 0 check (unit_product_cost_usd >= 0),
  unit_landed_cost_usd numeric not null default 0 check (unit_landed_cost_usd >= 0),
  total_landed_cost_usd numeric not null default 0 check (total_landed_cost_usd >= 0),
  currency text not null check (currency in ('USD','RMB')),
  original_unit_cost numeric not null default 0 check (original_unit_cost >= 0),
  exchange_rate numeric not null default 1 check (exchange_rate > 0),
  location_id uuid references public.inventory_locations(id),
  condition text not null default 'available' check (condition in ('available','returned_goods','damaged','quarantine')),
  source_type text not null check (source_type in ('purchase_batch','return','adjustment')),
  source_id uuid,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity_reserved <= quantity_remaining)
);

create table if not exists public.landed_cost_components (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  batch_id uuid not null references public.inventory_purchase_batches(id) on delete cascade,
  component_type text not null check (component_type in ('product','domestic_shipping','international_freight','duty','tax','agent_fee','inspection','packaging','other')),
  description text not null,
  amount_original numeric not null check (amount_original >= 0),
  currency text not null check (currency in ('USD','RMB')),
  amount_usd numeric not null check (amount_usd >= 0),
  allocation_method text not null check (allocation_method in ('by_quantity','by_value','by_weight','manual')),
  linked_object_type text,
  linked_object_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.order_item_cost_allocations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id),
  lot_id uuid not null references public.inventory_lots(id),
  quantity integer not null check (quantity > 0),
  unit_cost_usd numeric not null check (unit_cost_usd >= 0),
  total_cost_usd numeric not null check (total_cost_usd >= 0),
  method text not null default 'fifo' check (method in ('fifo','manual')),
  return_id uuid,
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key, lot_id)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  entry_number text not null,
  status text not null default 'posted' check (status in ('posted','voided')),
  source_type text not null,
  source_id uuid not null,
  description text not null,
  total_debit numeric not null check (total_debit >= 0),
  total_credit numeric not null check (total_credit >= 0),
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  posted_at timestamptz not null default now(),
  unique (business_id, entry_number),
  unique (business_id, idempotency_key),
  check (total_debit = total_credit)
);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_code text not null,
  account_name text not null,
  debit numeric not null default 0 check (debit >= 0),
  credit numeric not null default 0 check (credit >= 0),
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now(),
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);

create table if not exists public.transactional_outbox_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  topic text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','published','failed','dead_lettered')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz,
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, topic, idempotency_key)
);

create table if not exists public.durable_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  queue text not null check (queue in ('channel_sync','ledger_posting','inventory_risk','marketplace_publish')),
  event_id uuid references public.transactional_outbox_events(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','dead_lettered')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  payload jsonb not null default '{}'::jsonb,
  last_error text,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dead_letter_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  source_type text not null check (source_type in ('outbox_event','durable_job')),
  source_id uuid not null,
  reason text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.physical_sku_mappings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id),
  physical_sku text not null,
  channel_listing_id uuid references public.listings(id),
  channel text,
  external_sku text,
  external_listing_id text,
  status text not null default 'active' check (status in ('active','needs_review','archived')),
  confidence numeric not null default 1 check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (business_id, variant_id, channel_listing_id)
);

create table if not exists public.channel_inventory_sync_states (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  channel text not null,
  listing_id uuid not null references public.listings(id),
  variant_id uuid not null references public.product_variants(id),
  physical_sku text,
  desired_quantity integer not null default 0 check (desired_quantity >= 0),
  last_synced_quantity integer,
  status text not null default 'pending' check (status in ('clean','pending','blocked','error')),
  risk text not null default 'none' check (risk in ('none','oversell','stale','unmapped')),
  last_sync_at timestamptz,
  next_sync_at timestamptz,
  error text,
  updated_at timestamptz not null default now(),
  unique (business_id, listing_id)
);

create table if not exists public.inventory_risk_locks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id),
  listing_id uuid references public.listings(id),
  channel text,
  reason text not null check (reason in ('oversell_risk','unmapped_sku','stale_sync','manual_hold')),
  status text not null default 'active' check (status in ('active','released')),
  locked_quantity integer not null default 0 check (locked_quantity >= 0),
  created_at timestamptz not null default now(),
  released_at timestamptz,
  notes text
);

create table if not exists public.wholesale_mutation_receipts (
  business_id uuid not null references public.businesses(id) on delete cascade,
  idempotency_key uuid not null,
  action text not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (business_id, idempotency_key)
);

create index if not exists inventory_lots_fifo_idx on public.inventory_lots (business_id, variant_id, condition, received_at);
create index if not exists order_item_cost_allocations_order_idx on public.order_item_cost_allocations (business_id, order_id, order_item_id);
create index if not exists journal_lines_entry_idx on public.journal_lines (business_id, journal_entry_id);
create index if not exists outbox_status_idx on public.transactional_outbox_events (business_id, status, next_attempt_at);
create index if not exists durable_jobs_status_idx on public.durable_jobs (business_id, status, run_after);
create index if not exists channel_sync_listing_idx on public.channel_inventory_sync_states (business_id, listing_id);
create index if not exists risk_locks_active_idx on public.inventory_risk_locks (business_id, status, variant_id);

do $$
declare table_name text;
begin
  foreach table_name in array array['exchange_rates','inventory_purchase_batches','inventory_lots','landed_cost_components','order_item_cost_allocations','journal_entries','journal_lines','transactional_outbox_events','durable_jobs','dead_letter_events','physical_sku_mappings','channel_inventory_sync_states','inventory_risk_locks','wholesale_mutation_receipts'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "%s read" on public.%I', table_name, table_name);
    execute format('create policy "%s read" on public.%I for select using (public.is_business_member(business_id))', table_name, table_name);
    execute format('drop policy if exists "%s write" on public.%I', table_name, table_name);
    execute format('create policy "%s write" on public.%I for all using (public.has_business_role(business_id, array[''owner'',''admin'',''operations'',''finance''])) with check (public.has_business_role(business_id, array[''owner'',''admin'',''operations'',''finance'']))', table_name, table_name);
  end loop;
end $$;

create or replace function public.mutate_wholesale_core_transactional(p_business_id uuid, p_action text, p_payload jsonb, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  receipt jsonb;
  batch_id uuid;
  rate_id uuid;
  rate numeric := 1;
  item jsonb;
  cost jsonb;
  lot_id uuid;
  entry_id uuid;
  line_total numeric := 0;
  remaining integer;
  take_qty integer;
  lot record;
  order_item record;
  listing record;
  usable integer;
  risk text;
  event_id uuid;
begin
  if not public.has_business_role(p_business_id, array['owner','admin','operations','finance']) then
    raise exception 'Not authorized for wholesale core mutation';
  end if;

  select result into receipt from public.wholesale_mutation_receipts where business_id = p_business_id and idempotency_key = p_idempotency_key;
  if receipt is not null then return receipt; end if;

  if p_action = 'receive-batch' then
    if coalesce(jsonb_array_length(p_payload->'items'), 0) = 0 then raise exception 'A wholesale batch needs items'; end if;
    if p_payload->>'currency' = 'RMB' then
      rate := coalesce(nullif((p_payload->>'rmbUsdRate')::numeric, 0), 0);
      if rate <= 0 then raise exception 'RMB/USD exchange rate required'; end if;
      insert into public.exchange_rates (business_id, base_currency, quote_currency, rate, source)
      values (p_business_id, 'RMB', 'USD', rate, 'manual') returning id into rate_id;
    end if;

    select coalesce(sum((value->>'quantity')::integer * (value->>'unitCost')::numeric * rate), 0) into line_total from jsonb_array_elements(p_payload->'items');
    batch_id := gen_random_uuid();
    insert into public.inventory_purchase_batches (id, business_id, supplier_id, purchase_order_id, reference, currency, exchange_rate_id, status, item_count, subtotal_original, subtotal_usd, landed_cost_usd, total_cost_usd, idempotency_key)
    values (batch_id, p_business_id, nullif(p_payload->>'supplierId','')::uuid, nullif(p_payload->>'purchaseOrderId','')::uuid, p_payload->>'reference', p_payload->>'currency', rate_id, 'costed',
      (select sum((value->>'quantity')::integer) from jsonb_array_elements(p_payload->'items')),
      (select sum((value->>'quantity')::integer * (value->>'unitCost')::numeric) from jsonb_array_elements(p_payload->'items')),
      line_total,
      (select coalesce(sum(case when value->>'currency' = 'RMB' then (value->>'amount')::numeric * rate else (value->>'amount')::numeric end),0) from jsonb_array_elements(coalesce(p_payload->'landedCosts','[]'::jsonb))),
      line_total + (select coalesce(sum(case when value->>'currency' = 'RMB' then (value->>'amount')::numeric * rate else (value->>'amount')::numeric end),0) from jsonb_array_elements(coalesce(p_payload->'landedCosts','[]'::jsonb))),
      p_idempotency_key);

    for cost in select * from jsonb_array_elements(coalesce(p_payload->'landedCosts','[]'::jsonb)) loop
      insert into public.landed_cost_components (business_id, batch_id, component_type, description, amount_original, currency, amount_usd, allocation_method)
      values (p_business_id, batch_id, cost->>'type', cost->>'description', (cost->>'amount')::numeric, cost->>'currency', case when cost->>'currency' = 'RMB' then (cost->>'amount')::numeric * rate else (cost->>'amount')::numeric end, cost->>'allocationMethod');
    end loop;

    for item in select * from jsonb_array_elements(p_payload->'items') loop
      lot_id := gen_random_uuid();
      insert into public.inventory_lots (id, business_id, batch_id, variant_id, sku, physical_sku, quantity_received, quantity_remaining, unit_product_cost_usd, unit_landed_cost_usd, total_landed_cost_usd, currency, original_unit_cost, exchange_rate, location_id, condition, source_type, source_id)
      select lot_id, p_business_id, batch_id, v.id, v.sku, coalesce(item->>'physicalSku', v.sku), (item->>'quantity')::integer, (item->>'quantity')::integer, (item->>'unitCost')::numeric * rate,
        (item->>'unitCost')::numeric * rate, (item->>'quantity')::integer * (item->>'unitCost')::numeric * rate, p_payload->>'currency', (item->>'unitCost')::numeric, rate, nullif(item->>'locationId','')::uuid, 'available', 'purchase_batch', batch_id
      from public.product_variants v where v.business_id = p_business_id and v.id = (item->>'variantId')::uuid;
      if not found then raise exception 'Variant not found for wholesale lot'; end if;
    end loop;

    entry_id := gen_random_uuid();
    insert into public.journal_entries (id, business_id, entry_number, source_type, source_id, description, total_debit, total_credit, idempotency_key)
    select entry_id, p_business_id, 'JE-' || substr(entry_id::text, 1, 8), 'purchase_batch', batch_id, 'Wholesale purchase batch ' || (p_payload->>'reference'), total_cost_usd, total_cost_usd, p_idempotency_key
    from public.inventory_purchase_batches where id = batch_id;
    insert into public.journal_lines (business_id, journal_entry_id, account_code, account_name, debit, credit, source_type, source_id)
    select p_business_id, entry_id, '1400','Inventory asset', total_cost_usd,0,'purchase_batch',batch_id from public.inventory_purchase_batches where id=batch_id
    union all select p_business_id, entry_id, '2000','Accounts payable',0,total_cost_usd,'purchase_batch',batch_id from public.inventory_purchase_batches where id=batch_id;

    insert into public.transactional_outbox_events (business_id, topic, aggregate_type, aggregate_id, payload, idempotency_key) values (p_business_id, 'inventory.lot.received', 'purchase_batch', batch_id, jsonb_build_object('batchId', batch_id), p_idempotency_key) returning id into event_id;
    insert into public.durable_jobs (business_id, queue, event_id, payload) values (p_business_id, 'inventory_risk', event_id, jsonb_build_object('batchId', batch_id));
    insert into public.activity_events (business_id, action, entity_type, entity_id, detail) values (p_business_id, 'Wholesale batch received', 'purchase_batch', batch_id, p_payload->>'reference');
    receipt := jsonb_build_object('batch_id', batch_id, 'journal_entry_id', entry_id, 'outbox_event_id', event_id);

  elsif p_action = 'allocate-fifo' then
    select * into order_item from public.order_items where business_id = p_business_id and id = (p_payload->>'orderItemId')::uuid for update;
    if order_item.id is null then raise exception 'Order item not found'; end if;
    remaining := coalesce((p_payload->>'quantity')::integer, order_item.quantity);
    for lot in select * from public.inventory_lots where business_id = p_business_id and variant_id = order_item.variant_id and condition = 'available' and quantity_remaining - quantity_reserved > 0 order by received_at for update loop
      exit when remaining <= 0;
      take_qty := least(remaining, lot.quantity_remaining - lot.quantity_reserved);
      update public.inventory_lots set quantity_remaining = quantity_remaining - take_qty, updated_at = now() where id = lot.id;
      insert into public.order_item_cost_allocations (business_id, order_id, order_item_id, variant_id, lot_id, quantity, unit_cost_usd, total_cost_usd, method, idempotency_key)
      values (p_business_id, order_item.order_id, order_item.id, order_item.variant_id, lot.id, take_qty, lot.unit_landed_cost_usd, take_qty * lot.unit_landed_cost_usd, 'fifo', p_idempotency_key);
      remaining := remaining - take_qty;
    end loop;
    if remaining > 0 then raise exception 'Insufficient FIFO lot quantity'; end if;
    select sum(total_cost_usd) into line_total from public.order_item_cost_allocations where business_id = p_business_id and idempotency_key = p_idempotency_key;
    entry_id := gen_random_uuid();
    insert into public.journal_entries (id, business_id, entry_number, source_type, source_id, description, total_debit, total_credit, idempotency_key) values (entry_id, p_business_id, 'JE-' || substr(entry_id::text,1,8), 'order_item_allocation', order_item.id, 'FIFO COGS allocation', line_total, line_total, p_idempotency_key);
    insert into public.journal_lines (business_id, journal_entry_id, account_code, account_name, debit, credit, source_type, source_id) values (p_business_id, entry_id, '5000','Cost of goods sold', line_total,0,'order_item',order_item.id), (p_business_id, entry_id, '1400','Inventory asset',0,line_total,'order_item',order_item.id);
    insert into public.transactional_outbox_events (business_id, topic, aggregate_type, aggregate_id, payload, idempotency_key) values (p_business_id, 'inventory.fifo.allocated', 'order_item', order_item.id, jsonb_build_object('orderItemId', order_item.id), p_idempotency_key) returning id into event_id;
    insert into public.durable_jobs (business_id, queue, event_id, payload) values (p_business_id, 'ledger_posting', event_id, jsonb_build_object('orderItemId', order_item.id));
    insert into public.activity_events (business_id, action, entity_type, entity_id, detail) values (p_business_id, 'FIFO lot allocated', 'order_item', order_item.id, line_total::text);
    receipt := jsonb_build_object('order_item_id', order_item.id, 'cost', line_total);

  elsif p_action = 'receive-return' then
    insert into public.transactional_outbox_events (business_id, topic, aggregate_type, aggregate_id, payload, idempotency_key) values (p_business_id, 'inventory.return.received', 'return', (p_payload->>'returnId')::uuid, p_payload, p_idempotency_key) returning id into event_id;
    insert into public.durable_jobs (business_id, queue, event_id, payload) values (p_business_id, 'inventory_risk', event_id, p_payload);
    insert into public.activity_events (business_id, action, entity_type, entity_id, detail) values (p_business_id, 'Wholesale return received', 'return', (p_payload->>'returnId')::uuid, p_payload->>'mode');
    receipt := jsonb_build_object('return_id', p_payload->>'returnId');

  elsif p_action = 'sync-channel-risk' then
    select * into listing from public.listings where business_id = p_business_id and id = (p_payload->>'listingId')::uuid;
    if listing.id is null then raise exception 'Listing not found'; end if;
    insert into public.physical_sku_mappings (business_id, variant_id, physical_sku, channel_listing_id, channel, external_sku, external_listing_id, confidence)
    values (p_business_id, (p_payload->>'variantId')::uuid, p_payload->>'physicalSku', listing.id, listing.marketplace, p_payload->>'physicalSku', listing.external_url, 0.95)
    on conflict (business_id, variant_id, channel_listing_id) do update set physical_sku = excluded.physical_sku, updated_at = now();
    select coalesce(sum(quantity_remaining - quantity_reserved),0) into usable from public.inventory_lots where business_id = p_business_id and variant_id = (p_payload->>'variantId')::uuid and condition = 'available';
    risk := case when usable < (p_payload->>'desiredQuantity')::integer then 'oversell' else 'none' end;
    insert into public.channel_inventory_sync_states (business_id, channel, listing_id, variant_id, physical_sku, desired_quantity, last_synced_quantity, status, risk, next_sync_at)
    values (p_business_id, listing.marketplace, listing.id, (p_payload->>'variantId')::uuid, p_payload->>'physicalSku', (p_payload->>'desiredQuantity')::integer, case when risk='none' then (p_payload->>'desiredQuantity')::integer else null end, case when risk='none' then 'pending' else 'blocked' end, risk, now())
    on conflict (business_id, listing_id) do update set desired_quantity = excluded.desired_quantity, status = excluded.status, risk = excluded.risk, updated_at = now();
    if risk <> 'none' then
      insert into public.inventory_risk_locks (business_id, variant_id, listing_id, channel, reason, locked_quantity, notes) values (p_business_id, (p_payload->>'variantId')::uuid, listing.id, listing.marketplace, 'oversell_risk', greatest((p_payload->>'desiredQuantity')::integer - usable, 0), 'Wholesale sync blocked by FIFO lot availability.');
    end if;
    insert into public.transactional_outbox_events (business_id, topic, aggregate_type, aggregate_id, payload, idempotency_key) values (p_business_id, 'channel.inventory.sync_requested', 'listing', listing.id, p_payload || jsonb_build_object('risk', risk), p_idempotency_key) returning id into event_id;
    insert into public.durable_jobs (business_id, queue, event_id, payload) values (p_business_id, 'channel_sync', event_id, p_payload);
    insert into public.activity_events (business_id, action, entity_type, entity_id, detail) values (p_business_id, 'Channel inventory sync assessed', 'listing', listing.id, risk);
    receipt := jsonb_build_object('listing_id', listing.id, 'risk', risk);

  elsif p_action = 'process-outbox' then
    update public.transactional_outbox_events set attempts = attempts + 1, status = case when id::text = coalesce(p_payload->>'failEventId','') or attempts + 1 >= coalesce((p_payload->>'maxAttempts')::integer,3) then 'dead_lettered' else 'published' end, updated_at = now() where business_id = p_business_id and status in ('pending','failed');
    update public.durable_jobs set attempts = attempts + 1, status = case when attempts + 1 >= coalesce((p_payload->>'maxAttempts')::integer,3) then 'dead_lettered' else 'succeeded' end, updated_at = now() where business_id = p_business_id and status in ('queued','failed');
    insert into public.activity_events (business_id, action, entity_type, entity_id, detail) values (p_business_id, 'Wholesale outbox processed', 'outbox', p_business_id, 'Outbox processed.');
    receipt := jsonb_build_object('processed', true);
  else
    raise exception 'Unsupported wholesale core action %', p_action;
  end if;

  insert into public.wholesale_mutation_receipts (business_id, idempotency_key, action, result) values (p_business_id, p_idempotency_key, p_action, receipt);
  return receipt;
end;
$$;
