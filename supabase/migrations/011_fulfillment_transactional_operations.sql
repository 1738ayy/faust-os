-- Fulfillment Phase 2 production persistence.
-- Normalized tenant tables + one transactional RPC boundary for every fulfillment mutation.

alter table public.notifications add column if not exists entity_type text, add column if not exists entity_id uuid;
alter table public.packages add column if not exists shipment_id uuid references public.shipments(id) on delete cascade,
  add column if not exists package_type text not null default 'custom',
  add column if not exists length_in numeric not null default 0,
  add column if not exists width_in numeric not null default 0,
  add column if not exists height_in numeric not null default 0,
  add column if not exists preset text,
  add column if not exists notes text,
  add column if not exists split_from uuid,
  add column if not exists merged_from uuid[];
alter table public.shipments add column if not exists priority text not null default 'standard',
  add column if not exists shipping_method text not null default 'standard',
  add column if not exists picker text,
  add column if not exists packer text,
  add column if not exists station text,
  add column if not exists sla_deadline timestamptz,
  add column if not exists provider text not null default 'local_mock',
  add column if not exists address_validation jsonb,
  add column if not exists rate_state text not null default 'idle',
  add column if not exists selected_rate_id uuid,
  add column if not exists label_url text,
  add column if not exists label_format text not null default '4x6',
  add column if not exists postage_cost numeric not null default 0,
  add column if not exists manifest_id uuid,
  add column if not exists estimated_delivery timestamptz,
  add column if not exists actual_delivery timestamptz,
  add column if not exists tracking_status text,
  add column if not exists last_scan text,
  add column if not exists scan_log jsonb not null default '[]'::jsonb,
  add column if not exists timestamps jsonb not null default '{}'::jsonb,
  add column if not exists hold_active boolean not null default false,
  add column if not exists hold_reason text,
  add column if not exists hold_created_at timestamptz,
  add column if not exists hold_released_at timestamptz,
  add column if not exists idempotency_key text;
alter table public.shipment_events add column if not exists label text;
alter table public.shipping_labels add column if not exists provider text not null default 'local_mock',
  add column if not exists carrier text,
  add column if not exists service text,
  add column if not exists tracking_number text,
  add column if not exists status text not null default 'active',
  add column if not exists postage_cost numeric not null default 0,
  add column if not exists voided_at timestamptz,
  add column if not exists regenerated_from_label_id uuid references public.shipping_labels(id) on delete set null,
  add column if not exists source text not null default 'provider',
  add column if not exists idempotency_key text;

create table if not exists public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  provider text not null,
  carrier text not null,
  service text not null,
  delivery_days integer not null default 3,
  retail_rate numeric not null default 0,
  negotiated_rate numeric,
  currency text not null default 'USD',
  insurance_available boolean not null default false,
  signature_available boolean not null default false,
  warnings text[] not null default '{}',
  package_weight_oz numeric not null default 0,
  length_in numeric not null default 0,
  width_in numeric not null default 0,
  height_in numeric not null default 0,
  selected boolean not null default false,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id,idempotency_key)
);
create table if not exists public.fulfillment_manifests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  carrier text not null,
  status text not null default 'open',
  shipment_ids uuid[] not null default '{}',
  label_count integer not null default 0,
  generated_at timestamptz not null default now(),
  closed_at timestamptz,
  dispatched_at timestamptz,
  handoff_confirmed_at timestamptz,
  activity text[] not null default '{}',
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id,idempotency_key)
);
create table if not exists public.fulfillment_exceptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  shipment_id uuid references public.shipments(id) on delete cascade,
  type text not null,
  severity text not null default 'warning',
  owner text,
  notes text not null,
  status text not null default 'open',
  activity text[] not null default '{}',
  sla_deadline timestamptz,
  notification_id uuid references public.notifications(id) on delete set null,
  resolved_at timestamptz,
  reopened_at timestamptz,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id,idempotency_key)
);
create table if not exists public.fulfillment_mutation_receipts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  idempotency_key text not null,
  action text not null,
  entity_type text,
  entity_id uuid,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(business_id,idempotency_key)
);

