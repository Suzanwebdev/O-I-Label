-- Per-product bullets for PDP "Why you'll love it" (optional; empty = section hidden).
alter table public.products
  add column if not exists love_it_points text[] not null default '{}';

comment on column public.products.love_it_points is 'Short selling points shown on PDP; max length enforced in app.';
