-- cash_requests' RLS policy (086_cash_requests_full_lifecycle.sql) lets the
-- requester do *anything* — including UPDATE — to their own row, with no
-- restriction on which status it's in:
--
--   create policy cash_requests_all on cash_requests
--     for all using (requester_id = auth.uid() or current_user_role() in (...))
--     with check (requester_id = auth.uid() or current_user_role() in (...));
--
-- The app's approval-tier routing, guards, and financial posting
-- (src/lib/workflow/engine.ts / state-machines.ts) only exist in
-- client-side JS that calls this same table via the user's own Supabase
-- session — nothing stops a plain requester (any authenticated employee,
-- any role) from bypassing all of that with a direct
-- `supabase.from('cash_requests').update({ status: 'approved', ... })`
-- call, self-approving, self-disbursing, and self-retiring their own cash
-- advance. This codebase already has the right pattern for this exact
-- problem elsewhere (performance_reviews' acknowledge_performance_review
-- RPC, fuel_anomalies' driver_response column) — cash_requests just never
-- got it applied.
--
-- Full RPC-based posting is a bigger change than this migration attempts.
-- This closes the actual exploitable gap now: a requester can create and
-- edit their own draft, and submit it (draft -> pending, the one
-- transition the state machine explicitly lets the requester trigger
-- themselves — see the "Submit" transition's guard in state-machines.ts),
-- but cannot touch their request again once it leaves draft. Every
-- privileged-role update (approve/reject/disburse/retire) still goes
-- through the same role list as before — no regression there, only the
-- unprivileged self-service path is removed.

drop policy if exists cash_requests_all on cash_requests;

create policy cash_requests_select on cash_requests
  for select using (
    requester_id = auth.uid() or current_user_role() in ('CEO','ADMIN','ACCOUNTANT','OPERATOR')
  );

create policy cash_requests_insert on cash_requests
  for insert with check (
    requester_id = auth.uid() or current_user_role() in ('CEO','ADMIN','ACCOUNTANT','OPERATOR')
  );

-- USING checks the row as it is *before* the update — so once a request
-- leaves 'draft', the requester loses update access to it entirely, even
-- though this policy is still the one being evaluated (Postgres tries
-- every permissive policy for the command; the privileged-role policy
-- below is what then covers it). WITH CHECK allows the result to land on
-- 'pending' as well as staying on 'draft', so the requester's own Submit
-- action keeps working.
create policy cash_requests_update_owner_draft on cash_requests
  for update
  using (requester_id = auth.uid() and status = 'draft')
  with check (requester_id = auth.uid() and status in ('draft', 'pending'));

create policy cash_requests_update_privileged on cash_requests
  for update
  using (current_user_role() in ('CEO','ADMIN','ACCOUNTANT','OPERATOR'))
  with check (current_user_role() in ('CEO','ADMIN','ACCOUNTANT','OPERATOR'));

-- A requester can delete their own request only while it's still a draft
-- (nothing to lose — it was never submitted); anything further along is
-- privileged-role-only, same as update.
create policy cash_requests_delete on cash_requests
  for delete using (
    (requester_id = auth.uid() and status = 'draft')
    or current_user_role() in ('CEO','ADMIN','ACCOUNTANT','OPERATOR')
  );

-- cash_request_retirement_lines (097_expense_categories_vat_supplier.sql)
-- already correctly restricts INSERT/UPDATE to privileged roles via its
-- WITH CHECK clause, but its USING clause (which is all DELETE evaluates)
-- allows the requester to delete their own request's retirement lines —
-- these are the auditable breakdown of a retirement that's already posted
-- to the ledger (journal_entry_id, expense_id), so a requester erasing
-- their own lines is a real integrity gap even without the self-approval
-- angle above.
drop policy if exists cash_request_retirement_lines_all on cash_request_retirement_lines;

create policy cash_request_retirement_lines_select on cash_request_retirement_lines
  for select using (
    exists (
      select 1 from cash_requests cr
      where cr.id = cash_request_id
        and (cr.requester_id = auth.uid() or current_user_role() in ('CEO','ADMIN','ACCOUNTANT','OPERATOR'))
    )
  );

create policy cash_request_retirement_lines_write on cash_request_retirement_lines
  for insert with check (current_user_role() in ('CEO','ADMIN','ACCOUNTANT'));

create policy cash_request_retirement_lines_update on cash_request_retirement_lines
  for update
  using (current_user_role() in ('CEO','ADMIN','ACCOUNTANT'))
  with check (current_user_role() in ('CEO','ADMIN','ACCOUNTANT'));

create policy cash_request_retirement_lines_delete on cash_request_retirement_lines
  for delete using (current_user_role() in ('CEO','ADMIN','ACCOUNTANT'));

NOTIFY pgrst, 'reload schema';
