-- Run once in the Supabase SQL editor: tags become their own field, separate from genre.
alter table public.cinema_titles add column if not exists tags text not null default '';
