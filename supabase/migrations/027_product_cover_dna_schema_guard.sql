-- Corrective production/staging guard for Product cover persistence and Product DNA.
-- This migration is intentionally idempotent so environments that missed one of
-- the late Product migrations can catch up without manual table edits.

alter table public.product_images
  add column if not exists is_cover boolean not null default false,
  add column if not exists purpose text,
  add column if not exists source_type text,
  add column if not exists original_url text,
  add column if not exists crop jsonb not null default '{}'::jsonb,
  add column if not exists alt_text text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists product_images_product_position_idx
  on public.product_images(product_id, position);

update public.product_images
set
  is_cover = coalesce(is_cover, false) or position = 0,
  purpose = coalesce(purpose, case when position = 0 then 'cover' else 'source' end),
  source_type = coalesce(source_type, 'supplier'),
  original_url = coalesce(original_url, url),
  updated_at = coalesce(updated_at, created_at, now());

with ranked as (
  select id, row_number() over (partition by product_id order by position asc, created_at asc) as cover_rank
  from public.product_images
  where is_cover
)
update public.product_images image
set is_cover = ranked.cover_rank = 1
from ranked
where image.id = ranked.id;

create unique index if not exists product_images_one_cover_per_product_idx
  on public.product_images(product_id)
  where is_cover;

alter table public.products
  add column if not exists cover_image_id uuid;

update public.products product
set cover_image_id = image.id
from public.product_images image
where product.cover_image_id is null
  and image.product_id = product.id
  and image.is_cover;

update public.products product
set cover_image_id = image.id
from (
  select distinct on (product_id) id, product_id
  from public.product_images
  order by product_id, position asc, created_at asc
) image
where product.cover_image_id is null
  and image.product_id = product.id;

create index if not exists products_business_cover_image_idx
  on public.products(business_id, cover_image_id);

create table if not exists public.product_digital_twin_assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  source_image_id text not null,
  source_image_url text not null,
  source_image_revision text,
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
  updated_at timestamptz not null default now()
);

alter table public.product_digital_twin_assets
  add column if not exists source_image_revision text;

create index if not exists product_digital_twin_assets_business_product_idx
  on public.product_digital_twin_assets(business_id, product_id);

alter table public.product_digital_twin_assets enable row level security;

drop policy if exists "tenant read" on public.product_digital_twin_assets;
create policy "tenant read" on public.product_digital_twin_assets
  for select
  using (public.is_business_member(business_id));

drop policy if exists "tenant write" on public.product_digital_twin_assets;
create policy "tenant write" on public.product_digital_twin_assets
  for all
  using (public.has_business_role(business_id, array['owner','admin','operations']))
  with check (public.has_business_role(business_id, array['owner','admin','operations']));

do $$
declare
  constraint_name text;
begin
  select conname
    into constraint_name
  from pg_constraint
  where conrelid = 'public.product_digital_twin_assets'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) like '%product_id%'
    and pg_get_constraintdef(oid) like '%source_image_id%'
    and pg_get_constraintdef(oid) like '%processor_version%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.product_digital_twin_assets drop constraint %I', constraint_name);
  end if;
end $$;

create unique index if not exists product_digital_twin_assets_source_revision_idx
  on public.product_digital_twin_assets(product_id, source_image_id, coalesce(source_image_revision, ''), processor_version);

-- Ask PostgREST/Supabase API to reload the schema cache so new columns are
-- visible to browser/server API calls immediately after the migration.
notify pgrst, 'reload schema';
