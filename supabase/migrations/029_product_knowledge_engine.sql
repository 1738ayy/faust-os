-- Faust OS: Product Knowledge Engine v1.
-- Evidence -> Knowledge -> Decisions, persisted with tenant isolation.
create extension if not exists pgcrypto;

create table if not exists public.product_knowledge_evidence (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  source_record_id text,
  source_type text not null check (source_type in ('supplier_attribute','supplier_title','supplier_price','supplier_variant','supplier_image','user_entry','marketplace_listing','system')),
  source_label text not null,
  raw_value jsonb,
  normalized_field_key text,
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  captured_at timestamptz not null default now(),
  immutable boolean not null default true
);

create unique index if not exists product_knowledge_evidence_unique
  on public.product_knowledge_evidence (business_id, product_id, source_type, source_label, md5(coalesce(raw_value::text, '')));

create table if not exists public.product_knowledge_fields (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  field_key text not null,
  field_value jsonb,
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  status text not null default 'generated' check (status in ('generated','confirmed','corrected','missing','rejected')),
  source text not null default 'evidence' check (source in ('evidence','memory','user_decision','system_inference','missing')),
  explanation text not null default '',
  supporting_evidence_ids jsonb not null default '[]'::jsonb,
  source_record_id text,
  revision integer not null default 1 check (revision > 0),
  reviewed_at timestamptz,
  reviewed_by text,
  updated_at timestamptz not null default now(),
  unique (business_id, product_id, field_key)
);

create table if not exists public.product_knowledge_decisions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  field_key text not null,
  decision text not null check (decision in ('confirmed','corrected','rejected','overridden')),
  previous_value jsonb,
  field_value jsonb,
  reason text,
  decided_by text,
  decided_at timestamptz not null default now()
);

create table if not exists public.product_knowledge_memory (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  memory_type text not null check (memory_type in ('source_label_mapping','supplier_cleanup','category_mapping','brand_confirmation','material_mapping','marketplace_preference','override_preference')),
  pattern text not null,
  output text not null,
  confidence_adjustment numeric not null default 0 check (confidence_adjustment >= 0 and confidence_adjustment <= 1),
  scope text not null default 'business' check (scope in ('global','business','supplier','source_platform','universal_category')),
  supplier_id uuid references public.suppliers(id) on delete set null,
  source_platform text,
  universal_category text,
  created_from_product_id uuid references public.products(id) on delete set null,
  created_from_field_key text,
  created_by text,
  usage_count integer not null default 0 check (usage_count >= 0),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists product_knowledge_memory_unique
  on public.product_knowledge_memory (
    business_id,
    memory_type,
    lower(pattern),
    scope,
    coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(source_platform, ''),
    coalesce(universal_category, '')
  );

create table if not exists public.product_knowledge_confidence_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  field_key text not null,
  previous_confidence numeric not null default 0 check (previous_confidence >= 0 and previous_confidence <= 1),
  next_confidence numeric not null default 0 check (next_confidence >= 0 and next_confidence <= 1),
  reason text not null,
  evidence_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists product_knowledge_evidence_product_idx on public.product_knowledge_evidence (business_id, product_id, captured_at desc);
create index if not exists product_knowledge_fields_product_idx on public.product_knowledge_fields (business_id, product_id, field_key);
create index if not exists product_knowledge_decisions_product_idx on public.product_knowledge_decisions (business_id, product_id, decided_at desc);
create index if not exists product_knowledge_memory_lookup_idx on public.product_knowledge_memory (business_id, memory_type, lower(pattern));
create index if not exists product_knowledge_confidence_product_idx on public.product_knowledge_confidence_history (business_id, product_id, created_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'product_knowledge_evidence',
    'product_knowledge_fields',
    'product_knowledge_decisions',
    'product_knowledge_memory',
    'product_knowledge_confidence_history'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "%s read" on public.%I', table_name, table_name);
    execute format('create policy "%s read" on public.%I for select using (public.is_business_member(business_id))', table_name, table_name);
    execute format('drop policy if exists "%s write" on public.%I', table_name, table_name);
    execute format('create policy "%s write" on public.%I for all using (public.has_business_role(business_id, array[''owner'',''admin'',''operations''])) with check (public.has_business_role(business_id, array[''owner'',''admin'',''operations'']))', table_name, table_name);
  end loop;
end $$;

notify pgrst, 'reload schema';
