-- Faust OS: AI Center operating assistant.
-- Normalizes grounded conversations, evidence, recommendations, scenarios, approvals, feedback, and observability.
create extension if not exists pgcrypto;

create table if not exists public.ai_conversations (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, title text not null, provider text not null default 'deterministic', status text not null default 'active', message_ids jsonb not null default '[]', saved_question_ids jsonb not null default '[]', created_at timestamptz not null default now(), updated_at timestamptz);
create table if not exists public.ai_messages (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, conversation_id uuid references public.ai_conversations(id) on delete cascade, role text not null, content text not null, provider text not null default 'deterministic', grounded boolean not null default true, evidence_ids jsonb not null default '[]', tool_call_ids jsonb not null default '[]', recommendation_ids jsonb not null default '[]', scenario_ids jsonb not null default '[]', created_at timestamptz not null default now());
create table if not exists public.ai_saved_questions (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, question text not null, category text not null default 'general', created_at timestamptz not null default now(), last_asked_at timestamptz, unique (business_id, question));
create table if not exists public.ai_tool_calls (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, conversation_id uuid, message_id uuid, tool_name text not null, input jsonb not null default '{}', output_summary text not null default '', evidence_ids jsonb not null default '[]', status text not null default 'succeeded', latency_ms integer not null default 0, error text, created_at timestamptz not null default now());
create table if not exists public.ai_recommendations (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, recommendation_type text not null, title text not null, recommendation text not null, reasoning text not null, assumptions jsonb not null default '[]', confidence numeric not null default 0, expected_impact text not null default '', risk text not null default '', approval_required boolean not null default false, linked_action jsonb, evidence_ids jsonb not null default '[]', status text not null default 'proposed', created_at timestamptz not null default now(), updated_at timestamptz);
create table if not exists public.ai_evidence_links (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, source_type text not null, source_id text not null, label text not null, href text not null, excerpt text not null, confidence numeric not null default 0.75, created_at timestamptz not null default now(), unique (business_id, source_type, source_id, label));
create table if not exists public.ai_scenarios (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, name text not null, prompt text not null, inputs jsonb not null default '{}', impacts jsonb not null default '{}', assumptions jsonb not null default '[]', confidence numeric not null default 0, evidence_ids jsonb not null default '[]', created_at timestamptz not null default now());
create table if not exists public.ai_daily_briefs (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, brief_date date not null, provider text not null default 'deterministic', mode text not null default 'deterministic', sections jsonb not null default '[]', recommendation_ids jsonb not null default '[]', created_at timestamptz not null default now());
create table if not exists public.ai_approval_proposals (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, recommendation_id uuid references public.ai_recommendations(id) on delete cascade, automation_approval_id uuid, action_type text not null, payload jsonb not null default '{}', status text not null default 'pending', requested_by text, reason text not null, created_at timestamptz not null default now(), updated_at timestamptz);
create table if not exists public.ai_feedback (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, message_id uuid, recommendation_id uuid, rating text not null, comment text, created_at timestamptz not null default now());
create table if not exists public.ai_observability_events (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, provider text not null default 'deterministic', model text, latency_ms integer not null default 0, token_usage jsonb, estimated_cost_usd numeric not null default 0, tool_call_ids jsonb not null default '[]', error text, retry_count integer not null default 0, confidence numeric not null default 0, created_at timestamptz not null default now());

create index if not exists ai_conversations_business_idx on public.ai_conversations(business_id, created_at desc);
create index if not exists ai_messages_business_conversation_idx on public.ai_messages(business_id, conversation_id, created_at);
create index if not exists ai_recommendations_business_status_idx on public.ai_recommendations(business_id, status, created_at desc);
create index if not exists ai_evidence_links_business_source_idx on public.ai_evidence_links(business_id, source_type, source_id);
create index if not exists ai_scenarios_business_idx on public.ai_scenarios(business_id, created_at desc);
create index if not exists ai_daily_briefs_business_date_idx on public.ai_daily_briefs(business_id, brief_date desc);
create index if not exists ai_approval_proposals_business_status_idx on public.ai_approval_proposals(business_id, status, created_at desc);
create index if not exists ai_observability_business_idx on public.ai_observability_events(business_id, created_at desc);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_saved_questions enable row level security;
alter table public.ai_tool_calls enable row level security;
alter table public.ai_recommendations enable row level security;
alter table public.ai_evidence_links enable row level security;
alter table public.ai_scenarios enable row level security;
alter table public.ai_daily_briefs enable row level security;
alter table public.ai_approval_proposals enable row level security;
alter table public.ai_feedback enable row level security;
alter table public.ai_observability_events enable row level security;

do $$
declare t text;
begin
  foreach t in array array['ai_conversations','ai_messages','ai_saved_questions','ai_tool_calls','ai_recommendations','ai_evidence_links','ai_scenarios','ai_daily_briefs','ai_approval_proposals','ai_feedback','ai_observability_events'] loop
    execute format('drop policy if exists %I_business_select on public.%I', t, t);
    execute format('drop policy if exists %I_business_mutate on public.%I', t, t);
    execute format('create policy %I_business_select on public.%I for select using (public.has_business_role(business_id, array[''owner'',''admin'',''viewer'']))', t, t);
    execute format('create policy %I_business_mutate on public.%I for all using (public.has_business_role(business_id, array[''owner'',''admin''])) with check (public.has_business_role(business_id, array[''owner'',''admin'']))', t, t);
  end loop;
