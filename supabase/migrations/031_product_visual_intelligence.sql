create table if not exists public.product_image_observations (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  image_id uuid not null references public.product_images(id) on delete cascade,
  observation_type text not null,
  observation_value jsonb not null default '{}'::jsonb,
  confidence numeric not null default 0,
  explanation text not null default '',
  region jsonb,
  evidence_ref text,
  model_version text not null default 'faust-visual-deterministic-v1',
  provider text not null default 'deterministic',
  created_at timestamptz not null default now()
);

create table if not exists public.product_image_quality (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  image_id uuid not null references public.product_images(id) on delete cascade,
  sharpness numeric not null default 0,
  resolution numeric not null default 0,
  lighting numeric not null default 0,
  product_visibility numeric not null default 0,
  obstruction numeric not null default 0,
  cropping numeric not null default 0,
  background_distraction numeric not null default 0,
  watermark_risk numeric not null default 0,
  duplicate_similarity numeric not null default 0,
  marketplace_suitability numeric not null default 0,
  role text not null default 'gallery',
  explanation text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, product_id, image_id)
);

create table if not exists public.product_cover_recommendations (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  recommended_image_id uuid not null references public.product_images(id) on delete cascade,
  confidence numeric not null default 0,
  explanation text not null default '',
  ranked_image_ids uuid[] not null default '{}',
  lower_rank_reasons jsonb not null default '{}'::jsonb,
  status text not null default 'suggested',
  override_image_id uuid references public.product_images(id) on delete set null,
  decided_at timestamptz,
  decided_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_image_review_decisions (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  image_id uuid references public.product_images(id) on delete set null,
  field_key text,
  action text not null,
  previous_value jsonb,
  decision_value jsonb,
  reason text,
  decided_by text,
  decided_at timestamptz not null default now()
);

alter table public.product_image_observations enable row level security;
alter table public.product_image_quality enable row level security;
alter table public.product_cover_recommendations enable row level security;
alter table public.product_image_review_decisions enable row level security;

drop policy if exists "tenant product image observations" on public.product_image_observations;
create policy "tenant product image observations" on public.product_image_observations using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "tenant product image quality" on public.product_image_quality;
create policy "tenant product image quality" on public.product_image_quality using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "tenant product cover recommendations" on public.product_cover_recommendations;
create policy "tenant product cover recommendations" on public.product_cover_recommendations using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

drop policy if exists "tenant product image review decisions" on public.product_image_review_decisions;
create policy "tenant product image review decisions" on public.product_image_review_decisions using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));

create index if not exists product_image_observations_product_idx on public.product_image_observations(business_id, product_id);
create index if not exists product_image_observations_type_idx on public.product_image_observations(business_id, observation_type);
create index if not exists product_image_quality_product_idx on public.product_image_quality(business_id, product_id);
create index if not exists product_cover_recommendations_product_idx on public.product_cover_recommendations(business_id, product_id, status);
create index if not exists product_image_review_decisions_product_idx on public.product_image_review_decisions(business_id, product_id);

notify pgrst, 'reload schema';
