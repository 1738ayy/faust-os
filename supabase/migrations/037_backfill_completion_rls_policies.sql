-- Re-assert the completion-domain tenant policies after the full 001-036 chain exists.
-- Migration 003 must be safe when run early in a fresh project, so this final pass
-- idempotently backfills the same intended RLS posture for every table listed there.

do $$ declare t text; begin
  foreach t in array array[
    'product_images','inventory_counts','inventory_count_items','supplier_contacts','supplier_products','purchase_order_payments',
    'receiving_sessions','receiving_items','supplier_issues','marketplaces','marketplace_accounts','listing_images',
    'listing_sync_events','listing_errors','customer_addresses','order_status_events','refunds','returns','return_items',
    'packages','shipments','shipment_events','shipping_labels','shipping_presets','financial_accounts','transaction_categories',
    'payouts','expenses','budgets','tax_reserves','automation_rules','automation_runs','attachments','tags','entity_tags',
    'imported_source_products','opportunities','opportunity_cost_inputs','comparable_listings','opportunity_analyses',
    'insights','insight_evidence','forecasts','saved_reports'
  ] loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "tenant read" on public.%I', t);
    execute format('create policy "tenant read" on public.%I for select using (public.is_business_member(business_id))', t);
    execute format('drop policy if exists "tenant write" on public.%I', t);
    execute format('create policy "tenant write" on public.%I for all using (public.has_business_role(business_id,array[''owner'',''admin'',''operations'',''finance'',''fulfillment''])) with check (public.has_business_role(business_id,array[''owner'',''admin'',''operations'',''finance'',''fulfillment'']))', t);
  end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array[
    'products','product_variants','product_images','inventory_locations','inventory_balances','stock_movements','inventory_counts',
    'inventory_count_items','suppliers','supplier_contacts','supplier_products','purchase_orders','purchase_order_items',
    'purchase_order_payments','inbound_parcels','inbound_parcel_items','receiving_sessions','receiving_items','supplier_issues',
    'marketplaces','marketplace_accounts','listings','listing_images','listing_sync_events','listing_errors',
    'imported_source_products','opportunities','opportunity_cost_inputs','comparable_listings','opportunity_analyses'
  ] loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "tenant write" on public.%I', t);
    execute format('create policy "catalog operations write" on public.%I for all using (public.has_business_role(business_id,array[''owner'',''admin'',''operations''])) with check (public.has_business_role(business_id,array[''owner'',''admin'',''operations'']))', t);
  end loop;

  foreach t in array array[
    'orders','order_items','order_status_events','returns','return_items','packages','shipments','shipment_events',
    'shipping_labels','shipping_presets'
  ] loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "tenant write" on public.%I', t);
    execute format('create policy "fulfillment write" on public.%I for all using (public.has_business_role(business_id,array[''owner'',''admin'',''fulfillment''])) with check (public.has_business_role(business_id,array[''owner'',''admin'',''fulfillment'']))', t);
  end loop;

  foreach t in array array[
    'financial_accounts','transactions','transaction_categories','payouts','expenses','budgets','tax_reserves','refunds'
  ] loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "tenant write" on public.%I', t);
    execute format('create policy "finance write" on public.%I for all using (public.has_business_role(business_id,array[''owner'',''admin'',''finance''])) with check (public.has_business_role(business_id,array[''owner'',''admin'',''finance'']))', t);
  end loop;

  foreach t in array array[
    'tasks','notifications','automation_rules','automation_runs','activity_events','attachments','tags','entity_tags',
    'insights','insight_evidence','forecasts','saved_reports','customers','customer_addresses'
  ] loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "tenant write" on public.%I', t);
    execute format('create policy "shared operational write" on public.%I for all using (public.has_business_role(business_id,array[''owner'',''admin'',''operations'',''finance'',''fulfillment''])) with check (public.has_business_role(business_id,array[''owner'',''admin'',''operations'',''finance'',''fulfillment'']))', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
