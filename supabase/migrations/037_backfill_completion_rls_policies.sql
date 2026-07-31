-- Re-assert the completion-domain tenant policies after the full 001-036 chain exists.
-- Migration 003 must be safe when run early in a fresh project, so this final pass
-- idempotently backfills the same intended RLS posture for every table listed there.

create or replace function public.faust_migration_rls_business_id_expression(p_table text)
returns text
language plpgsql
stable
as $$
declare
  candidate text;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_table and column_name = 'business_id') then
    return 'business_id';
  end if;

  candidate := case p_table
    when 'product_variants' then '(select parent.business_id from public.products parent where parent.id = product_id)'
    when 'product_images' then '(select parent.business_id from public.products parent where parent.id = product_id)'
    when 'inventory_balances' then '(select parent.business_id from public.product_variants parent where parent.id = variant_id)'
    when 'stock_movements' then '(select parent.business_id from public.product_variants parent where parent.id = variant_id)'
    when 'inventory_count_items' then '(select parent.business_id from public.inventory_counts parent where parent.id = inventory_count_id)'
    when 'supplier_contacts' then '(select parent.business_id from public.suppliers parent where parent.id = supplier_id)'
    when 'supplier_products' then '(select parent.business_id from public.suppliers parent where parent.id = supplier_id)'
    when 'purchase_order_items' then '(select parent.business_id from public.purchase_orders parent where parent.id = purchase_order_id)'
    when 'purchase_order_payments' then '(select parent.business_id from public.purchase_orders parent where parent.id = purchase_order_id)'
    when 'inbound_parcel_items' then '(select parent.business_id from public.inbound_parcels parent where parent.id = inbound_parcel_id)'
    when 'receiving_sessions' then '(select parent.business_id from public.inbound_parcels parent where parent.id = inbound_parcel_id)'
    when 'receiving_items' then '(select parent.business_id from public.receiving_sessions parent where parent.id = receiving_session_id)'
    when 'supplier_issues' then 'coalesce((select parent.business_id from public.suppliers parent where parent.id = supplier_id),(select parent.business_id from public.purchase_orders parent where parent.id = purchase_order_id))'
    when 'marketplace_accounts' then '(select parent.business_id from public.marketplaces parent where parent.id = marketplace_id)'
    when 'listing_images' then '(select parent.business_id from public.listings parent where parent.id = listing_id)'
    when 'listing_sync_events' then '(select parent.business_id from public.listings parent where parent.id = listing_id)'
    when 'listing_errors' then '(select parent.business_id from public.listings parent where parent.id = listing_id)'
    when 'customer_addresses' then '(select parent.business_id from public.customers parent where parent.id = customer_id)'
    when 'order_items' then '(select parent.business_id from public.orders parent where parent.id = order_id)'
    when 'order_status_events' then '(select parent.business_id from public.orders parent where parent.id = order_id)'
    when 'refunds' then '(select parent.business_id from public.orders parent where parent.id = order_id)'
    when 'returns' then '(select parent.business_id from public.orders parent where parent.id = order_id)'
    when 'return_items' then '(select parent.business_id from public.returns parent where parent.id = return_id)'
    when 'packages' then '(select parent.business_id from public.orders parent where parent.id = order_id)'
    when 'shipments' then '(select parent.business_id from public.orders parent where parent.id = order_id)'
    when 'shipment_events' then '(select parent.business_id from public.shipments parent where parent.id = shipment_id)'
    when 'shipping_labels' then '(select parent.business_id from public.shipments parent where parent.id = shipment_id)'
    when 'payouts' then '(select parent.business_id from public.marketplace_accounts parent where parent.id = marketplace_account_id)'
    when 'expenses' then '(select parent.business_id from public.transactions parent where parent.id = transaction_id)'
    when 'automation_runs' then '(select parent.business_id from public.automation_rules parent where parent.id = automation_rule_id)'
    when 'entity_tags' then '(select parent.business_id from public.tags parent where parent.id = tag_id)'
    when 'opportunities' then '(select parent.business_id from public.imported_source_products parent where parent.id = imported_source_product_id)'
    when 'opportunity_cost_inputs' then '(select parent.business_id from public.opportunities parent where parent.id = opportunity_id)'
    when 'comparable_listings' then '(select parent.business_id from public.opportunities parent where parent.id = opportunity_id)'
    when 'opportunity_analyses' then '(select parent.business_id from public.opportunities parent where parent.id = opportunity_id)'
    when 'insight_evidence' then '(select parent.business_id from public.insights parent where parent.id = insight_id)'
    else null
  end;

  return candidate;
