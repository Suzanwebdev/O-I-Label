-- Reference table for role names (many SQL snippets use public.roles + role_id on profiles).
-- App RBAC still uses public.admins (enum) + public.superadmins; this satisfies dashboard/template SQL.

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  label text,
  created_at timestamptz not null default now()
);

insert into public.roles (name, label)
select v.name, v.label
from (
  values
    ('super_admin', 'Super admin'),
    ('admin', 'Admin'),
    ('staff', 'Staff'),
    ('customer', 'Customer')
) as v(name, label)
where not exists (select 1 from public.roles r where r.name = v.name);

alter table public.roles enable row level security;

create policy roles_public_read on public.roles
  for select using (true);

-- Optional column used by external SQL on public.profiles
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role_id'
  ) then
    alter table public.profiles
      add column role_id uuid references public.roles (id) on delete set null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role_id'
  ) then
    create index if not exists idx_profiles_role_id on public.profiles (role_id);
  end if;
end $$;

-- Default existing profiles to customer when unset
update public.profiles p
set role_id = r.id
from public.roles r
where p.role_id is null and r.name = 'customer';

-- New signups: default profile role = customer (super_admin assigned manually or via admin tooling)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_customer_role uuid;
begin
  v_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  select id into v_customer_role from public.roles where name = 'customer' limit 1;

  insert into public.profiles (id, email, full_name, role_id)
  values (new.id, new.email, v_name, v_customer_role)
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    role_id = coalesce(public.profiles.role_id, excluded.role_id),
    updated_at = now();

  insert into public.customers (id, email, full_name)
  values (new.id, new.email, v_name)
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.customers.full_name);

  return new;
end;
$$;
