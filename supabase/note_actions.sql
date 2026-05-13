-- Run this in your Supabase SQL editor
create table if not exists note_actions (
  id uuid default gen_random_uuid() primary key,
  username text not null,
  note_id uuid not null,
  action text not null, -- 'edit' or 'delete'
  created_at timestamptz default now()
);

create index if not exists note_actions_username_action_created
  on note_actions (username, action, created_at);

-- Add author column to notes if not exists
alter table notes add column if not exists author text;