do $$ declare t text; begin foreach t in array array['shipping_rates','fulfillment_manifests','fulfillment_exceptions','fulfillment_mutation_receipts'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists "tenant read" on public.%I',t);
  execute format('create policy "tenant read" on public.%I for select using (public.is_business_member(business_id))',t);
  execute format('drop policy if exists "fulfillment write" on public.%I',t);
  execute format('create policy "fulfillment write" on public.%I for all using (public.has_business_role(business_id,array[''owner'',''admin'',''fulfillment''])) with check (public.has_business_role(business_id,array[''owner'',''admin'',''fulfillment'']))',t);
end loop; end $$;

create index if not exists shipments_business_status_idx on public.shipments(business_id,status,updated_at desc);
create index if not exists packages_shipment_idx on public.packages(business_id,shipment_id);
create index if not exists shipping_rates_shipment_idx on public.shipping_rates(business_id,shipment_id,created_at desc);
create index if not exists shipping_labels_shipment_idx on public.shipping_labels(business_id,shipment_id,created_at desc);
create index if not exists fulfillment_exceptions_status_idx on public.fulfillment_exceptions(business_id,status,created_at desc);
create index if not exists fulfillment_manifests_status_idx on public.fulfillment_manifests(business_id,status,created_at desc);

create or replace function public.mutate_fulfillment_transactional(p_business_id uuid, p_action text, p_payload jsonb, p_idempotency_key text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  actor uuid := auth.uid();
  receipt public.fulfillment_mutation_receipts%rowtype;
  s public.shipments%rowtype;
  o public.orders%rowtype;
  item record;
  b public.inventory_balances%rowtype;
  pkg public.packages%rowtype;
  label_id uuid;
  event_id uuid;
  notification_id uuid;
  exception_id uuid;
  manifest_id uuid;
  detail text := coalesce(p_payload->>'notes',p_payload->>'reason',p_action);
  key text := coalesce(p_idempotency_key, gen_random_uuid()::text);
  now_value timestamptz := now();
  order_id uuid;
  shipment_id uuid;
  amount numeric;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.has_business_role(p_business_id,array['owner','admin','fulfillment']) then raise exception 'Unauthorized fulfillment mutation' using errcode='42501'; end if;
  select * into receipt from public.fulfillment_mutation_receipts where business_id=p_business_id and idempotency_key=key;
  if found then return receipt.result || jsonb_build_object('idempotent',true); end if;

  if p_action='beginPicking' then
    order_id := (p_payload->>'order_id')::uuid;
    select * into o from public.orders where id=order_id and business_id=p_business_id for update; if not found then raise exception 'Order not found'; end if;
    if o.status in ('draft','pending_payment') then raise exception 'Order must be paid before picking'; end if;
    select * into s from public.shipments where business_id=p_business_id and order_id=o.id limit 1 for update;
    if not found then
      insert into public.shipments(business_id,order_id,status,priority,shipping_method,picker,sla_deadline,provider,timestamps,idempotency_key)
      values(p_business_id,o.id,'picking',case when o.ship_by is not null and o.ship_by-now()<interval '1 day' then 'urgent' else 'standard' end,coalesce(o.marketplace||' standard','standard'),p_payload->>'picker',o.ship_by,'local_mock',jsonb_build_object('ready_to_pick',now_value,'picking',now_value),key)
      returning * into s;
    else
      update public.shipments set status='picking',picker=coalesce(p_payload->>'picker',picker),timestamps=timestamps||jsonb_build_object('picking',now_value),updated_at=now_value where id=s.id returning * into s;
    end if;
    insert into public.shipment_events(business_id,shipment_id,status,label,occurred_at,idempotency_key) values(p_business_id,s.id,'picking','Picking started',now_value,key||':event') returning id into event_id;

  elsif p_action='completePicking' then
    shipment_id := (p_payload->>'shipment_id')::uuid; select * into s from public.shipments where id=shipment_id and business_id=p_business_id for update; if not found then raise exception 'Shipment not found'; end if;
    update public.shipments set status=case when jsonb_path_exists(coalesce(p_payload->'outcomes','[]'::jsonb),'$[*] ? (@.status != "picked")') then 'exception' else 'ready_to_pack' end,timestamps=timestamps||jsonb_build_object('ready_to_pack',now_value),updated_at=now_value where id=s.id returning * into s;
    insert into public.shipment_events(business_id,shipment_id,status,label,occurred_at,idempotency_key) values(p_business_id,s.id,s.status,'Picking completed',now_value,key||':event') returning id into event_id;

  elsif p_action in ('beginPacking','assignFulfillment') then
    shipment_id := (p_payload->>'shipment_id')::uuid; select * into s from public.shipments where id=shipment_id and business_id=p_business_id for update; if not found then raise exception 'Shipment not found'; end if;
    update public.shipments set status=case when p_action='beginPacking' then 'packing' else status end, picker=coalesce(p_payload->>'picker',picker), packer=coalesce(p_payload->>'packer',packer), station=coalesce(p_payload->>'station',station), priority=coalesce(p_payload->>'priority',priority), sla_deadline=coalesce((p_payload->>'sla_deadline')::timestamptz,sla_deadline), timestamps=timestamps||jsonb_build_object(case when p_action='beginPacking' then 'packing' else 'assigned' end,now_value), updated_at=now_value where id=s.id returning * into s;
    update public.orders set status='ready_to_pack',updated_at=now_value where id=s.order_id and p_action='beginPacking';
    insert into public.shipment_events(business_id,shipment_id,status,label,occurred_at,idempotency_key) values(p_business_id,s.id,s.status,case when p_action='beginPacking' then 'Packing started' else 'Assignment updated' end,now_value,key||':event') returning id into event_id;

  elsif p_action in ('completePacking','createPackage','updatePackage','splitPackage','mergePackage') then
    shipment_id := (p_payload->>'shipment_id')::uuid; select * into s from public.shipments where id=shipment_id and business_id=p_business_id for update; if not found then raise exception 'Shipment not found'; end if;
    if p_action='updatePackage' then
      update public.packages set package_type=coalesce(p_payload->>'package_type',package_type),weight_oz=coalesce((p_payload->>'weight_oz')::numeric,weight_oz),length_in=coalesce((p_payload->>'length_in')::numeric,length_in),width_in=coalesce((p_payload->>'width_in')::numeric,width_in),height_in=coalesce((p_payload->>'height_in')::numeric,height_in),notes=coalesce(p_payload->>'notes',notes),updated_at=now_value where id=(p_payload->>'package_id')::uuid and business_id=p_business_id returning * into pkg;
    else
      insert into public.packages(business_id,order_id,shipment_id,package_type,weight_oz,length_in,width_in,height_in,notes,split_from,merged_from)
      values(p_business_id,s.order_id,s.id,coalesce(p_payload->>'package_type','poly_mailer'),coalesce((p_payload->>'weight_oz')::numeric,0),coalesce((p_payload->>'length_in')::numeric,0),coalesce((p_payload->>'width_in')::numeric,0),coalesce((p_payload->>'height_in')::numeric,0),p_payload->>'notes',nullif(p_payload->>'split_from','')::uuid,case when p_payload ? 'merged_from' then array(select jsonb_array_elements_text(p_payload->'merged_from')::uuid) else null end) returning * into pkg;
    end if;
    update public.shipments set status=case when p_action='completePacking' then 'packed' else status end, package_id=coalesce(package_id,pkg.id), scan_log=case when p_action='completePacking' then coalesce(p_payload->'scan_log','[]'::jsonb) else scan_log end, timestamps=timestamps||jsonb_build_object('packed',now_value),updated_at=now_value where id=s.id returning * into s;
    update public.orders set status='packed',updated_at=now_value where id=s.order_id and p_action='completePacking';
    update public.order_items set fulfillment_state='packed',updated_at=now_value where order_id=s.order_id and p_action='completePacking';
    insert into public.shipment_events(business_id,shipment_id,status,label,occurred_at,idempotency_key) values(p_business_id,s.id,s.status,'Package recorded',now_value,key||':event') returning id into event_id;

  elsif p_action in ('validateAddress','overrideAddress') then
    shipment_id := (p_payload->>'shipment_id')::uuid; select * into s from public.shipments where id=shipment_id and business_id=p_business_id for update; if not found then raise exception 'Shipment not found'; end if;
    update public.shipments set provider=coalesce(p_payload->>'provider',provider),address_validation=case when p_action='overrideAddress' then coalesce(address_validation,'{}'::jsonb)||jsonb_build_object('status','overridden','overrideReason',p_payload->>'reason','confirmedAt',now_value) else jsonb_build_object('status','valid','warnings','[]'::jsonb,'residential',true,'confirmedAt',now_value) end,rate_state='idle',updated_at=now_value where id=s.id returning * into s;
    insert into public.shipment_events(business_id,shipment_id,status,label,occurred_at,idempotency_key) values(p_business_id,s.id,s.status,case when p_action='overrideAddress' then 'Address override confirmed' else 'Address validated' end,now_value,key||':event') returning id into event_id;

  elsif p_action='requestRates' then
    shipment_id := (p_payload->>'shipment_id')::uuid; select * into s from public.shipments where id=shipment_id and business_id=p_business_id for update; if not found then raise exception 'Shipment not found'; end if;
    select * into pkg from public.packages where business_id=p_business_id and shipment_id=s.id order by created_at desc limit 1; if not found then raise exception 'Package required before rates'; end if;
    delete from public.shipping_rates where business_id=p_business_id and shipment_id=s.id and selected=false;
    insert into public.shipping_rates(business_id,shipment_id,provider,carrier,service,delivery_days,retail_rate,negotiated_rate,insurance_available,signature_available,warnings,package_weight_oz,length_in,width_in,height_in,idempotency_key) values
      (p_business_id,s.id,coalesce(p_payload->>'provider','local_mock'),'USPS Mock','Ground Advantage',3,8.50,7.45,true,true,'{}',pkg.weight_oz,pkg.length_in,pkg.width_in,pkg.height_in,key||':rate1'),
      (p_business_id,s.id,coalesce(p_payload->>'provider','local_mock'),'UPS Mock','Ground',4,10.95,9.85,true,true,'{}',pkg.weight_oz,pkg.length_in,pkg.width_in,pkg.height_in,key||':rate2');
    update public.shipments set rate_state='success',updated_at=now_value where id=s.id returning * into s;
    insert into public.shipment_events(business_id,shipment_id,status,label,occurred_at,idempotency_key) values(p_business_id,s.id,s.status,'Rates returned',now_value,key||':event') returning id into event_id;

  elsif p_action='selectRate' then
    shipment_id := (p_payload->>'shipment_id')::uuid; select * into s from public.shipments where id=shipment_id and business_id=p_business_id for update; if not found then raise exception 'Shipment not found'; end if;
    update public.shipping_rates set selected=false where business_id=p_business_id and shipment_id=s.id;
    update public.shipping_rates set selected=true where id=(p_payload->>'rate_id')::uuid and business_id=p_business_id and shipment_id=s.id;
    update public.shipments set selected_rate_id=(p_payload->>'rate_id')::uuid,carrier=(select carrier from public.shipping_rates where id=(p_payload->>'rate_id')::uuid),service=(select service from public.shipping_rates where id=(p_payload->>'rate_id')::uuid),postage_cost=(select coalesce(negotiated_rate,retail_rate) from public.shipping_rates where id=(p_payload->>'rate_id')::uuid),updated_at=now_value where id=s.id returning * into s;
    insert into public.shipment_events(business_id,shipment_id,status,label,occurred_at,idempotency_key) values(p_business_id,s.id,s.status,'Rate selected',now_value,key||':event') returning id into event_id;

  elsif p_action in ('generateLabel','attachManualLabel','attachMarketplaceLabel','regenerateLabel') then
    shipment_id := (p_payload->>'shipment_id')::uuid; select * into s from public.shipments where id=shipment_id and business_id=p_business_id for update; if not found then raise exception 'Shipment not found'; end if;
    if s.status not in ('packed','ready_to_ship') then raise exception 'Shipment must be packed before label'; end if;
    if p_action='regenerateLabel' then update public.shipping_labels set status='regenerated',updated_at=now_value where business_id=p_business_id and shipment_id=s.id and status='active'; end if;
    amount := coalesce((p_payload->>'postage_cost')::numeric,s.postage_cost,7.45);
    insert into public.shipping_labels(business_id,shipment_id,provider,carrier,service,tracking_number,url,format,status,postage_cost,source,idempotency_key,regenerated_from_label_id)
    values(p_business_id,s.id,case when p_action='attachManualLabel' then 'manual_label' when p_action='attachMarketplaceLabel' then 'marketplace_label' else coalesce(s.provider,'local_mock') end,coalesce(p_payload->>'carrier',s.carrier,'USPS Mock'),coalesce(p_payload->>'service',s.service,'Ground Advantage'),coalesce(p_payload->>'tracking_number','MOCK-'||left(s.id::text,8)||'-'||floor(extract(epoch from now_value))::text),coalesce(p_payload->>'label_url','/api/fulfillment/labels/MOCK-'||left(s.id::text,8)||'?format=4x6'),'4x6',case when p_action='regenerateLabel' then 'regenerated' else 'active' end,amount,case when p_action='attachManualLabel' then 'manual_upload' when p_action='attachMarketplaceLabel' then 'marketplace' else 'mock' end,key,(select id from public.shipping_labels where business_id=p_business_id and shipment_id=s.id order by created_at desc limit 1)) returning id into label_id;
    update public.shipments set status='ready_to_ship',carrier=coalesce(p_payload->>'carrier',carrier,'USPS Mock'),service=coalesce(p_payload->>'service',service,'Ground Advantage'),tracking_number=(select tracking_number from public.shipping_labels where id=label_id),label_url=(select url from public.shipping_labels where id=label_id),postage_cost=amount,timestamps=timestamps||jsonb_build_object('ready_to_ship',now_value),updated_at=now_value where id=s.id returning * into s;
    update public.orders set status='ready_to_ship',tracking_number=s.tracking_number,shipping_label_url=s.label_url,shipping_cost=amount,updated_at=now_value where id=s.order_id;
    insert into public.transactions(business_id,order_id,category,amount,status,occurred_at,description) values(p_business_id,s.order_id,'shipping',-amount,'pending',now_value,coalesce(s.carrier,'Carrier')||' postage');
    insert into public.shipment_events(business_id,shipment_id,status,label,occurred_at,idempotency_key) values(p_business_id,s.id,'ready_to_ship','Label attached',now_value,key||':event') returning id into event_id;

  elsif p_action='voidLabel' then
    shipment_id := (p_payload->>'shipment_id')::uuid; select * into s from public.shipments where id=shipment_id and business_id=p_business_id for update; if not found then raise exception 'Shipment not found'; end if;
    update public.shipping_labels set status='voided',voided_at=now_value,updated_at=now_value where business_id=p_business_id and shipment_id=s.id and status in ('active','regenerated');
    insert into public.shipment_events(business_id,shipment_id,status,label,occurred_at,idempotency_key) values(p_business_id,s.id,s.status,'Label voided',now_value,key||':event') returning id into event_id;

  elsif p_action='printLabel' then
    shipment_id := (p_payload->>'shipment_id')::uuid; select * into s from public.shipments where id=shipment_id and business_id=p_business_id for update; if not found then raise exception 'Shipment not found'; end if;
    insert into public.shipment_events(business_id,shipment_id,status,label,occurred_at,idempotency_key) values(p_business_id,s.id,'printed','Label printed',now_value,key||':event') returning id into event_id;

  elsif p_action='createManifest' then
    insert into public.fulfillment_manifests(business_id,carrier,status,shipment_ids,label_count,closed_at,activity,idempotency_key)
    values(p_business_id,coalesce(p_payload->>'carrier','Mixed carriers'),'closed',array(select jsonb_array_elements_text(p_payload->'shipment_ids')::uuid),jsonb_array_length(p_payload->'shipment_ids'),now_value,array[now_value::text||': Manifest generated'],key) returning id into manifest_id;
    update public.shipments set status='manifested',manifest_id=manifest_id,updated_at=now_value where business_id=p_business_id and id=any(array(select jsonb_array_elements_text(p_payload->'shipment_ids')::uuid));

  elsif p_action='dispatchManifest' then
    manifest_id := (p_payload->>'manifest_id')::uuid; update public.fulfillment_manifests set status='dispatched',dispatched_at=now_value,handoff_confirmed_at=now_value,activity=array_prepend(now_value::text||': Carrier handoff confirmed',activity),updated_at=now_value where id=manifest_id and business_id=p_business_id;
    for s in select * from public.shipments where business_id=p_business_id and manifest_id=manifest_id for update loop
      perform public.mutate_fulfillment_transactional(p_business_id,'dispatchShipment',jsonb_build_object('shipment_id',s.id),key||':'||s.id);
    end loop;

  elsif p_action='dispatchShipment' then
    shipment_id := (p_payload->>'shipment_id')::uuid; select * into s from public.shipments where id=shipment_id and business_id=p_business_id for update; if not found then raise exception 'Shipment not found'; end if;
    if s.status not in ('ready_to_ship','printed','manifested') then raise exception 'Shipment must be ready before dispatch'; end if;
    select * into o from public.orders where id=s.order_id and business_id=p_business_id for update;
    for item in select * from public.order_items where order_id=o.id loop
      select * into b from public.inventory_balances where business_id=p_business_id and variant_id=item.variant_id order by id limit 1 for update;
      if not found or b.reserved < item.quantity-item.cancelled_quantity or b.on_hand < item.quantity-item.cancelled_quantity then raise exception 'Insufficient reserved inventory to ship'; end if;
    end loop;
    for item in select * from public.order_items where order_id=o.id loop
      select * into b from public.inventory_balances where business_id=p_business_id and variant_id=item.variant_id order by id limit 1 for update;
      update public.inventory_balances set reserved=reserved-(item.quantity-item.cancelled_quantity),on_hand=on_hand-(item.quantity-item.cancelled_quantity),updated_at=now_value where id=b.id;
      insert into public.stock_movements(business_id,variant_id,location_id,quantity_delta,movement_type,reference_type,reference_id,reason,actor_id) values(p_business_id,item.variant_id,b.location_id,-(item.quantity-item.cancelled_quantity),'shipment','order',o.id,'Shipment dispatched',actor);
      update public.order_items set fulfillment_state='shipped',updated_at=now_value where id=item.id;
    end loop;
    update public.orders set status='shipped',updated_at=now_value where id=o.id;
    update public.shipments set status='in_transit',tracking_status='in_transit',last_scan='Carrier accepted package',timestamps=timestamps||jsonb_build_object('dispatched',now_value,'in_transit',now_value),updated_at=now_value where id=s.id returning * into s;
    insert into public.shipment_events(business_id,shipment_id,status,label,occurred_at,idempotency_key) values(p_business_id,s.id,'in_transit','Carrier accepted package',now_value,key||':event') returning id into event_id;

  elsif p_action in ('markDelivered','markReturned','refreshTracking') then
    shipment_id := (p_payload->>'shipment_id')::uuid; select * into s from public.shipments where id=shipment_id and business_id=p_business_id for update; if not found then raise exception 'Shipment not found'; end if;
    update public.shipments set status=case when p_action='markDelivered' then 'delivered' when p_action='markReturned' then 'returned' else status end,tracking_status=case when p_action='markDelivered' then 'delivered' when p_action='markReturned' then 'returned' else 'in_transit' end,last_scan=case when p_action='refreshTracking' then 'Carrier accepted package' when p_action='markDelivered' then 'Delivered' else 'Returned to sender' end,actual_delivery=case when p_action='markDelivered' then now_value else actual_delivery end,updated_at=now_value where id=s.id returning * into s;
    update public.orders set status=case when p_action='markDelivered' then 'delivered' when p_action='markReturned' then 'return_requested' else status end,updated_at=now_value where id=s.order_id;
    insert into public.shipment_events(business_id,shipment_id,status,label,occurred_at,idempotency_key) values(p_business_id,s.id,s.status,coalesce(s.last_scan,p_action),now_value,key||':event') returning id into event_id;

  elsif p_action in ('placeHold','releaseHold') then
    shipment_id := (p_payload->>'shipment_id')::uuid; select * into s from public.shipments where id=shipment_id and business_id=p_business_id for update; if not found then raise exception 'Shipment not found'; end if;
    update public.shipments set hold_active=(p_action='placeHold'),hold_reason=case when p_action='placeHold' then p_payload->>'reason' else hold_reason end,hold_created_at=case when p_action='placeHold' then now_value else hold_created_at end,hold_released_at=case when p_action='releaseHold' then now_value else hold_released_at end,updated_at=now_value where id=s.id returning * into s;
    if p_action='placeHold' then insert into public.notifications(business_id,severity,category,title,detail,href,entity_type,entity_id) values(p_business_id,'warning','shipping','Shipment on hold',p_payload->>'reason','/shipping','fulfillment_shipment',s.id) returning id into notification_id; else update public.notifications set resolved_at=now_value where business_id=p_business_id and entity_type='fulfillment_shipment' and entity_id=s.id and title='Shipment on hold' and resolved_at is null; end if;

  elsif p_action in ('createException','resolveException','reopenException') then
    if p_action='createException' then
      insert into public.notifications(business_id,severity,category,title,detail,href,entity_type,entity_id) values(p_business_id,coalesce(p_payload->>'severity','warning'),'shipping','Fulfillment exception',p_payload->>'notes','/shipping','fulfillment_exception',coalesce(nullif(p_payload->>'shipment_id','')::uuid,nullif(p_payload->>'order_id','')::uuid)) returning id into notification_id;
      insert into public.fulfillment_exceptions(business_id,order_id,shipment_id,type,severity,owner,notes,status,activity,notification_id,idempotency_key) values(p_business_id,nullif(p_payload->>'order_id','')::uuid,nullif(p_payload->>'shipment_id','')::uuid,coalesce(p_payload->>'type','manual_review'),coalesce(p_payload->>'severity','warning'),p_payload->>'owner',p_payload->>'notes','open',array[now_value::text||': '||coalesce(p_payload->>'notes','Exception')],notification_id,key) returning id into exception_id;
      if p_payload ? 'shipment_id' then update public.shipments set status='exception',updated_at=now_value where id=(p_payload->>'shipment_id')::uuid and business_id=p_business_id; end if;
    else
      exception_id := (p_payload->>'exception_id')::uuid;
      update public.fulfillment_exceptions set status=case when p_action='resolveException' then 'resolved' else 'open' end,resolved_at=case when p_action='resolveException' then now_value else resolved_at end,reopened_at=case when p_action='reopenException' then now_value else reopened_at end,activity=array_append(activity,now_value::text||': '||coalesce(p_payload->>'notes',p_action)),updated_at=now_value where id=exception_id and business_id=p_business_id returning notification_id into notification_id;
      update public.notifications set resolved_at=case when p_action='resolveException' then now_value else null end where id=notification_id and business_id=p_business_id;
    end if;
  else
    raise exception 'Unknown fulfillment action %',p_action;
  end if;

  insert into public.activity_events(business_id,actor_id,action,entity_type,entity_id,detail) values(p_business_id,actor,'Fulfillment '||p_action,'fulfillment',coalesce(shipment_id,order_id,manifest_id,exception_id,label_id,event_id),detail);
  insert into public.fulfillment_mutation_receipts(business_id,idempotency_key,action,entity_type,entity_id,result) values(p_business_id,key,p_action,'fulfillment',coalesce(shipment_id,order_id,manifest_id,exception_id,label_id,event_id),jsonb_build_object('idempotent',false,'action',p_action,'entity_id',coalesce(shipment_id,order_id,manifest_id,exception_id,label_id,event_id)));
  return jsonb_build_object('idempotent',false,'action',p_action,'entity_id',coalesce(shipment_id,order_id,manifest_id,exception_id,label_id,event_id));
end $$;

revoke all on function public.mutate_fulfillment_transactional(uuid,text,jsonb,text) from public;
grant execute on function public.mutate_fulfillment_transactional(uuid,text,jsonb,text) to authenticated;
