-- Run this in Supabase SQL Editor

-- Admin passwords table
create table if not exists admin_passwords (
  id uuid primary key default gen_random_uuid(),
  password_hash text not null,
  label text,
  is_main boolean default false,
  is_duress boolean default false,
  requires_change boolean default false,
  created_at timestamptz default now()
);

-- Additional valid passwords pool
create table if not exists "Password" (
  id uuid primary key default gen_random_uuid(),
  password text not null,
  label text,
  active boolean default true,
  created_at timestamptz default now()
);

-- Banned usernames
create table if not exists banned_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  reason text,
  banned_at timestamptz default now()
);

-- Duress events log
create table if not exists duress_events (
  id uuid primary key default gen_random_uuid(),
  triggered_at timestamptz default now(),
  resolved boolean default false
);

-- RLS
alter table admin_passwords enable row level security;
alter table "Password" enable row level security;
alter table banned_users enable row level security;
alter table duress_events enable row level security;

create policy "Service only" on admin_passwords using (false);
create policy "Service only" on "Password" using (false);
create policy "Service only" on banned_users using (false);
create policy "Service only" on duress_events using (false);

-- Insert initial main password (Chinglen4Enclave - hashed at runtime via API)
-- Insert initial duress password (Chinglen@14 - hashed at runtime via API)
-- Run /api/admin/init to seed these
