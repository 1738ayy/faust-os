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
