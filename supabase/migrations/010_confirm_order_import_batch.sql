-- Atomic confirmation of an Orders import batch. Any exception rolls back every
-- created customer, order, item, row outcome, activity event, and batch update.
alter table public.order_import_rows add column if not exists error_code text, add column if not exists retryable boolean not null default false, add column if not exists retry_count integer not null default 0, add column if not exists last_attempted_at timestamptz;
create unique index if not exists orders_marketplace_external_order_unique on public.orders(business_id,marketplace,external_order_id) where external_order_id is not null;
create unique index if not exists order_import_rows_order_unique on public.order_import_rows(order_id) where order_id is not null;

create or replace function public.confirm_order_import_batch_transactional(p_business_id uuid, p_batch_id uuid, p_actor_id uuid, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare batch public.order_import_batches%rowtype; row_record public.order_import_rows%rowtype; source jsonb; customer_id uuid; created_order_id uuid; variant public.product_variants%rowtype; imported_count integer:=0; actor uuid:=auth.uid();
begin
  if actor is null or actor<>p_actor_id then raise exception 'Authenticated actor mismatch' using errcode='42501'; end if;
  if not public.has_business_role(p_business_id,array['owner','admin','operations']) then raise exception 'Unauthorized import confirmation' using errcode='42501'; end if;
  select * into batch from public.order_import_batches where id=p_batch_id and business_id=p_business_id for update; if not found then raise exception 'Import batch not found for business' using errcode='P0002'; end if;
  if batch.status='completed' or exists(select 1 from public.activity_events where business_id=p_business_id and entity_type='order_import_batch' and entity_id=p_batch_id and detail='confirm:'||p_idempotency_key) then raise exception 'Import batch has already been confirmed'; end if;
  if batch.status not in ('ready','retryable','failed','partially_failed') then raise exception 'Import batch is not confirmable'; end if;
  if exists(select 1 from public.order_import_rows where batch_id=p_batch_id and status in ('review_required','rejected','cancelled')) then raise exception 'All required import rows must be resolved before confirmation'; end if;
  update public.order_import_batches set status='importing',updated_at=now() where id=p_batch_id;
  for row_record in select * from public.order_import_rows where batch_id=p_batch_id and status in ('accepted','failed') order by row_number for update loop
    source:=row_record.source_values;
    if coalesce(source->>'externalOrderId','')='' or coalesce(source->>'customerName','')='' or coalesce(source->>'sku','')='' then raise exception 'Row % is missing required order, customer, or SKU data',row_record.row_number; end if;
    if exists(select 1 from public.orders where business_id=p_business_id and marketplace=batch.marketplace and external_order_id=source->>'externalOrderId') then raise exception 'Duplicate external order %',source->>'externalOrderId'; end if;
    select id into customer_id from public.customers where business_id=p_business_id and lower(email)=lower(nullif(source->>'email','')) limit 1;
    if customer_id is null then insert into public.customers(business_id,name,email) values(p_business_id,source->>'customerName',nullif(source->>'email','')) returning id into customer_id; end if;
    select * into variant from public.product_variants where business_id=p_business_id and sku=source->>'sku' and active=true limit 1; if not found then raise exception 'Row % has an unresolved SKU',row_record.row_number; end if;
    insert into public.orders(business_id,customer_id,marketplace,external_order_id,status,ordered_at,shipping_charged,marketplace_fees,payment_fees,tax_collected,notes,idempotency_key) values(p_business_id,customer_id,batch.marketplace,source->>'externalOrderId','pending_payment',coalesce(nullif(source->>'orderedAt','')::timestamptz,now()),coalesce((source->>'shippingCharged')::numeric,0),coalesce((source->>'marketplaceFee')::numeric,0),coalesce((source->>'paymentFee')::numeric,0),coalesce((source->>'tax')::numeric,0),'Imported from batch '||p_batch_id,row_record.id::text) returning id into created_order_id;
    insert into public.order_items(business_id,order_id,product_id,variant_id,title,quantity,unit_price,unit_cost,fulfillment_state,return_state,refund_state) values(p_business_id,created_order_id,variant.product_id,variant.id,coalesce(source->>'title',variant.title),(source->>'quantity')::integer,(source->>'unitPrice')::numeric,variant.landed_unit_cost,'unfulfilled','none','none');
    insert into public.order_status_events(business_id,order_id,to_status,actor_id,idempotency_key) values(p_business_id,created_order_id,'pending_payment',actor,'import:'||row_record.id);
    update public.order_import_rows set status='imported',order_id=created_order_id,error=null,error_code=null,retryable=false,last_attempted_at=now(),updated_at=now() where id=row_record.id; imported_count:=imported_count+1;
  end loop;
  update public.order_import_batches set status='completed',accepted_rows=imported_count,rejected_rows=0,unresolved_rows=0,summary=jsonb_build_object('imported_orders',imported_count,'confirmed_at',now()),updated_at=now() where id=p_batch_id;
  insert into public.activity_events(business_id,actor_id,action,entity_type,entity_id,detail) values(p_business_id,actor,'Order import batch confirmed','order_import_batch',p_batch_id,'confirm:'||p_idempotency_key);
  return jsonb_build_object('batch_id',p_batch_id,'status','completed','imported_orders',imported_count);
exception when others then
  raise;
end $$;
revoke all on function public.confirm_order_import_batch_transactional(uuid,uuid,uuid,text) from public;
grant execute on function public.confirm_order_import_batch_transactional(uuid,uuid,uuid,text) to authenticated;
