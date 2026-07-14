-- Faust OS: core authenticated tenancy foundation
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  currency text not null default 'USD' check (char_length(currency) = 3),
  timezone text not null default 'America/New_York',
  owner_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','admin','operations','finance','fulfillment','viewer')),
  created_at timestamptz not null default now(),
  unique(business_id, user_id)
);
create table if not exists public.business_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  tax_reserve_percent numeric not null default 0 check (tax_reserve_percent between 0 and 100),
  operating_buffer numeric not null default 0 check (operating_buffer >= 0),
  reservation_timing text not null default 'paid',
  deduction_timing text not null default 'shipped',
  low_stock_default integer not null default 2 check (low_stock_default >= 0),
  appearance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.business_workspace_states (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  data jsonb not null default '{"version":1,"mode":"empty"}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email)) on conflict (id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute procedure public.touch_updated_at();
drop trigger if exists businesses_touch_updated_at on public.businesses;
create trigger businesses_touch_updated_at before update on public.businesses for each row execute procedure public.touch_updated_at();
drop trigger if exists business_settings_touch_updated_at on public.business_settings;
create trigger business_settings_touch_updated_at before update on public.business_settings for each row execute procedure public.touch_updated_at();
drop trigger if exists business_workspace_states_touch_updated_at on public.business_workspace_states;
create trigger business_workspace_states_touch_updated_at before update on public.business_workspace_states for each row execute procedure public.touch_updated_at();

create or replace function public.is_business_member(target_business_id uuid) returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.business_members where business_id = target_business_id and user_id = auth.uid()) $$;
create or replace function public.has_business_role(target_business_id uuid, permitted_roles text[]) returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.business_members where business_id = target_business_id and user_id = auth.uid() and role = any(permitted_roles)) $$;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.business_settings enable row level security;
alter table public.business_workspace_states enable row level security;
drop policy if exists "profiles self access" on public.profiles;
create policy "profiles self access" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "business members read" on public.businesses;
create policy "business members read" on public.businesses for select using (public.is_business_member(id));
drop policy if exists "users create owned business" on public.businesses;
create policy "users create owned business" on public.businesses for insert with check (owner_id = auth.uid());
drop policy if exists "owners administer business" on public.businesses;
create policy "owners administer business" on public.businesses for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "members read business memberships" on public.business_members;
create policy "members read business memberships" on public.business_members for select using (public.is_business_member(business_id));
drop policy if exists "owner creates initial membership" on public.business_members;
create policy "owner creates initial membership" on public.business_members for insert with check (user_id = auth.uid() and role = 'owner' and exists(select 1 from public.businesses where id = business_id and owner_id = auth.uid()));
drop policy if exists "admins manage non-owner memberships" on public.business_members;
create policy "admins manage non-owner memberships" on public.business_members for all using (public.has_business_role(business_id, array['owner','admin']) and role <> 'owner') with check (public.has_business_role(business_id, array['owner','admin']) and role <> 'owner');
drop policy if exists "members read settings" on public.business_settings;
create policy "members read settings" on public.business_settings for select using (public.is_business_member(business_id));
drop policy if exists "owners admins manage settings" on public.business_settings;
create policy "owners admins manage settings" on public.business_settings for all using (public.has_business_role(business_id, array['owner','admin'])) with check (public.has_business_role(business_id, array['owner','admin']));
drop policy if exists "members read workspace state" on public.business_workspace_states;
create policy "members read workspace state" on public.business_workspace_states for select using (public.is_business_member(business_id));
drop policy if exists "operators manage workspace state" on public.business_workspace_states;
create policy "operators manage workspace state" on public.business_workspace_states for all using (public.has_business_role(business_id, array['owner','admin','operations','finance','fulfillment'])) with check (public.has_business_role(business_id, array['owner','admin','operations','finance','fulfillment']));
