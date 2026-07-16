-- Finance operating ledger and cash-management persistence.
-- Adds normalized tenant tables plus one targeted transactional mutation boundary.

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  account_type text not null,
  currency text not null default 'USD',
  opening_balance numeric not null default 0,
  current_balance numeric not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category_type text not null,
  parent_id uuid references public.finance_categories(id) on delete set null,
  tax_deductible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id,name)
);

alter table public.transactions
  add column if not exists transaction_type text,
  add column if not exists account_id uuid references public.financial_accounts(id) on delete set null,
  add column if not exists order_item_id uuid references public.order_items(id) on delete set null,
  add column if not exists payout_id uuid,
  add column if not exists expense_id uuid,
  add column if not exists source_type text,
  add column if not exists source_id uuid,
  add column if not exists external_id text,
  add column if not exists idempotency_key text;

create table if not exists public.finance_payouts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  marketplace text not null,
  account_id uuid references public.financial_accounts(id) on delete set null,
  status text not null default 'expected',
  expected_amount numeric not null default 0,
  actual_amount numeric,
  fees numeric not null default 0,
  adjustments numeric not null default 0,
  order_ids uuid[] not null default '{}',
  transaction_ids uuid[] not null default '{}',
  expected_at timestamptz,
  received_at timestamptz,
  external_payout_id text,
  discrepancy_amount numeric,
  notes text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id,idempotency_key)
);

create table if not exists public.finance_payout_reconciliations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  payout_id uuid not null references public.finance_payouts(id) on delete cascade,
  status text not null default 'open',
  expected_amount numeric not null default 0,
  actual_amount numeric not null default 0,
  discrepancy_amount numeric not null default 0,
  included_order_ids uuid[] not null default '{}',
  fee_transaction_ids uuid[] not null default '{}',
  adjustment_transaction_ids uuid[] not null default '{}',
  audit text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  vendor text not null,
  category text not null,
  amount numeric not null check(amount >= 0),
  expense_date date not null,
  recurring text not null default 'none',
  tax_deductible boolean not null default false,
  receipt_status text not null default 'pending_attachment',
  supplier_id uuid references public.suppliers(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  notes text,
  transaction_id uuid references public.transactions(id) on delete set null,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id,idempotency_key)
);

create table if not exists public.finance_budgets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  budget_month text not null,
  category text not null,
  amount numeric not null check(amount >= 0),
  actual_amount numeric not null default 0,
  remaining_amount numeric not null default 0,
  alert_threshold numeric not null default 0.85,
  status text not null default 'on_track',
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id,budget_month,category),
  unique(business_id,idempotency_key)
);

create table if not exists public.finance_tax_reserve_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  amount numeric not null,
  basis_amount numeric not null default 0,
  rate numeric not null default 0,
  source_type text not null,
  source_id uuid not null,
  status text not null default 'reserved',
  notes text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique(business_id,idempotency_key)
);

create table if not exists public.finance_reinvestment_allocations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  target text not null,
  percentage numeric not null default 0 check(percentage >= 0),
  amount numeric not null default 0,
  basis text not null default 'deployable_cash',
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id,target),
  unique(business_id,idempotency_key)
);

create table if not exists public.finance_forecasts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  period text not null,
  revenue numeric not null default 0,
  contribution_profit numeric not null default 0,
  operating_profit numeric not null default 0,
  cash numeric not null default 0,
  inventory_purchasing numeric not null default 0,
  payouts numeric not null default 0,
  stockouts integer not null default 0,
  reorder_costs numeric not null default 0,
  confidence numeric not null default 0,
  assumptions text[] not null default '{}',
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id,period),
  unique(business_id,idempotency_key)
);

