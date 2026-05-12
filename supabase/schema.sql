-- Run this in your Supabase SQL Editor

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled',
  content text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table messages enable row level security;
alter table notes enable row level security;

create policy "Public read messages" on messages for select using (true);
create policy "Public insert messages" on messages for insert with check (true);

create policy "Public read notes" on notes for select using (true);
create policy "Public insert notes" on notes for insert with check (true);
create policy "Public update notes" on notes for update using (true);
create policy "Public delete notes" on notes for delete using (true);
