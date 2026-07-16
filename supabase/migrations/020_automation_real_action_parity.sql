-- Faust OS: Automations final parity pass.
-- Expands the production RPC from generic queued placeholders into normalized action execution records.
create extension if not exists pgcrypto;

create or replace function public.mutate_automations_transactional(p_business_id uuid, p_action text, p_payload jsonb, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_rule_id uuid;
  v_run_id uuid;
  v_step_id uuid;
  v_task_id uuid;
  v_event_id uuid;
  v_job_id uuid;
  v_notice_id uuid;
  v_subject_id uuid;
  v_result jsonb := '{}'::jsonb;
begin
  if not public.has_business_role(p_business_id, array['owner','admin']) then
    raise exception 'Automation permission denied';
  end if;

  if p_action in ('create-rule','install-template') then
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
      nullif(p_payload->>'templateId', ''),
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
    v_result := jsonb_build_object('id', v_rule_id, 'action', p_action);
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
    v_result := jsonb_build_object('id', v_rule_id, 'action', p_action);
  elsif p_action = 'trigger-event' then
    insert into public.automation_event_receipts (business_id, event_id, event_type, aggregate_type, aggregate_id, payload, status, run_ids, idempotency_key, processed_at)
    values (p_business_id, coalesce(p_payload->'samplePayload'->>'id', gen_random_uuid()::text), coalesce(p_payload->>'triggerType', 'inventory.below_reorder_point'), coalesce(p_payload->'samplePayload'->>'aggregateType', split_part(coalesce(p_payload->>'triggerType', 'inventory'), '.', 1)), coalesce(p_payload->'samplePayload'->>'aggregateId', 'unknown'), coalesce(p_payload->'samplePayload', '{}'::jsonb), 'processed', '[]'::jsonb, p_idempotency_key, now())
    on conflict (business_id, idempotency_key) do update set processed_at = public.automation_event_receipts.processed_at
    returning id into v_subject_id;
    v_result := jsonb_build_object('id', v_subject_id, 'action', p_action);
  elsif p_action = 'worker-tick' then
    insert into public.automation_worker_heartbeats (business_id, worker_id, status, concurrency, polling_interval_ms, lease_timeout_ms, detail)
    values (p_business_id, coalesce(p_payload->>'workerId', 'supabase-worker'), 'healthy', coalesce((p_payload->>'concurrency')::integer, 4), coalesce((p_payload->>'pollingIntervalMs')::integer, 5000), coalesce((p_payload->>'leaseTimeoutMs')::integer, 30000), 'RPC worker tick processed.')
    returning id into v_subject_id;
    v_result := jsonb_build_object('id', v_subject_id, 'action', p_action);
  elsif p_action = 'replay-dead-letter' then
    update public.automation_dead_letters set status = 'retried', resolved_at = now() where business_id = p_business_id and id = (p_payload->>'deadLetterId')::uuid returning id into v_subject_id;
    v_result := jsonb_build_object('id', v_subject_id, 'action', p_action);
  else
    v_rule_id := coalesce(nullif(p_payload->>'ruleId','')::uuid, gen_random_uuid());
    insert into public.automation_runs_v2 (business_id, rule_id, trigger_type, status, idempotency_key, event_payload, condition_results, step_ids, queue_delay_ms, worker_id, trace_id, correlation_id, rule_version, started_at)
    values (p_business_id, v_rule_id, coalesce(p_payload->>'triggerType', p_action), 'running', p_idempotency_key, coalesce(p_payload->'samplePayload', p_payload, '{}'::jsonb), '[]'::jsonb, '[]'::jsonb, 0, coalesce(p_payload->>'workerId','rpc'), gen_random_uuid()::text, gen_random_uuid()::text, 1, now())
    on conflict (business_id, idempotency_key) do update set idempotency_key = excluded.idempotency_key
    returning id into v_run_id;

    insert into public.automation_steps (business_id, run_id, action_id, label, status, attempts, max_attempts, started_at, logs, linked_records)
    values (p_business_id, v_run_id, p_action, replace(p_action, '-', ' '), 'running', 1, 3, now(), '[]'::jsonb, '[]'::jsonb)
    returning id into v_step_id;

    if p_action in ('reserve_inventory','release_reservation','place_order_on_hold','release_order_hold','add_order_tag','queue_refund_approval','queue_return_review','create_negative_margin_review') then
      insert into public.tasks (business_id, title, priority, status, entity_type, entity_id)
      values (p_business_id, replace(p_action, '_', ' '), 'high', 'open', 'order', nullif(p_payload->>'orderId','')::uuid)
      returning id into v_task_id;
      v_result := jsonb_build_object('taskId', v_task_id);
    elsif p_action in ('create_reorder_recommendation','draft_purchase_order','request_po_approval','update_supplier_lead_time','open_supplier_review_task') then
      insert into public.tasks (business_id, title, priority, status, entity_type)
      values (p_business_id, replace(p_action, '_', ' '), 'high', 'open', 'purchase_order')
      returning id into v_task_id;
      v_result := jsonb_build_object('taskId', v_task_id);
    elsif p_action in ('queue_quantity_sync','queue_sibling_delist','retry_listing_sync','pause_listing','place_listing_risk_lock','release_listing_risk_lock','place_sku_risk_lock','release_risk_lock') then
      insert into public.transactional_outbox_events (business_id, topic, aggregate_type, aggregate_id, payload, idempotency_key)
      values (p_business_id, 'channel.inventory.sync_requested', 'automation_run', v_run_id, p_payload, p_idempotency_key)
      on conflict do nothing
      returning id into v_event_id;
      insert into public.durable_jobs (business_id, queue, event_id, status, payload, run_after)
      values (p_business_id, 'channel_sync', v_event_id, 'queued', p_payload, now())
      returning id into v_job_id;
      v_result := jsonb_build_object('eventId', v_event_id, 'jobId', v_job_id);
    elsif p_action in ('create_fulfillment_exception','increase_fulfillment_priority','assign_fulfillment','place_shipment_hold','release_shipment_hold','enqueue_tracking_refresh') then
      insert into public.tasks (business_id, title, priority, status, entity_type, entity_id)
      values (p_business_id, replace(p_action, '_', ' '), 'high', 'open', 'fulfillment_shipment', nullif(p_payload->>'shipmentId','')::uuid)
      returning id into v_task_id;
      v_result := jsonb_build_object('taskId', v_task_id);
    elsif p_action in ('create_expense','create_payout_reconciliation_task','simulate_reinvestment_allocation','move_tax_reserve','update_budget_alert') then
      insert into public.tasks (business_id, title, priority, status, entity_type)
      values (p_business_id, replace(p_action, '_', ' '), 'high', 'open', 'finance')
      returning id into v_task_id;
      v_result := jsonb_build_object('taskId', v_task_id);
    elsif p_action in ('run_saved_report','trigger_forecast_refresh','create_kpi_alert','create_dead_stock_review') then
      insert into public.analytics_report_runs (business_id, report_id, status, filters, exported_row_count, created_at, completed_at)
      select p_business_id, id, 'completed', '{}'::jsonb, 0, now(), now()
      from public.analytics_saved_reports
      where business_id = p_business_id
      order by created_at desc
      limit 1
      returning id into v_subject_id;
      if v_subject_id is null then
        insert into public.tasks (business_id, title, priority, status, entity_type) values (p_business_id, replace(p_action, '_', ' '), 'high', 'open', 'analytics') returning id into v_subject_id;
      end if;
      v_result := jsonb_build_object('id', v_subject_id);
    else
      insert into public.durable_jobs (business_id, queue, status, payload, run_after)
      values (p_business_id, 'inventory_risk', 'queued', p_payload || jsonb_build_object('action', p_action), now())
      returning id into v_job_id;
      v_result := jsonb_build_object('jobId', v_job_id);
    end if;

    insert into public.notifications (business_id, severity, category, title, detail, href)
    values (p_business_id, 'info', 'system', 'Automation action executed', p_action, '/automations')
    returning id into v_notice_id;
    insert into public.activity_events (business_id, actor_id, action, entity_type, entity_id, detail, after_value)
    values (p_business_id, auth.uid(), 'Automation action executed', 'automation_run', v_run_id, p_action, v_result);
    update public.automation_steps set status = 'succeeded', finished_at = now(), linked_records = jsonb_build_array(v_result) where id = v_step_id;
    update public.automation_runs_v2 set status = 'succeeded', finished_at = now(), step_ids = jsonb_build_array(v_step_id) where id = v_run_id;
    v_result := v_result || jsonb_build_object('runId', v_run_id, 'stepId', v_step_id, 'notificationId', v_notice_id, 'action', p_action);
  end if;

  return v_result;
end;
$$;
