alter table public.orders
  add column if not exists discount_code text;

comment on column public.orders.discount_code is 'Promo code applied at checkout (from discounts.code)';
