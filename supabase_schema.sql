-- Shared notes schema for quant-career-blueprint
-- Goal:
-- 1) Everyone can read (public demo)
-- 2) Only OWNER account can write
--
-- Usage:
-- A. Run this whole file once in Supabase SQL Editor
-- B. Then set owner uid (replace the UUID):
--    update public.app_owner
--    set owner_uid = 'YOUR_AUTH_USER_UUID'
--    where id = 1;
--
-- Helper to find your uid:
-- select id, email from auth.users order by created_at desc;

create table if not exists public.app_owner (
  id smallint primary key check (id = 1),
  owner_uid uuid not null
);

insert into public.app_owner (id, owner_uid)
values (1, '00000000-0000-0000-0000-000000000000'::uuid)
on conflict (id) do nothing;

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

-- RLS
alter table public.learning_logs enable row level security;
alter table public.log_categories_by_day enable row level security;

-- Cleanup legacy policies
drop policy if exists "public_rw_learning_logs" on public.learning_logs;
drop policy if exists "public_rw_log_categories_by_day" on public.log_categories_by_day;

drop policy if exists "public_read_learning_logs" on public.learning_logs;
drop policy if exists "owner_write_learning_logs" on public.learning_logs;
drop policy if exists "public_read_log_categories_by_day" on public.log_categories_by_day;
drop policy if exists "owner_write_log_categories_by_day" on public.log_categories_by_day;

-- Everyone can read
create policy "public_read_learning_logs"
on public.learning_logs
for select
to anon, authenticated
using (true);

create policy "public_read_log_categories_by_day"
on public.log_categories_by_day
for select
to anon, authenticated
using (true);

-- Only owner can write
create policy "owner_write_learning_logs"
on public.learning_logs
for all
to authenticated
using (
  auth.uid() = (select owner_uid from public.app_owner where id = 1)
)
with check (
  auth.uid() = (select owner_uid from public.app_owner where id = 1)
);

create policy "owner_write_log_categories_by_day"
on public.log_categories_by_day
for all
to authenticated
using (
  auth.uid() = (select owner_uid from public.app_owner where id = 1)
)
with check (
  auth.uid() = (select owner_uid from public.app_owner where id = 1)
);
