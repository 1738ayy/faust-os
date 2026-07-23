create table if not exists public.product_digital_twin_assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  source_image_id text not null,
  source_image_url text not null,
  transparent_image_url text,
  storage_key text,
  processing_status text not null default 'not_started'
    check (processing_status in ('not_started','queued','processing','ready','failed','needs_review')),
  segmentation_confidence numeric,
  bounds jsonb,
  source_dimensions jsonb,
  transparent_dimensions jsonb,
  generated_at timestamptz,
  processor_version text not null,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, source_image_id, processor_version)
);

create index if not exists product_digital_twin_assets_business_product_idx
  on public.product_digital_twin_assets(business_id, product_id);

alter table public.product_digital_twin_assets enable row level security;

drop policy if exists "tenant read" on public.product_digital_twin_assets;
create policy "tenant read" on public.product_digital_twin_assets
  for select using (public.is_business_member(business_id));

drop policy if exists "tenant write" on public.product_digital_twin_assets;
create policy "tenant write" on public.product_digital_twin_assets
  for all
  using (public.has_business_role(business_id, array['owner','admin','operations']))
  with check (public.has_business_role(business_id, array['owner','admin','operations']));
