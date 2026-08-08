-- Run this once in Supabase's SQL Editor against your EXISTING database.
-- Adds the ability for a ledger's owner to delete it (everything else
-- cascades automatically via foreign keys already in place). Safe to run
-- even if you're not sure whether it's already applied.

drop policy if exists "owner can delete ledger" on ledgers;
create policy "owner can delete ledger" on ledgers for delete
  using (owner_id = auth.uid());
