-- Optional product-level video links (YouTube, Vimeo, direct MP4, etc.)
alter table public.products
  add column if not exists video_urls text[] not null default '{}';
