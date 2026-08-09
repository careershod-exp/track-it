-- Run this once in Supabase's SQL Editor. Fixes a bug where recurring
-- income (e.g. an auto-recurring Salary) would re-generate a new income
-- entry every time the app reloaded, instead of once per month.
--
-- The cause: the recurring_income table was missing an UPDATE policy.
-- Without it, the app's attempt to mark a template as "already generated
-- this month" was silently blocked by Row Level Security, so on the next
-- load it looked like it had never run — and generated another entry.

drop policy if exists "update recurring income in your ledgers" on recurring_income;
create policy "update recurring income in your ledgers" on recurring_income for update
  using (exists (select 1 from ledger_members m where m.ledger_id = recurring_income.ledger_id and m.user_id = auth.uid()));
