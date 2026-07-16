-- Finance Phase 2 workflow completion columns.
-- Extends normalized Finance tables with lifecycle, audit, account-flow, scenario, and approval state.

alter table public.transactions
  add column if not exists source_account_id uuid references public.financial_accounts(id) on delete set null,
  add column if not exists destination_account_id uuid references public.financial_accounts(id) on delete set null,
  add column if not exists linked_object_type text,
  add column if not exists linked_object_id uuid,
  add column if not exists audit text[] not null default '{}';

alter table public.finance_expenses
  add column if not exists audit text[] not null default '{}',
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table public.finance_payouts
  add column if not exists audit text[] not null default '{}',
  add column if not exists archived_at timestamptz;

alter table public.finance_payout_reconciliations
  add column if not exists resolution text;

alter table public.finance_budgets
  add column if not exists template_name text,
  add column if not exists rollover_from_budget_id uuid references public.finance_budgets(id) on delete set null,
  add column if not exists audit text[] not null default '{}';

alter table public.finance_tax_reserve_movements
  add column if not exists audit text[] not null default '{}';

alter table public.finance_reinvestment_allocations
  add column if not exists recommendation text,
  add column if not exists approved_at timestamptz,
  add column if not exists approval_history text[] not null default '{}';

alter table public.finance_forecasts
  add column if not exists scenarios jsonb not null default '[]'::jsonb,
  add column if not exists selected_scenario_id text;

create index if not exists transactions_account_flow_idx on public.transactions(business_id,source_account_id,destination_account_id,occurred_at desc);
create index if not exists finance_expenses_lifecycle_idx on public.finance_expenses(business_id,archived_at,deleted_at,expense_date desc);
create index if not exists finance_payouts_lifecycle_idx on public.finance_payouts(business_id,status,archived_at,created_at desc);

create or replace function public.record_finance_activity(p_business_id uuid, p_action text, p_entity_type text, p_entity_id uuid, p_detail text)
returns void language sql security definer set search_path=public as $$
  insert into public.activity_events(business_id,actor_id,action,entity_type,entity_id,detail)
  values(p_business_id,auth.uid(),p_action,p_entity_type,p_entity_id,p_detail);
$$;

revoke all on function public.record_finance_activity(uuid,text,text,uuid,text) from public;
grant execute on function public.record_finance_activity(uuid,text,text,uuid,text) to authenticated;
