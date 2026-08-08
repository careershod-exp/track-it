-- Run this once in Supabase's SQL Editor against your EXISTING database to
-- add payment-method support without touching anything else. Safe to run
-- even if you're not sure whether it's already applied — every statement
-- here is a no-op if the column already exists.

alter table ledgers add column if not exists payment_methods jsonb not null default '[]'::jsonb;
alter table expenses add column if not exists payment_method text;
