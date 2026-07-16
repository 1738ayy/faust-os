-- Faust OS: Automations Phase 2 runtime, event receipts, worker state, and production template metadata.
create extension if not exists pgcrypto;

alter table public.automation_rules_v2 add column if not exists version integer not null default 1;
alter table public.automation_rules_v2 add column if not exists template_id text;
alter table public.automation_rules_v2 add column if not exists template_version integer;
alter table public.automation_rules_v2 add column if not exists local_overrides jsonb not null default '[]'::jsonb;

alter table public.automation_runs_v2 add column if not exists queue_delay_ms integer;
alter table public.automation_runs_v2 add column if not exists worker_id text;
alter table public.automation_runs_v2 add column if not exists trace_id text;
alter table public.automation_runs_v2 add column if not exists correlation_id text;
alter table public.automation_runs_v2 add column if not exists rule_version integer;

alter table public.automation_approvals drop constraint if exists automation_approvals_status_check;
alter table public.automation_approvals add constraint automation_approvals_status_check check (status in ('pending','approved','rejected','expired','escalated'));
alter table public.automation_approvals add column if not exists requested_by text;
alter table public.automation_approvals add column if not exists reason text;
alter table public.automation_approvals add column if not exists linked_records jsonb not null default '[]'::jsonb;
alter table public.automation_approvals add column if not exists proposed_action text;
alter table public.automation_approvals add column if not exists before_value jsonb;
alter table public.automation_approvals add column if not exists after_value jsonb;
alter table public.automation_approvals add column if not exists expires_at timestamptz;
alter table public.automation_approvals add column if not exists escalation_at timestamptz;

alter table public.automation_templates add column if not exists template_version integer not null default 1;
alter table public.automation_templates add column if not exists thresholds jsonb not null default '{}'::jsonb;
alter table public.automation_templates add column if not exists updated_at timestamptz;

create table if not exists public.automation_event_receipts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  event_id text not null,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null check (status in ('pending','matched','ignored','processed','failed')),
  run_ids jsonb not null default '[]'::jsonb,
  idempotency_key text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (business_id, idempotency_key)
);

create table if not exists public.automation_worker_leases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  worker_id text not null,
  resource_type text not null check (resource_type in ('outbox','schedule','retry','dead_letter','stale_run')),
  resource_id text not null,
  status text not null default 'active' check (status in ('active','released','expired')),
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz
);

create table if not exists public.automation_worker_heartbeats (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  worker_id text not null,
  status text not null check (status in ('starting','healthy','draining','stopped','failed')),
  concurrency integer not null default 4,
  polling_interval_ms integer not null default 5000,
  lease_timeout_ms integer not null default 30000,
  last_beat_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  stopped_at timestamptz,
  detail text
);

