-- Faust OS: Purchasing & Suppliers completion for 1688 purchasing, receiving, claims, and reorder planning.
create extension if not exists pgcrypto;

create table if not exists public.supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  name text not null,
  role text,
  channel text not null check (channel in ('1688','wechat','email','whatsapp','phone','other')),
  handle text,
  preferred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.supplier_communications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  contact_id uuid references public.supplier_contacts(id),
  purchase_order_id uuid references public.purchase_orders(id),
  channel text not null,
  direction text not null check (direction in ('inbound','outbound','internal_note')),
  subject text not null,
  body text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_scorecards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  quality_score numeric not null default 0,
  lead_time_score numeric not null default 0,
  communication_score numeric not null default 0,
  price_score numeric not null default 0,
  defect_rate numeric not null default 0,
  on_time_rate numeric not null default 0,
  average_lead_days numeric not null default 0,
  total_spend_usd numeric not null default 0,
  claim_count integer not null default 0,
  last_reviewed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, supplier_id)
);

create table if not exists public.purchase_approvals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  status text not null check (status in ('requested','approved','rejected')),
  requested_by uuid,
  approved_by uuid,
  reason text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists public.purchase_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  payment_type text not null check (payment_type in ('deposit','final','freight','duty','customs','refund')),
  currency text not null check (currency in ('USD','RMB')),
  amount_original numeric not null check (amount_original > 0),
  exchange_rate numeric not null check (exchange_rate > 0),
  amount_usd numeric not null check (amount_usd >= 0),
  status text not null default 'paid' check (status in ('planned','paid','refunded')),
  paid_at timestamptz,
  transaction_id uuid references public.transactions(id),
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create table if not exists public.freight_consolidations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid references public.suppliers(id),
  parcel_ids jsonb not null default '[]'::jsonb,
  status text not null default 'planning' check (status in ('planning','consolidated','shipped','received')),
  domestic_freight_usd numeric not null default 0,
  international_freight_usd numeric not null default 0,
  duties_usd numeric not null default 0,
  customs_usd numeric not null default 0,
  allocation_method text not null default 'by_value',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.receiving_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  parcel_id uuid references public.inbound_parcels(id),
  status text not null check (status in ('draft','partial','completed','issue')),
  received_at timestamptz not null default now(),
  rows jsonb not null default '[]'::jsonb,
  claim_id uuid,
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (business_id, idempotency_key)
);

create table if not exists public.supplier_claims (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  purchase_order_id uuid references public.purchase_orders(id),
  receiving_session_id uuid references public.receiving_sessions(id),
  claim_type text not null check (claim_type in ('shortage','overage','damaged','quality','late')),
  status text not null default 'open' check (status in ('open','submitted','approved','rejected','credited','closed')),
  quantity integer,
  amount_usd numeric,
  detail text not null,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  activity jsonb not null default '[]'::jsonb
);

create table if not exists public.supplier_price_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id),
  currency text not null check (currency in ('USD','RMB')),
  unit_cost_original numeric not null,
  exchange_rate numeric not null,
  unit_cost_usd numeric not null,
  minimum_order_quantity integer,
  captured_at timestamptz not null default now(),
  source_url text
);

