-- Targeted, atomic inventory mutations.  The application never writes an inventory
-- snapshot in production: every balance change goes through one of these RPCs.
create or replace function public.mutate_inventory_balance(
  p_balance_id uuid,
  p_action text,
  p_quantity integer default 0,
  p_reason text default '',
  p_destination_location_id uuid default null,
  p_idempotency_key uuid default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  b public.inventory_balances%rowtype;
  before_balance jsonb;
  usable integer;
  prior_on_hand integer;
  movement_id uuid;
  event_id uuid;
  actor uuid := auth.uid();
  existing jsonb;
begin
  select * into b from public.inventory_balances where id = p_balance_id for update;
  if not found then raise exception 'Inventory balance not found' using errcode = 'P0002'; end if;
  if not public.has_business_role(b.business_id, array['owner','admin','operations']) then raise exception 'Unauthorized inventory mutation' using errcode = '42501'; end if;
  if p_idempotency_key is not null then
    select jsonb_build_object('idempotent', true, 'balance_id', b.id, 'movement_id', m.id) into existing
    from public.stock_movements m where m.business_id = b.business_id and m.reference_type = 'inventory_mutation' and m.reference_id = p_idempotency_key order by m.created_at limit 1;
    if existing is not null then return existing; end if;
  end if;
  if p_action not in ('location') and (p_quantity is null or p_quantity <= 0) then raise exception 'Quantity must be positive'; end if;
  before_balance := to_jsonb(b); prior_on_hand := b.on_hand;
  usable := b.on_hand - b.reserved - b.damaged - b.quarantined;
  if p_action = 'adjust' then
    if b.on_hand + p_quantity < b.reserved then raise exception 'Adjustment would violate reservations'; end if;
    update public.inventory_balances set on_hand = b.on_hand + p_quantity, updated_at = now() where id = b.id returning * into b;
  elsif p_action = 'cycle_count' then
    if p_quantity < b.reserved then raise exception 'Cycle count cannot reduce on-hand below reservations'; end if;
    update public.inventory_balances set on_hand = p_quantity, updated_at = now() where id = b.id returning * into b;
  elsif p_action = 'damage' then
    if usable < p_quantity then raise exception 'Insufficient usable inventory'; end if;
    update public.inventory_balances set damaged = b.damaged + p_quantity, updated_at = now() where id = b.id returning * into b;
  elsif p_action = 'quarantine' then
    if usable < p_quantity then raise exception 'Insufficient usable inventory'; end if;
    update public.inventory_balances set quarantined = b.quarantined + p_quantity, updated_at = now() where id = b.id returning * into b;
  elsif p_action = 'release_quarantine' then
    if b.quarantined < p_quantity then raise exception 'Insufficient quarantined inventory'; end if;
    update public.inventory_balances set quarantined = b.quarantined - p_quantity, updated_at = now() where id = b.id returning * into b;
  elsif p_action = 'lost' then
    if usable < p_quantity then raise exception 'Insufficient usable inventory'; end if;
    update public.inventory_balances set on_hand = b.on_hand - p_quantity, lost = b.lost + p_quantity, updated_at = now() where id = b.id returning * into b;
  elsif p_action = 'found' then
    update public.inventory_balances set on_hand = b.on_hand + p_quantity, updated_at = now() where id = b.id returning * into b;
  elsif p_action = 'location' then
    if p_destination_location_id is null then raise exception 'Destination location is required'; end if;
    if b.location_id is not null then raise exception 'Use a transfer to move stock that is already located'; end if;
    if not exists (select 1 from public.inventory_locations where id = p_destination_location_id and business_id = b.business_id) then raise exception 'Destination location not found'; end if;
    update public.inventory_balances set location_id = p_destination_location_id, updated_at = now() where id = b.id returning * into b;
  else raise exception 'Unknown inventory action'; end if;
  insert into public.stock_movements(business_id, variant_id, location_id, quantity_delta, movement_type, reference_type, reference_id, reason, actor_id)
  values (b.business_id, b.variant_id, b.location_id,
    case when p_action in ('adjust','found') then p_quantity when p_action = 'cycle_count' then b.on_hand - prior_on_hand when p_action in ('damage','quarantine','lost') then -p_quantity when p_action = 'release_quarantine' then p_quantity else 0 end,
    case when p_action = 'damage' then 'damage' when p_action = 'lost' then 'loss' when p_action = 'found' then 'found' when p_action = 'cycle_count' then 'cycle_count_adjustment' when p_action = 'location' then 'transfer_in' else 'manual_adjustment' end,
    'inventory_mutation', p_idempotency_key, nullif(p_reason, ''), actor) returning id into movement_id;
  insert into public.activity_events(business_id, actor_id, action, entity_type, entity_id, detail, before_value, after_value)
  values (b.business_id, actor, 'Inventory ' || replace(p_action, '_', ' '), 'inventory_balance', b.id, nullif(p_reason, ''), before_balance, to_jsonb(b)) returning id into event_id;
  return jsonb_build_object('idempotent', false, 'balance', to_jsonb(b), 'movement_id', movement_id, 'activity_event_id', event_id);
end $$;

create or replace function public.transfer_inventory_balance(
  p_source_balance_id uuid,
  p_destination_balance_id uuid,
  p_quantity integer,
  p_reason text default '',
  p_idempotency_key uuid default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  source_balance public.inventory_balances%rowtype;
  destination_balance public.inventory_balances%rowtype;
  available integer;
  out_movement uuid;
  in_movement uuid;
  event_id uuid;
  actor uuid := auth.uid();
  existing jsonb;
begin
  if p_source_balance_id = p_destination_balance_id then raise exception 'Source and destination must be different'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Transfer quantity must be positive'; end if;
  -- Lock in stable UUID order to avoid concurrent transfer deadlocks.
  if p_source_balance_id < p_destination_balance_id then
    select * into source_balance from public.inventory_balances where id = p_source_balance_id for update;
    select * into destination_balance from public.inventory_balances where id = p_destination_balance_id for update;
  else
    select * into destination_balance from public.inventory_balances where id = p_destination_balance_id for update;
    select * into source_balance from public.inventory_balances where id = p_source_balance_id for update;
  end if;
  if source_balance.id is null or destination_balance.id is null then raise exception 'Source or destination balance not found'; end if;
  if source_balance.business_id <> destination_balance.business_id or source_balance.variant_id <> destination_balance.variant_id then raise exception 'Transfer balances must belong to the same business and variant'; end if;
  if source_balance.location_id is null or destination_balance.location_id is null then raise exception 'Both transfer balances require a location'; end if;
  if source_balance.location_id = destination_balance.location_id then raise exception 'Source and destination locations must be different'; end if;
  if not public.has_business_role(source_balance.business_id, array['owner','admin','operations']) then raise exception 'Unauthorized inventory transfer' using errcode = '42501'; end if;
  if p_idempotency_key is not null then
    select jsonb_build_object('idempotent', true, 'source_balance_id', source_balance.id, 'destination_balance_id', destination_balance.id, 'movement_id', id) into existing
    from public.stock_movements where business_id = source_balance.business_id and reference_type = 'inventory_transfer' and reference_id = p_idempotency_key order by created_at limit 1;
    if existing is not null then return existing; end if;
  end if;
  available := source_balance.on_hand - source_balance.reserved - source_balance.damaged - source_balance.quarantined;
  if available < p_quantity then raise exception 'Insufficient available unreserved inventory'; end if;
  update public.inventory_balances set on_hand = on_hand - p_quantity, updated_at = now() where id = source_balance.id returning * into source_balance;
  update public.inventory_balances set on_hand = on_hand + p_quantity, updated_at = now() where id = destination_balance.id returning * into destination_balance;
  insert into public.stock_movements(business_id, variant_id, location_id, quantity_delta, movement_type, reference_type, reference_id, reason, actor_id)
  values (source_balance.business_id, source_balance.variant_id, source_balance.location_id, -p_quantity, 'transfer_out', 'inventory_transfer', p_idempotency_key, nullif(p_reason,''), actor) returning id into out_movement;
  insert into public.stock_movements(business_id, variant_id, location_id, quantity_delta, movement_type, reference_type, reference_id, reason, actor_id)
  values (source_balance.business_id, destination_balance.variant_id, destination_balance.location_id, p_quantity, 'transfer_in', 'inventory_transfer', p_idempotency_key, nullif(p_reason,''), actor) returning id into in_movement;
  insert into public.activity_events(business_id, actor_id, action, entity_type, entity_id, detail, after_value)
  values (source_balance.business_id, actor, 'Inventory transferred', 'inventory_balance', source_balance.id, nullif(p_reason,''), jsonb_build_object('source', to_jsonb(source_balance), 'destination', to_jsonb(destination_balance))) returning id into event_id;
  return jsonb_build_object('idempotent', false, 'source_balance', to_jsonb(source_balance), 'destination_balance', to_jsonb(destination_balance), 'movement_ids', jsonb_build_array(out_movement, in_movement), 'activity_event_id', event_id);
end $$;

revoke all on function public.mutate_inventory_balance(uuid,text,integer,text,uuid,uuid) from public;
revoke all on function public.transfer_inventory_balance(uuid,uuid,integer,text,uuid) from public;
grant execute on function public.mutate_inventory_balance(uuid,text,integer,text,uuid,uuid) to authenticated;
grant execute on function public.transfer_inventory_balance(uuid,uuid,integer,text,uuid) to authenticated;
