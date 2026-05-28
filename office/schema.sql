-- =====================================================================
-- SIAM AUTOWORKS — Back-office database schema (Supabase / PostgreSQL)
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- =====================================================================

-- Single flexible table. Both repair jobs and PPI reports live here.
-- All form fields are stored in the JSONB "data" column so the form can
-- grow without database migrations.

create table if not exists public.jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  doc_type     text not null check (doc_type in ('repair','ppi')),
  job_no       text,
  customer     text,
  vehicle      text,
  rego         text,
  total        numeric,
  status       text default 'draft',
  data         jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Auto-update updated_at on every change
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_jobs_updated_at on public.jobs;
create trigger trg_jobs_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- Index for fast listing per user, newest first
create index if not exists jobs_user_created_idx
  on public.jobs (user_id, created_at desc);

-- =====================================================================
-- Row Level Security — each user can only see/edit THEIR OWN jobs
-- =====================================================================
alter table public.jobs enable row level security;

drop policy if exists "own_jobs_select" on public.jobs;
create policy "own_jobs_select" on public.jobs
  for select using (auth.uid() = user_id);

drop policy if exists "own_jobs_insert" on public.jobs;
create policy "own_jobs_insert" on public.jobs
  for insert with check (auth.uid() = user_id);

drop policy if exists "own_jobs_update" on public.jobs;
create policy "own_jobs_update" on public.jobs
  for update using (auth.uid() = user_id);

drop policy if exists "own_jobs_delete" on public.jobs;
create policy "own_jobs_delete" on public.jobs
  for delete using (auth.uid() = user_id);

-- =====================================================================
-- Optional: a place to store reusable presets (common line items, prices)
-- =====================================================================
create table if not exists public.presets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,          -- e.g. 'line_item'
  label      text not null,
  data       jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.presets enable row level security;

drop policy if exists "own_presets_all" on public.presets;
create policy "own_presets_all" on public.presets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
