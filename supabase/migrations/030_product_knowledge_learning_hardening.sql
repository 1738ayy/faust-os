-- Phase E.21.1: Product Knowledge Engine verification and learning hardening.
-- Adds explicit conflict/review state and memory reinforcement counters without changing
-- the original immutable evidence contract.

alter table if exists public.product_knowledge_fields
  add column if not exists conflicting_evidence_ids uuid[] not null default '{}',
  add column if not exists alternatives jsonb not null default '[]'::jsonb,
  add column if not exists review_required boolean not null default false;

alter table if exists public.product_knowledge_memory
  add column if not exists successful_applications integer not null default 0,
  add column if not exists overridden_applications integer not null default 0,
  add column if not exists rejected_applications integer not null default 0,
  add column if not exists last_confirmed_at timestamptz,
  add column if not exists last_contradicted_at timestamptz,
  add column if not exists status text not null default 'active';

create index if not exists product_knowledge_fields_review_idx
  on public.product_knowledge_fields (business_id, product_id, review_required, confidence);

create index if not exists product_knowledge_memory_status_idx
  on public.product_knowledge_memory (business_id, status, memory_type, scope);

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
end $$;
