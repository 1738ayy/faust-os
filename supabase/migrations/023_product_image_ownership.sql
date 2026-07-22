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
