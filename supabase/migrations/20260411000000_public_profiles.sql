-- public.profiles: standard Supabase user profile table (dashboards / snippets often UPDATE this).
-- Keeps public.customers in sync on signup via trigger.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_email on public.profiles (email);

alter table public.profiles enable row level security;

create policy profiles_self_select on public.profiles
  for select using (auth.uid() = id);

create policy profiles_self_insert on public.profiles
  for insert with check (auth.uid() = id);

create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- Staff can read profiles for admin/support (matches catalog admin access pattern)
create policy profiles_staff_select on public.profiles
  for select using (public.can_manage_catalog(auth.uid()));

-- New auth users: create profile + customer row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, v_name)
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    updated_at = now();

  insert into public.customers (id, email, full_name)
  values (new.id, new.email, v_name)
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.customers.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Keep customers in sync when profile display fields change
create or replace function public.sync_profile_to_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (
    new.full_name is distinct from old.full_name
    or new.email is distinct from old.email
  ) then
    update public.customers
    set
      full_name = coalesce(new.full_name, customers.full_name),
      email = coalesce(new.email, customers.email)
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_updated_sync_customer on public.profiles;

create trigger on_profile_updated_sync_customer
  after update on public.profiles
  for each row
  execute function public.sync_profile_to_customer();

-- Backfill from existing customers (e.g. created before this migration)
insert into public.profiles (id, email, full_name)
select c.id, c.email, c.full_name
from public.customers c
where not exists (select 1 from public.profiles p where p.id = c.id)
on conflict (id) do nothing;
