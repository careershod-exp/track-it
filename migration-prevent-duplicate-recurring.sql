-- Run this once in Supabase's SQL Editor. Prevents more than one recurring
-- income template per source (like "Salary") within the same ledger — the
-- database itself now refuses a duplicate, rather than relying only on the
-- app's own check, which can be bypassed if state is stale across sessions
-- or devices.
--
-- IMPORTANT: run the cleanup in the Recurring modal (deleting duplicate
-- Salary templates down to one) BEFORE running this — a unique constraint
-- cannot be added while duplicates already exist; it will fail with an
-- error naming the conflict if any remain.
alter table recurring_income
  add constraint recurring_income_unique_source_per_ledger unique (ledger_id, source);