create table if not exists public.automation_execution_traces (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  run_id uuid not null references public.automation_runs_v2(id) on delete cascade,
  worker_id text,
  correlation_id text not null,
  level text not null check (level in ('info','warning','error')),
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists automation_event_receipts_type_idx on public.automation_event_receipts (business_id, event_type, received_at desc);
create index if not exists automation_worker_leases_active_idx on public.automation_worker_leases (business_id, status, expires_at);
create index if not exists automation_worker_heartbeats_worker_idx on public.automation_worker_heartbeats (business_id, worker_id, last_beat_at desc);
create index if not exists automation_execution_traces_run_idx on public.automation_execution_traces (business_id, run_id, created_at desc);

create or replace function public.mutate_automations_transactional(p_business_id uuid, p_action text, p_payload jsonb, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_rule_id uuid;
  v_run_id uuid;
  v_receipt_id uuid;
  v_dead_id uuid;
  v_template_id text;
begin
  if not public.has_business_role(p_business_id, array['owner','admin']) then
    raise exception 'Automation permission denied';
  end if;

  if p_action in ('create-rule','install-template') then
    v_template_id := nullif(p_payload->>'templateId', '');
    insert into public.automation_rules_v2 (
      business_id, name, description, enabled, owner_id, priority, version, template_id, template_version, local_overrides,
      trigger, condition_mode, conditions, actions, schedule, approval_required, approver_role, dry_run, next_run_at, updated_at
    )
    values (
      p_business_id,
      coalesce(p_payload->>'name', p_payload->>'templateId', 'Automation rule'),
      p_payload->>'description',
      coalesce((p_payload->>'enabled')::boolean, false),
      auth.uid(),
      coalesce((p_payload->>'priority')::integer, 50),
      1,
      v_template_id,
      2,
      case when p_payload ? 'threshold' then '["threshold"]'::jsonb else '[]'::jsonb end,
      jsonb_build_object('type', coalesce(p_payload->>'triggerType', 'inventory.below_reorder_point'), 'samplePayload', coalesce(p_payload->'samplePayload', '{}'::jsonb)),
      coalesce(p_payload->>'conditionMode', 'AND'),
      coalesce(p_payload->'conditions', '[]'::jsonb),
      coalesce(p_payload->'actions', '[]'::jsonb),
      coalesce(p_payload->'schedule', jsonb_build_object('frequency','daily','timezone','America/New_York','businessHoursOnly',true,'missedRunPolicy','run_once')),
      coalesce((p_payload->>'approvalRequired')::boolean, false),
      p_payload->>'approverRole',
      coalesce((p_payload->>'dryRun')::boolean, true),
      now() + interval '1 day',
      now()
    )
    returning id into v_rule_id;
    return jsonb_build_object('id', v_rule_id, 'action', p_action);
  elsif p_action in ('enable-rule','disable-rule','archive-rule','pause-schedule','resume-schedule') then
    v_rule_id := (p_payload->>'ruleId')::uuid;
    update public.automation_rules_v2
      set enabled = case when p_action = 'enable-rule' then true when p_action = 'disable-rule' then false else enabled end,
          archived_at = case when p_action = 'archive-rule' then now() else archived_at end,
          schedule = case
            when p_action = 'pause-schedule' then jsonb_set(coalesce(schedule, '{}'::jsonb), '{paused}', 'true'::jsonb, true)
            when p_action = 'resume-schedule' then jsonb_set(coalesce(schedule, '{}'::jsonb), '{paused}', 'false'::jsonb, true)
            else schedule
          end,
          updated_at = now()
      where business_id = p_business_id and id = v_rule_id;
    return jsonb_build_object('id', v_rule_id, 'action', p_action);
  elsif p_action = 'trigger-event' then
    insert into public.automation_event_receipts (business_id, event_id, event_type, aggregate_type, aggregate_id, payload, status, run_ids, idempotency_key, processed_at)
    values (
      p_business_id,
      coalesce(p_payload->'samplePayload'->>'id', gen_random_uuid()::text),
      coalesce(p_payload->>'triggerType', 'inventory.below_reorder_point'),
      coalesce(p_payload->'samplePayload'->>'aggregateType', split_part(coalesce(p_payload->>'triggerType', 'inventory'), '.', 1)),
      coalesce(p_payload->'samplePayload'->>'aggregateId', 'unknown'),
      coalesce(p_payload->'samplePayload', '{}'::jsonb),
      'processed',
      '[]'::jsonb,
      p_idempotency_key,
      now()
    )
    on conflict (business_id, idempotency_key) do update set processed_at = public.automation_event_receipts.processed_at
    returning id into v_receipt_id;
    return jsonb_build_object('id', v_receipt_id, 'action', p_action);
  elsif p_action = 'worker-tick' then
    insert into public.automation_worker_heartbeats (business_id, worker_id, status, concurrency, polling_interval_ms, lease_timeout_ms, detail)
    values (p_business_id, coalesce(p_payload->>'workerId', 'supabase-worker'), 'healthy', coalesce((p_payload->>'concurrency')::integer, 4), coalesce((p_payload->>'pollingIntervalMs')::integer, 5000), coalesce((p_payload->>'leaseTimeoutMs')::integer, 30000), 'RPC worker tick processed.')
    returning id into v_receipt_id;
    return jsonb_build_object('id', v_receipt_id, 'action', p_action);
  elsif p_action = 'replay-dead-letter' then
    v_dead_id := (p_payload->>'deadLetterId')::uuid;
    update public.automation_dead_letters set status = 'retried', resolved_at = now() where business_id = p_business_id and id = v_dead_id;
    return jsonb_build_object('id', v_dead_id, 'action', p_action);
  else
    v_rule_id := coalesce((p_payload->>'ruleId')::uuid, gen_random_uuid());
    insert into public.automation_runs_v2 (business_id, rule_id, trigger_type, status, idempotency_key, event_payload, condition_results, step_ids, queue_delay_ms, worker_id, trace_id, correlation_id, rule_version, started_at, finished_at)
    values (p_business_id, v_rule_id, coalesce(p_payload->>'triggerType', 'schedule'), 'queued', p_idempotency_key, coalesce(p_payload->'samplePayload', '{}'::jsonb), '[]'::jsonb, '[]'::jsonb, 0, coalesce(p_payload->>'workerId','rpc'), gen_random_uuid()::text, gen_random_uuid()::text, 1, now(), now())
    on conflict (business_id, idempotency_key) do update set idempotency_key = excluded.idempotency_key
    returning id into v_run_id;
    return jsonb_build_object('id', v_run_id, 'ruleId', v_rule_id, 'action', p_action);
  end if;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['automation_event_receipts','automation_worker_leases','automation_worker_heartbeats','automation_execution_traces'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "%s read" on public.%I', table_name, table_name);
    execute format('create policy "%s read" on public.%I for select using (public.is_business_member(business_id))', table_name, table_name);
    execute format('drop policy if exists "%s write" on public.%I', table_name, table_name);
    execute format('create policy "%s write" on public.%I for all using (public.has_business_role(business_id, array[''owner'',''admin''])) with check (public.has_business_role(business_id, array[''owner'',''admin'']))', table_name, table_name);
  end loop;
end $$;
