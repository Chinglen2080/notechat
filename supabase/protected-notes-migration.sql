-- Run this in Supabase SQL Editor to add protected notes support

alter table notes
  add column if not exists is_protected boolean default false,
  add column if not exists encrypted_content text,
  add column if not exists salt text,
  add column if not exists iv text,
  add column if not exists encrypted_decoy text,
  add column if not exists duress_salt text,
  add column if not exists duress_iv text;
