-- Shared notes schema for quant-career-blueprint
-- Run this once in Supabase SQL Editor.

create table if not exists public.learning_logs (
  id text primary key,
  day_id text not null,
  timestamp bigint not null,
  content text not null,
  type text not null check (type in ('theory', 'code', 'bug', 'idea')),
  category text not null default '通用',
  updated_at timestamptz not null default now()
);

create index if not exists learning_logs_day_id_idx
  on public.learning_logs(day_id);

create index if not exists learning_logs_timestamp_idx
  on public.learning_logs(timestamp desc);

create table if not exists public.log_categories_by_day (
  day_id text primary key,
  categories jsonb not null default '["通用"]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Auto-update timestamp
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_learning_logs_updated_at on public.learning_logs;
create trigger trg_learning_logs_updated_at
before update on public.learning_logs
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_log_categories_updated_at on public.log_categories_by_day;
create trigger trg_log_categories_updated_at
before update on public.log_categories_by_day
for each row
execute function public.touch_updated_at();

-- RLS: public read/write (simple sharing mode)
alter table public.learning_logs enable row level security;
alter table public.log_categories_by_day enable row level security;

drop policy if exists "public_rw_learning_logs" on public.learning_logs;
create policy "public_rw_learning_logs"
on public.learning_logs
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "public_rw_log_categories_by_day" on public.log_categories_by_day;
create policy "public_rw_log_categories_by_day"
on public.log_categories_by_day
for all
to anon, authenticated
using (true)
with check (true);