create table if not exists public.finance_mutation_receipts (
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

do $$ declare t text; begin foreach t in array array['financial_accounts','finance_categories','finance_payouts','finance_payout_reconciliations','finance_expenses','finance_budgets','finance_tax_reserve_movements','finance_reinvestment_allocations','finance_forecasts','finance_mutation_receipts'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists "tenant read" on public.%I',t);
  execute format('create policy "tenant read" on public.%I for select using (public.is_business_member(business_id))',t);
  execute format('drop policy if exists "finance write" on public.%I',t);
  execute format('create policy "finance write" on public.%I for all using (public.has_business_role(business_id,array[''owner'',''admin'',''finance''])) with check (public.has_business_role(business_id,array[''owner'',''admin'',''finance'']))',t);
end loop; end $$;

create index if not exists transactions_finance_idx on public.transactions(business_id,transaction_type,occurred_at desc);
create index if not exists finance_payouts_status_idx on public.finance_payouts(business_id,status,expected_at desc);
create index if not exists finance_expenses_date_idx on public.finance_expenses(business_id,expense_date desc);
create index if not exists finance_budgets_month_idx on public.finance_budgets(business_id,budget_month,category);
create index if not exists finance_forecasts_period_idx on public.finance_forecasts(business_id,period);

create or replace function public.mutate_finance_transactional(p_business_id uuid, p_action text, p_payload jsonb, p_idempotency_key text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  actor uuid := auth.uid();
  key text := coalesce(p_idempotency_key, gen_random_uuid()::text);
  receipt public.finance_mutation_receipts%rowtype;
  entity_id uuid;
  transaction_id uuid;
  expected numeric;
  actual numeric;
  discrepancy numeric;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.has_business_role(p_business_id,array['owner','admin','finance']) then raise exception 'Unauthorized finance mutation' using errcode='42501'; end if;
  select * into receipt from public.finance_mutation_receipts where business_id=p_business_id and idempotency_key=key;
  if found then return receipt.result || jsonb_build_object('idempotent',true); end if;

  if p_action='recordExpense' then
    insert into public.transactions(business_id,transaction_type,category,amount,status,occurred_at,description,source_type,idempotency_key)
    values(p_business_id,'expense',p_payload->>'category',-(p_payload->>'amount')::numeric,coalesce(p_payload->>'status','cleared'),coalesce((p_payload->>'date')::timestamptz,now()),coalesce(p_payload->>'notes',p_payload->>'vendor'),'expense',key||':tx') returning id into transaction_id;
    insert into public.finance_expenses(business_id,vendor,category,amount,expense_date,recurring,tax_deductible,receipt_status,supplier_id,order_id,notes,transaction_id,idempotency_key)
    values(p_business_id,p_payload->>'vendor',p_payload->>'category',(p_payload->>'amount')::numeric,coalesce((p_payload->>'date')::date,current_date),coalesce(p_payload->>'recurring','none'),coalesce((p_payload->>'tax_deductible')::boolean,false),coalesce(p_payload->>'receipt_status','pending_attachment'),nullif(p_payload->>'supplier_id','')::uuid,nullif(p_payload->>'order_id','')::uuid,p_payload->>'notes',transaction_id,key) returning id into entity_id;

  elsif p_action='recordPayout' then
    expected := (p_payload->>'expected_amount')::numeric; actual := coalesce((p_payload->>'actual_amount')::numeric,expected); discrepancy := actual - expected;
    insert into public.finance_payouts(business_id,marketplace,status,expected_amount,actual_amount,fees,adjustments,order_ids,transaction_ids,expected_at,received_at,external_payout_id,discrepancy_amount,notes,idempotency_key)
    values(p_business_id,p_payload->>'marketplace',case when discrepancy=0 then 'reconciled' else 'discrepancy' end,expected,actual,coalesce((p_payload->>'fees')::numeric,0),coalesce((p_payload->>'adjustments')::numeric,0),coalesce(array(select jsonb_array_elements_text(p_payload->'order_ids')::uuid),'{}'::uuid[]),'{}'::uuid[],nullif(p_payload->>'expected_at','')::timestamptz,coalesce(nullif(p_payload->>'received_at','')::timestamptz,now()),p_payload->>'external_payout_id',discrepancy,p_payload->>'notes',key) returning id into entity_id;
    insert into public.transactions(business_id,transaction_type,payout_id,category,amount,status,occurred_at,description,source_type,source_id,idempotency_key)
    values(p_business_id,'payout',entity_id,'Payout',actual,'cleared',now(),'Marketplace payout received','payout',entity_id,key||':tx') returning id into transaction_id;
    insert into public.finance_payout_reconciliations(business_id,payout_id,status,expected_amount,actual_amount,discrepancy_amount,included_order_ids,audit)
    values(p_business_id,entity_id,case when discrepancy=0 then 'matched' else 'discrepancy' end,expected,actual,discrepancy,coalesce(array(select jsonb_array_elements_text(p_payload->'order_ids')::uuid),'{}'::uuid[]),array[now()::text||': Payout reconciled transactionally']);

  elsif p_action='upsertBudget' then
    insert into public.finance_budgets(business_id,budget_month,category,amount,actual_amount,remaining_amount,alert_threshold,status,idempotency_key)
    values(p_business_id,p_payload->>'month',p_payload->>'category',(p_payload->>'amount')::numeric,coalesce((p_payload->>'actual_amount')::numeric,0),(p_payload->>'amount')::numeric-coalesce((p_payload->>'actual_amount')::numeric,0),coalesce((p_payload->>'alert_threshold')::numeric,0.85),'on_track',key)
    on conflict (business_id,budget_month,category) do update set amount=excluded.amount, actual_amount=excluded.actual_amount, remaining_amount=excluded.remaining_amount, updated_at=now()
    returning id into entity_id;

  elsif p_action='reserveTax' then
    insert into public.finance_tax_reserve_movements(business_id,amount,basis_amount,rate,source_type,source_id,status,notes,idempotency_key)
    values(p_business_id,(p_payload->>'amount')::numeric,(p_payload->>'basis_amount')::numeric,(p_payload->>'rate')::numeric,p_payload->>'source_type',(p_payload->>'source_id')::uuid,'reserved',p_payload->>'notes',key) returning id into entity_id;
  else
    raise exception 'Unknown finance action %',p_action;
  end if;

  insert into public.activity_events(business_id,actor_id,action,entity_type,entity_id,detail) values(p_business_id,actor,'Finance '||p_action,'finance',entity_id,coalesce(p_payload->>'notes',p_action));
  insert into public.finance_mutation_receipts(business_id,idempotency_key,action,entity_type,entity_id,result) values(p_business_id,key,p_action,'finance',entity_id,jsonb_build_object('idempotent',false,'action',p_action,'entity_id',entity_id));
  return jsonb_build_object('idempotent',false,'action',p_action,'entity_id',entity_id);
end $$;

revoke all on function public.mutate_finance_transactional(uuid,text,jsonb,text) from public;
grant execute on function public.mutate_finance_transactional(uuid,text,jsonb,text) to authenticated;
