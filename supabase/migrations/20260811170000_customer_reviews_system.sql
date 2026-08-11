-- Customer reviews: moderation, verified purchase linkage, media, aggregates.
-- Extends existing public.reviews without dropping columns.

create extension if not exists pgcrypto;

-- Status enum-like check via text + constraint
alter table public.reviews
  add column if not exists title text,
  add column if not exists display_name text,
  add column if not exists status text not null default 'pending',
  add column if not exists order_id uuid references public.orders (id) on delete set null,
  add column if not exists order_item_id uuid references public.order_items (id) on delete set null,
  add column if not exists purchased_variant_id uuid references public.variants (id) on delete set null,
  add column if not exists purchased_color text,
  add column if not exists purchased_size text,
  add column if not exists featured boolean not null default false,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists published_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reviews_status_check'
  ) then
    alter table public.reviews
      add constraint reviews_status_check
      check (status in ('pending', 'published', 'rejected', 'hidden'));
  end if;
end $$;

-- One review per purchased order line (when linked)
create unique index if not exists reviews_order_item_id_uidx
  on public.reviews (order_item_id)
  where order_item_id is not null;

create index if not exists reviews_product_status_created_idx
  on public.reviews (product_id, status, created_at desc);

create index if not exists reviews_status_created_idx
  on public.reviews (status, created_at desc);

create index if not exists reviews_customer_id_idx
  on public.reviews (customer_id);

create index if not exists reviews_featured_published_idx
  on public.reviews (featured, status, created_at desc)
  where featured = true and status = 'published';

create table if not exists public.review_media (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists review_media_review_id_idx
  on public.review_media (review_id, sort_order);

alter table public.review_media enable row level security;

-- Recompute denormalized product aggregates from published reviews only
create or replace function public.recompute_product_review_stats(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  avg_rating numeric(3,2);
  cnt int;
begin
  select
    round(avg(rating)::numeric, 1)::numeric(3,2),
    count(*)::int
  into avg_rating, cnt
  from public.reviews
  where product_id = p_product_id
    and status = 'published';

  update public.products
  set
    rating = case when cnt > 0 then avg_rating else null end,
    review_count = coalesce(cnt, 0),
    updated_at = now()
  where id = p_product_id;
end;
$$;

create or replace function public.trg_reviews_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from 'published')
     and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.trg_reviews_recompute_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_product_review_stats(old.product_id);
    return old;
  end if;

  perform public.recompute_product_review_stats(new.product_id);
  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    perform public.recompute_product_review_stats(old.product_id);
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_touch on public.reviews;
create trigger reviews_touch
  before insert or update on public.reviews
  for each row
  execute function public.trg_reviews_touch();

drop trigger if exists reviews_recompute_stats on public.reviews;
create trigger reviews_recompute_stats
  after insert or update or delete on public.reviews
  for each row
  execute function public.trg_reviews_recompute_stats();
-- Storage bucket for review photos (public read; authenticated upload via API/service role preferred)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-photos',
  'review-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS: public can read published reviews
drop policy if exists reviews_public_select_published on public.reviews;
create policy reviews_public_select_published
  on public.reviews
  for select
  to anon, authenticated
  using (status = 'published');

-- Customers can read their own reviews (any status)
drop policy if exists reviews_customer_select_own on public.reviews;
create policy reviews_customer_select_own
  on public.reviews
  for select
  to authenticated
  using (customer_id = auth.uid());

-- Customers insert own pending reviews only (verified_purchase/status enforced in app; also constrained here)
drop policy if exists reviews_customer_insert_own on public.reviews;
create policy reviews_customer_insert_own
  on public.reviews
  for insert
  to authenticated
  with check (
    customer_id = auth.uid()
    and status = 'pending'
  );

-- Customers may update own pending reviews (body/title/display_name/photos only — app enforces)
drop policy if exists reviews_customer_update_own_pending on public.reviews;
create policy reviews_customer_update_own_pending
  on public.reviews
  for update
  to authenticated
  using (customer_id = auth.uid() and status = 'pending')
  with check (customer_id = auth.uid() and status = 'pending');

-- Staff/admin catalog managers can manage all reviews
drop policy if exists reviews_staff_all on public.reviews;
create policy reviews_staff_all
  on public.reviews
  for all
  to authenticated
  using (public.can_manage_catalog(auth.uid()))
  with check (public.can_manage_catalog(auth.uid()));

-- review_media: public read when parent review is published
drop policy if exists review_media_public_select on public.review_media;
create policy review_media_public_select
  on public.review_media
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.reviews r
      where r.id = review_id and r.status = 'published'
    )
  );

drop policy if exists review_media_customer_select_own on public.review_media;
create policy review_media_customer_select_own
  on public.review_media
  for select
  to authenticated
  using (
    exists (
      select 1 from public.reviews r
      where r.id = review_id and r.customer_id = auth.uid()
    )
  );

drop policy if exists review_media_customer_insert_own on public.review_media;
create policy review_media_customer_insert_own
  on public.review_media
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.reviews r
      where r.id = review_id
        and r.customer_id = auth.uid()
        and r.status = 'pending'
    )
  );

drop policy if exists review_media_staff_all on public.review_media;
create policy review_media_staff_all
  on public.review_media
  for all
  to authenticated
  using (public.can_manage_catalog(auth.uid()))
  with check (public.can_manage_catalog(auth.uid()));

-- Storage policies for review-photos
drop policy if exists review_photos_public_select on storage.objects;
create policy review_photos_public_select
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'review-photos');

drop policy if exists review_photos_staff_write on storage.objects;
create policy review_photos_staff_write
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'review-photos' and public.can_manage_catalog(auth.uid()))
  with check (bucket_id = 'review-photos' and public.can_manage_catalog(auth.uid()));
