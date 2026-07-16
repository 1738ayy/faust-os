-- Faust OS: event-driven automation engine persistence and transactional mutation boundary.
create extension if not exists pgcrypto;

create table if not exists public.automation_rules_v2 (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  enabled boolean not null default false,
  owner_id uuid,
  priority integer not null default 50,
  trigger jsonb not null,
  condition_mode text not null default 'AND' check (condition_mode in ('AND','OR')),
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  schedule jsonb,
  approval_required boolean not null default false,
  approver_role text,
  dry_run boolean not null default true,
  archived_at timestamptz,
  last_run_at timestamptz,
  next_run_at timestamptz,
  run_count integer not null default 0,
  failure_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.automation_runs_v2 (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  rule_id uuid not null references public.automation_rules_v2(id) on delete cascade,
  trigger_type text not null,
  status text not null check (status in ('queued','running','waiting_approval','succeeded','failed','dead_lettered','cancelled','dry_run')),
  idempotency_key text not null,
  event_payload jsonb not null default '{}'::jsonb,
  condition_results jsonb not null default '[]'::jsonb,
  step_ids jsonb not null default '[]'::jsonb,
  duration_ms integer,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique (business_id, idempotency_key)
);

create table if not exists public.automation_steps (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  run_id uuid not null references public.automation_runs_v2(id) on delete cascade,
  action_id text,
  label text not null,
  status text not null,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  next_attempt_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  logs jsonb not null default '[]'::jsonb,
  linked_records jsonb not null default '[]'::jsonb
);

create table if not exists public.automation_approvals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  rule_id uuid not null references public.automation_rules_v2(id) on delete cascade,
  run_id uuid references public.automation_runs_v2(id) on delete cascade,
  action_id text,
  status text not null check (status in ('pending','approved','rejected','expired')),
  approver_role text not null,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decision_by uuid,
  edited_payload jsonb,
  history jsonb not null default '[]'::jsonb
);

create table if not exists public.automation_retries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  run_id uuid not null references public.automation_runs_v2(id) on delete cascade,
  step_id uuid references public.automation_steps(id) on delete set null,
  attempt integer not null,
  run_after timestamptz not null,
  status text not null check (status in ('scheduled','running','succeeded','failed','cancelled')),
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.automation_dead_letters (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  run_id uuid not null references public.automation_runs_v2(id) on delete cascade,
  rule_id uuid not null references public.automation_rules_v2(id) on delete cascade,
  reason text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','retried','cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.automation_templates (
  id text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text not null,
  trigger_type text not null,
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  approval_required boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.automation_idempotency_receipts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  receipt_key text not null,
  rule_id uuid not null references public.automation_rules_v2(id) on delete cascade,
  run_id uuid not null references public.automation_runs_v2(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (business_id, receipt_key)
);

create index if not exists automation_rules_v2_business_idx on public.automation_rules_v2 (business_id, enabled, priority, next_run_at);
create index if not exists automation_runs_v2_business_idx on public.automation_runs_v2 (business_id, rule_id, created_at desc);
create index if not exists automation_steps_run_idx on public.automation_steps (business_id, run_id);
create index if not exists automation_approvals_status_idx on public.automation_approvals (business_id, status, requested_at);
create index if not exists automation_dead_letters_status_idx on public.automation_dead_letters (business_id, status, created_at);

create or replace function public.mutate_automations_transactional(p_business_id uuid, p_action text, p_payload jsonb, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_rule_id uuid;
  v_run_id uuid;
begin
  if not public.has_business_role(p_business_id, array['owner','admin']) then
    raise exception 'Automation permission denied';
  end if;

  if p_action = 'create-rule' then
    insert into public.automation_rules_v2 (business_id, name, description, enabled, priority, trigger, condition_mode, conditions, actions, schedule, approval_required, approver_role, dry_run, next_run_at)
    values (
      p_business_id,
      coalesce(p_payload->>'name', 'Automation rule'),
      p_payload->>'description',
      coalesce((p_payload->>'enabled')::boolean, false),
      coalesce((p_payload->>'priority')::integer, 50),
      jsonb_build_object('type', coalesce(p_payload->>'triggerType', 'inventory.stock_below_reorder_point'), 'samplePayload', coalesce(p_payload->'samplePayload', '{}'::jsonb)),
      coalesce(p_payload->>'conditionMode', 'AND'),
      coalesce(p_payload->'conditions', '[]'::jsonb),
      coalesce(p_payload->'actions', '[]'::jsonb),
      coalesce(p_payload->'schedule', '{"frequency":"daily","timezone":"America/New_York"}'::jsonb),
      coalesce((p_payload->>'approvalRequired')::boolean, false),
      p_payload->>'approverRole',
      coalesce((p_payload->>'dryRun')::boolean, true),
      now() + interval '1 day'
    )
    returning id into v_rule_id;
    return jsonb_build_object('id', v_rule_id);
  elsif p_action in ('enable-rule','disable-rule','archive-rule') then
    v_rule_id := (p_payload->>'ruleId')::uuid;
    update public.automation_rules_v2
      set enabled = case when p_action = 'enable-rule' then true when p_action = 'disable-rule' then false else enabled end,
          archived_at = case when p_action = 'archive-rule' then now() else archived_at end,
          updated_at = now()
      where business_id = p_business_id and id = v_rule_id;
    return jsonb_build_object('id', v_rule_id, 'action', p_action);
  else
    v_rule_id := coalesce((p_payload->>'ruleId')::uuid, gen_random_uuid());
    insert into public.automation_runs_v2 (business_id, rule_id, trigger_type, status, idempotency_key, event_payload, condition_results, step_ids, started_at, finished_at)
    values (p_business_id, v_rule_id, coalesce(p_payload->>'triggerType', 'schedule'), 'queued', p_idempotency_key, coalesce(p_payload->'samplePayload', '{}'::jsonb), '[]'::jsonb, '[]'::jsonb, now(), now())
    on conflict (business_id, idempotency_key) do update set idempotency_key = excluded.idempotency_key
    returning id into v_run_id;
    return jsonb_build_object('id', v_run_id, 'ruleId', v_rule_id, 'action', p_action);
  end if;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['automation_rules_v2','automation_runs_v2','automation_steps','automation_approvals','automation_retries','automation_dead_letters','automation_templates','automation_idempotency_receipts'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "%s read" on public.%I', table_name, table_name);
    execute format('create policy "%s read" on public.%I for select using (public.is_business_member(business_id))', table_name, table_name);
    execute format('drop policy if exists "%s write" on public.%I', table_name, table_name);
    execute format('create policy "%s write" on public.%I for all using (public.has_business_role(business_id, array[''owner'',''admin''])) with check (public.has_business_role(business_id, array[''owner'',''admin'']))', table_name, table_name);
  end loop;
end $$;
