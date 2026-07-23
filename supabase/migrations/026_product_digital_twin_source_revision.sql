alter table public.product_digital_twin_assets
  add column if not exists source_image_revision text;

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