end;
$$;

do $$ declare t text; tenant_expr text; begin
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
    tenant_expr := public.faust_migration_rls_business_id_expression(t);
    if tenant_expr is null then
      raise exception 'No tenant RLS strategy for public.% during completion-domain policy backfill', t;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "tenant read" on public.%I', t);
    execute format('create policy "tenant read" on public.%I for select using (public.is_business_member(%s))', t, tenant_expr);
    execute format('drop policy if exists "tenant write" on public.%I', t);
    execute format('create policy "tenant write" on public.%I for all using (public.has_business_role(%s,array[''owner'',''admin'',''operations'',''finance'',''fulfillment''])) with check (public.has_business_role(%s,array[''owner'',''admin'',''operations'',''finance'',''fulfillment'']))', t, tenant_expr, tenant_expr);
  end loop;
end $$;

do $$ declare t text; tenant_expr text; begin
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
    tenant_expr := public.faust_migration_rls_business_id_expression(t);
    if tenant_expr is null then
      raise exception 'No tenant RLS strategy for public.% during catalog operations policy backfill', t;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "tenant write" on public.%I', t);
    execute format('drop policy if exists "catalog operations write" on public.%I', t);
    execute format('create policy "catalog operations write" on public.%I for all using (public.has_business_role(%s,array[''owner'',''admin'',''operations''])) with check (public.has_business_role(%s,array[''owner'',''admin'',''operations'']))', t, tenant_expr, tenant_expr);
  end loop;

  foreach t in array array[
    'orders','order_items','order_status_events','returns','return_items','packages','shipments','shipment_events',
    'shipping_labels','shipping_presets'
  ] loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    tenant_expr := public.faust_migration_rls_business_id_expression(t);
    if tenant_expr is null then
      raise exception 'No tenant RLS strategy for public.% during fulfillment policy backfill', t;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "tenant write" on public.%I', t);
    execute format('drop policy if exists "fulfillment write" on public.%I', t);
    execute format('create policy "fulfillment write" on public.%I for all using (public.has_business_role(%s,array[''owner'',''admin'',''fulfillment''])) with check (public.has_business_role(%s,array[''owner'',''admin'',''fulfillment'']))', t, tenant_expr, tenant_expr);
  end loop;

  foreach t in array array[
    'financial_accounts','transactions','transaction_categories','payouts','expenses','budgets','tax_reserves','refunds'
  ] loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    tenant_expr := public.faust_migration_rls_business_id_expression(t);
    if tenant_expr is null then
      raise exception 'No tenant RLS strategy for public.% during finance policy backfill', t;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "tenant write" on public.%I', t);
    execute format('drop policy if exists "finance write" on public.%I', t);
    execute format('create policy "finance write" on public.%I for all using (public.has_business_role(%s,array[''owner'',''admin'',''finance''])) with check (public.has_business_role(%s,array[''owner'',''admin'',''finance'']))', t, tenant_expr, tenant_expr);
  end loop;

  foreach t in array array[
    'tasks','notifications','automation_rules','automation_runs','activity_events','attachments','tags','entity_tags',
    'insights','insight_evidence','forecasts','saved_reports','customers','customer_addresses'
  ] loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    tenant_expr := public.faust_migration_rls_business_id_expression(t);
    if tenant_expr is null then
      raise exception 'No tenant RLS strategy for public.% during shared operational policy backfill', t;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "tenant write" on public.%I', t);
    execute format('drop policy if exists "shared operational write" on public.%I', t);
    execute format('create policy "shared operational write" on public.%I for all using (public.has_business_role(%s,array[''owner'',''admin'',''operations'',''finance'',''fulfillment''])) with check (public.has_business_role(%s,array[''owner'',''admin'',''operations'',''finance'',''fulfillment'']))', t, tenant_expr, tenant_expr);
  end loop;
end $$;

drop function if exists public.faust_migration_rls_business_id_expression(text);

notify pgrst, 'reload schema';