end $$;

create or replace function public.mutate_ai_center_transactional(p_business_id uuid, p_action text, p_payload jsonb, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_conversation_id uuid;
  v_message_id uuid;
  v_evidence_id uuid;
  v_recommendation_id uuid;
  v_scenario_id uuid;
  v_brief_id uuid;
  v_approval_id uuid;
  v_result jsonb := '{}'::jsonb;
begin
  if not public.has_business_role(p_business_id, array['owner','admin']) then
    raise exception 'AI Center permission denied';
  end if;

  if p_action = 'ask-question' then
    v_conversation_id := coalesce(nullif(p_payload->>'conversationId','')::uuid, gen_random_uuid());
    insert into public.ai_conversations (id, business_id, title, provider, status, updated_at)
    values (v_conversation_id, p_business_id, left(p_payload->>'question', 120), coalesce(p_payload->>'provider', 'deterministic'), 'active', now())
    on conflict (id) do update set updated_at = now();
    insert into public.ai_evidence_links (business_id, source_type, source_id, label, href, excerpt, confidence)
    values (p_business_id, 'analytics', 'deterministic-answer', 'Faust source records', '/analytics', 'Production AI request stored; deterministic application service provides grounded answer content.', 0.75)
    on conflict (business_id, source_type, source_id, label) do update set excerpt = excluded.excerpt
    returning id into v_evidence_id;
    insert into public.ai_messages (business_id, conversation_id, role, content, provider, grounded, evidence_ids)
    values (p_business_id, v_conversation_id, 'user', p_payload->>'question', coalesce(p_payload->>'provider', 'deterministic'), true, '[]'::jsonb);
    insert into public.ai_messages (business_id, conversation_id, role, content, provider, grounded, evidence_ids)
    values (p_business_id, v_conversation_id, 'assistant', 'Grounded deterministic answer recorded through the production AI Center RPC. Read normalized Faust records for the final rendered response.', coalesce(p_payload->>'provider', 'deterministic'), true, jsonb_build_array(v_evidence_id))
    returning id into v_message_id;
    v_result := jsonb_build_object('conversationId', v_conversation_id, 'messageId', v_message_id);
  elsif p_action = 'daily-brief' then
    insert into public.ai_daily_briefs (business_id, brief_date, provider, mode, sections, recommendation_ids)
    values (p_business_id, current_date, coalesce(p_payload->>'provider', 'deterministic'), 'deterministic', '[]'::jsonb, '[]'::jsonb)
    returning id into v_brief_id;
    v_result := jsonb_build_object('briefId', v_brief_id);
  elsif p_action = 'run-scenario' then
    insert into public.ai_scenarios (business_id, name, prompt, inputs, impacts, assumptions, confidence, evidence_ids)
    values (p_business_id, coalesce(p_payload->>'name', 'AI scenario'), p_payload->>'prompt', p_payload - 'action', '{}'::jsonb, '["Production RPC stores scenario; application service computes local deterministic impacts."]'::jsonb, 0.7, '[]'::jsonb)
    returning id into v_scenario_id;
    v_result := jsonb_build_object('scenarioId', v_scenario_id);
  elsif p_action = 'save-recommendation' then
    update public.ai_recommendations set status = 'saved', updated_at = now() where business_id = p_business_id and id = (p_payload->>'recommendationId')::uuid returning id into v_recommendation_id;
    v_result := jsonb_build_object('recommendationId', v_recommendation_id);
  elsif p_action = 'request-approval' then
    insert into public.ai_approval_proposals (business_id, recommendation_id, action_type, payload, status, requested_by, reason)
    values (p_business_id, (p_payload->>'recommendationId')::uuid, 'review', p_payload, 'pending', 'AI Center', coalesce(p_payload->>'reason', 'AI Center recommendation requires approval before execution.'))
    returning id into v_approval_id;
    update public.ai_recommendations set status = 'approval_requested', updated_at = now() where business_id = p_business_id and id = (p_payload->>'recommendationId')::uuid;
    v_result := jsonb_build_object('approvalProposalId', v_approval_id);
  elsif p_action = 'feedback' then
    insert into public.ai_feedback (business_id, message_id, recommendation_id, rating, comment)
    values (p_business_id, nullif(p_payload->>'messageId','')::uuid, nullif(p_payload->>'recommendationId','')::uuid, p_payload->>'rating', p_payload->>'comment')
    returning id into v_message_id;
    v_result := jsonb_build_object('feedbackId', v_message_id);
  else
    raise exception 'Unsupported AI Center action: %', p_action;
  end if;

  insert into public.activity_events (business_id, action, entity_type, entity_id, detail)
  values (p_business_id, 'AI Center action', 'ai_center', coalesce((v_result->>'conversationId')::uuid, (v_result->>'briefId')::uuid, (v_result->>'scenarioId')::uuid, (v_result->>'approvalProposalId')::uuid, gen_random_uuid()), p_action);
  return v_result;
end;
$$;