create table if not exists public.reorder_recommendations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id),
  supplier_id uuid references public.suppliers(id),
  recommended_quantity integer not null,
  reorder_point integer not null,
  safety_stock integer not null,
  available integer not null,
  incoming integer not null,
  velocity_30d numeric not null default 0,
  estimated_cost_usd numeric not null default 0,
  status text not null default 'open' check (status in ('open','approved','converted','dismissed')),
  purchase_order_id uuid references public.purchase_orders(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.purchasing_mutation_receipts (
  business_id uuid not null references public.businesses(id) on delete cascade,
  idempotency_key uuid not null,
  action text not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (business_id, idempotency_key)
);

create index if not exists supplier_scorecards_supplier_idx on public.supplier_scorecards (business_id, supplier_id);
create index if not exists purchase_payments_po_idx on public.purchase_payments (business_id, purchase_order_id);
create index if not exists receiving_sessions_po_idx on public.receiving_sessions (business_id, purchase_order_id);
create index if not exists supplier_claims_status_idx on public.supplier_claims (business_id, status, supplier_id);
create index if not exists reorder_recommendations_status_idx on public.reorder_recommendations (business_id, status, variant_id);

do $$
declare table_name text;
begin
  foreach table_name in array array['supplier_contacts','supplier_communications','supplier_scorecards','purchase_approvals','purchase_payments','freight_consolidations','receiving_sessions','supplier_claims','supplier_price_history','reorder_recommendations','purchasing_mutation_receipts'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "%s read" on public.%I', table_name, table_name);
    execute format('create policy "%s read" on public.%I for select using (public.is_business_member(business_id))', table_name, table_name);
    execute format('drop policy if exists "%s write" on public.%I', table_name, table_name);
    execute format('create policy "%s write" on public.%I for all using (public.has_business_role(business_id, array[''owner'',''admin'',''operations'',''finance''])) with check (public.has_business_role(business_id, array[''owner'',''admin'',''operations'',''finance'']))', table_name, table_name);
  end loop;
end $$;

create or replace function public.mutate_purchasing_transactional(p_business_id uuid, p_action text, p_payload jsonb, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  receipt jsonb;
  supplier_row record;
  po_id uuid;
  po_item jsonb;
  po_item_id uuid;
  total_usd numeric := 0;
  payment_id uuid;
  receive_row jsonb;
  session_id uuid;
  batch_id uuid;
  row_qty integer;
  row_damaged integer;
  row_shortage integer;
  row_overage integer;
  row_unit_cost numeric;
  row_variant_id uuid;
  row_sku text;
  batch_items integer := 0;
  batch_subtotal numeric := 0;
begin
  if not public.has_business_role(p_business_id, array['owner','admin','operations','finance']) then raise exception 'Not authorized for purchasing mutation'; end if;
  select result into receipt from public.purchasing_mutation_receipts where business_id=p_business_id and idempotency_key=p_idempotency_key;
  if receipt is not null then return receipt; end if;

  if p_action = 'seed-supplier-ops' then
    insert into public.supplier_scorecards (business_id, supplier_id, quality_score, lead_time_score, communication_score, price_score, defect_rate, on_time_rate, average_lead_days, total_spend_usd, claim_count)
    select p_business_id, s.id, 90, greatest(0, 100 - coalesce(s.lead_days, 12)), 85, 85, 0, 1, coalesce(s.lead_days, 12), 0, 0 from public.suppliers s where s.business_id=p_business_id
    on conflict (business_id, supplier_id) do update set updated_at=now();
    receipt := jsonb_build_object('seeded', true);

  elsif p_action = 'create-1688-po' then
    select * into supplier_row from public.suppliers where business_id=p_business_id and id=(p_payload->>'supplierId')::uuid;
    if supplier_row.id is null then raise exception 'Supplier not found'; end if;
    po_id := gen_random_uuid();
    insert into public.purchase_orders (id, business_id, supplier_id, reference, status, ordered_at, expected_at)
    values (po_id, p_business_id, supplier_row.id, p_payload->>'reference', 'draft', now(), now() + (coalesce(supplier_row.lead_days, 12) || ' days')::interval);
    for po_item in select * from jsonb_array_elements(p_payload->'items') loop
      po_item_id := gen_random_uuid();
      insert into public.purchase_order_items (id, business_id, purchase_order_id, variant_id, expected_quantity, received_quantity, unit_cost)
      values (po_item_id, p_business_id, po_id, (po_item->>'variantId')::uuid, (po_item->>'expectedQuantity')::integer, 0, (po_item->>'unitCost')::numeric * (p_payload->>'exchangeRate')::numeric);
      total_usd := total_usd + (po_item->>'expectedQuantity')::integer * (po_item->>'unitCost')::numeric * (p_payload->>'exchangeRate')::numeric;
      insert into public.supplier_price_history (business_id, supplier_id, variant_id, currency, unit_cost_original, exchange_rate, unit_cost_usd)
      values (p_business_id, supplier_row.id, (po_item->>'variantId')::uuid, p_payload->>'currency', (po_item->>'unitCost')::numeric, (p_payload->>'exchangeRate')::numeric, (po_item->>'unitCost')::numeric * (p_payload->>'exchangeRate')::numeric);
    end loop;
    total_usd := total_usd + coalesce((p_payload->>'domesticFreight')::numeric,0) * (p_payload->>'exchangeRate')::numeric + coalesce((p_payload->>'internationalFreight')::numeric,0) + coalesce((p_payload->>'duties')::numeric,0) + coalesce((p_payload->>'customs')::numeric,0);
    insert into public.purchase_approvals (business_id, purchase_order_id, status, reason) values (p_business_id, po_id, 'requested', '1688 purchasing approval required.');
    insert into public.freight_consolidations (business_id, supplier_id, domestic_freight_usd, international_freight_usd, duties_usd, customs_usd, allocation_method) values (p_business_id, supplier_row.id, coalesce((p_payload->>'domesticFreight')::numeric,0) * (p_payload->>'exchangeRate')::numeric, coalesce((p_payload->>'internationalFreight')::numeric,0), coalesce((p_payload->>'duties')::numeric,0), coalesce((p_payload->>'customs')::numeric,0), 'by_value');
    insert into public.exchange_rates (business_id, base_currency, quote_currency, rate, source) values (p_business_id, 'RMB', 'USD', (p_payload->>'exchangeRate')::numeric, 'invoice');
    insert into public.transactions (business_id, purchase_order_id, transaction_type, category, amount, status, occurred_at, description, source_type, source_id) values (p_business_id, po_id, 'inventory_purchase', 'Purchase commitment', -total_usd, 'pending', now(), 'Committed purchase ' || (p_payload->>'reference'), 'purchase_order', po_id);
    insert into public.activity_events (business_id, action, entity_type, entity_id, detail) values (p_business_id, '1688 purchase order created', 'purchase_order', po_id, p_payload->>'reference');
    receipt := jsonb_build_object('purchase_order_id', po_id, 'total_usd', total_usd);

  elsif p_action = 'approve-po' then
    update public.purchase_approvals set status=case when coalesce((p_payload->>'approved')::boolean,true) then 'approved' else 'rejected' end, reason=coalesce(p_payload->>'reason','Approved'), decided_at=now() where business_id=p_business_id and purchase_order_id=(p_payload->>'purchaseOrderId')::uuid;
    update public.purchase_orders set status=case when coalesce((p_payload->>'approved')::boolean,true) then 'ordered' else 'issue' end where business_id=p_business_id and id=(p_payload->>'purchaseOrderId')::uuid;
    receipt := jsonb_build_object('purchase_order_id', p_payload->>'purchaseOrderId');

  elsif p_action = 'record-payment' then
    select po.supplier_id into supplier_row from public.purchase_orders po where po.business_id=p_business_id and po.id=(p_payload->>'purchaseOrderId')::uuid;
    payment_id := gen_random_uuid();
    insert into public.purchase_payments (id, business_id, purchase_order_id, supplier_id, payment_type, currency, amount_original, exchange_rate, amount_usd, status, paid_at, idempotency_key)
    values (payment_id, p_business_id, (p_payload->>'purchaseOrderId')::uuid, supplier_row.supplier_id, p_payload->>'type', p_payload->>'currency', (p_payload->>'amountOriginal')::numeric, (p_payload->>'exchangeRate')::numeric, (p_payload->>'amountOriginal')::numeric * (p_payload->>'exchangeRate')::numeric, 'paid', now(), p_idempotency_key);
    insert into public.transactions (business_id, purchase_order_id, transaction_type, category, amount, status, occurred_at, description, source_type, source_id, idempotency_key) values (p_business_id, (p_payload->>'purchaseOrderId')::uuid, case when p_payload->>'type'='freight' then 'freight' else 'inventory_purchase' end, 'Purchase payment', -((p_payload->>'amountOriginal')::numeric * (p_payload->>'exchangeRate')::numeric), 'cleared', now(), (p_payload->>'type') || ' payment', 'purchase_order', (p_payload->>'purchaseOrderId')::uuid, p_idempotency_key);
    receipt := jsonb_build_object('payment_id', payment_id);

  elsif p_action = 'receive-parcel-to-lots' then
    session_id := gen_random_uuid();
    insert into public.receiving_sessions (id, business_id, purchase_order_id, parcel_id, status, rows, idempotency_key) values (session_id, p_business_id, (p_payload->>'purchaseOrderId')::uuid, nullif(p_payload->>'parcelId','')::uuid, 'completed', p_payload->'rows', p_idempotency_key);
    batch_id := gen_random_uuid();
    insert into public.inventory_purchase_batches (id, business_id, supplier_id, purchase_order_id, reference, currency, status, item_count, subtotal_original, subtotal_usd, landed_cost_usd, total_cost_usd, idempotency_key)
    select batch_id, p_business_id, po.supplier_id, po.id, po.reference || '-RECEIPT-' || left(session_id::text, 6), 'USD', 'costed', 0, 0, 0, 0, 0, p_idempotency_key
    from public.purchase_orders po where po.business_id=p_business_id and po.id=(p_payload->>'purchaseOrderId')::uuid;
    for receive_row in select * from jsonb_array_elements(p_payload->'rows') loop
      select poi.variant_id, poi.unit_cost, v.sku, greatest(0, poi.expected_quantity - poi.received_quantity - (receive_row->>'receivedQuantity')::integer)
      into row_variant_id, row_unit_cost, row_sku, row_shortage
      from public.purchase_order_items poi join public.product_variants v on v.id=poi.variant_id
      where poi.business_id=p_business_id and poi.id=(receive_row->>'purchaseOrderItemId')::uuid;
      row_qty := (receive_row->>'receivedQuantity')::integer;
      row_damaged := coalesce((receive_row->>'damagedQuantity')::integer, 0);
      row_overage := coalesce((receive_row->>'overageQuantity')::integer, 0);
      update public.purchase_order_items set received_quantity = received_quantity + row_qty where business_id=p_business_id and id=(receive_row->>'purchaseOrderItemId')::uuid;
      if row_qty > 0 then
        insert into public.inventory_lots (business_id, batch_id, variant_id, sku, quantity_received, quantity_remaining, unit_product_cost_usd, unit_landed_cost_usd, total_landed_cost_usd, currency, original_unit_cost, exchange_rate, source_type, source_id)
        values (p_business_id, batch_id, row_variant_id, row_sku, row_qty, row_qty, row_unit_cost, row_unit_cost, row_unit_cost * row_qty, 'USD', row_unit_cost, 1, 'purchase_batch', batch_id);
        batch_items := batch_items + row_qty;
        batch_subtotal := batch_subtotal + row_unit_cost * row_qty;
      end if;
      if row_damaged > 0 or row_shortage > 0 or row_overage > 0 then
        insert into public.supplier_claims (business_id, supplier_id, purchase_order_id, receiving_session_id, claim_type, status, quantity, detail, opened_at, activity)
        select p_business_id, po.supplier_id, po.id, session_id,
          case when row_damaged > 0 then 'damaged' when row_shortage > 0 then 'shortage' else 'overage' end,
          'open', row_damaged + row_shortage + row_overage, 'Receiving discrepancy created from parcel-to-lot receipt.', now(), jsonb_build_array(now()::text || ': Claim opened from receiving session.')
        from public.purchase_orders po where po.business_id=p_business_id and po.id=(p_payload->>'purchaseOrderId')::uuid;
      end if;
    end loop;
    update public.inventory_purchase_batches set item_count=batch_items, subtotal_original=batch_subtotal, subtotal_usd=batch_subtotal, total_cost_usd=batch_subtotal, updated_at=now() where business_id=p_business_id and id=batch_id;
    update public.receiving_sessions set status = case when exists(select 1 from public.supplier_claims where business_id=p_business_id and receiving_session_id=session_id) then 'issue' else 'completed' end where business_id=p_business_id and id=session_id;
    update public.purchase_orders set status='received' where business_id=p_business_id and id=(p_payload->>'purchaseOrderId')::uuid and not exists(select 1 from public.purchase_order_items where business_id=p_business_id and purchase_order_id=(p_payload->>'purchaseOrderId')::uuid and received_quantity < expected_quantity);
    insert into public.activity_events (business_id, action, entity_type, entity_id, detail) values (p_business_id, 'Purchase parcel received to lots', 'purchase_order', (p_payload->>'purchaseOrderId')::uuid, 'Receiving session ' || session_id);
    receipt := jsonb_build_object('receiving_session_id', session_id, 'purchase_batch_id', batch_id, 'received_units', batch_items);

  elsif p_action = 'generate-reorders' then
    insert into public.reorder_recommendations (business_id, variant_id, supplier_id, recommended_quantity, reorder_point, safety_stock, available, incoming, estimated_cost_usd)
    select p_business_id, v.id, p.default_supplier_id, greatest(v.reorder_quantity, v.reorder_point), v.reorder_point, greatest(v.reorder_point, ceil(v.reorder_quantity / 2.0))::integer, coalesce(b.on_hand - b.reserved - b.damaged - b.quarantined - b.lost,0), coalesce(b.incoming,0), greatest(v.reorder_quantity, v.reorder_point) * v.landed_unit_cost
    from public.product_variants v join public.products p on p.id=v.product_id left join public.inventory_balances b on b.variant_id=v.id and b.business_id=p_business_id
    where v.business_id=p_business_id and coalesce(b.on_hand - b.reserved - b.damaged - b.quarantined - b.lost,0) + coalesce(b.incoming,0) <= v.reorder_point
    on conflict do nothing;
    receipt := jsonb_build_object('generated', true);
  else
    raise exception 'Unsupported purchasing action %', p_action;
  end if;

  insert into public.purchasing_mutation_receipts (business_id, idempotency_key, action, result) values (p_business_id, p_idempotency_key, p_action, receipt);
  return receipt;
end;
$$;
