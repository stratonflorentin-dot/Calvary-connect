-- Full-system bug/error sweep via Supabase's security advisor turned up
-- real, live holes — not just lint noise. Two SECURITY DEFINER functions
-- are directly callable via the public anon key with zero internal
-- authorization check, and every SECURITY DEFINER function in the schema
-- (44 total) is executable by unauthenticated (anon) callers by default,
-- since nothing ever explicitly revoked the PUBLIC execute grant Postgres
-- assigns on CREATE FUNCTION.
--
-- Confirmed live against production before writing this fix (not just
-- advisor text): pulled every flagged function's actual definition,
-- cross-referenced against real app code (grep for supabase.rpc(...)
-- callers) to separate "genuinely used by the app" from "dead code", and
-- checked pg_trigger to confirm which SECURITY DEFINER functions fire only
-- as triggers (handle_new_user_signup on auth.users, etc.) rather than
-- being called directly — trigger firing does not require the DML-issuing
-- role to hold EXECUTE on the trigger function, so revoking anon's EXECUTE
-- grant across the board cannot break signup or any other trigger-driven
-- flow.
--
-- 1. post_credit_note (051_credit_notes.sql) had NO role check at all —
--    any authenticated session, regardless of role, could post a credit
--    note's journal entry (real ledger movement) by calling
--    supabase.rpc('post_credit_note', { p_id }). Added the same
--    CEO/ADMIN/ACCOUNTANT guard post_bank_transaction and
--    post_vehicle_acquisition already use.
--
-- 2. handle_vehicle_deletion (database/patches/fleet/vehicle-deletion-system.sql,
--    called from src/components/fleet/vehicle-deletion-dialog.tsx) had no
--    role check either — any authenticated user could mark any vehicle
--    sold/decommissioned. Added a CEO/ADMIN/OPERATOR guard, matching the
--    role set vehicle-deletion-dialog.tsx's own UI restricts the button to.
--    Also fixed a second, separate bug found while reading this function:
--    its admin-notification query filtered
--    `WHERE up.role IN ('admin', 'operator', 'ceo')` — lowercase — against
--    a column that is always stored uppercase (confirmed live:
--    SELECT DISTINCT role FROM user_profiles returns 'ADMIN', 'ACCOUNTANT',
--    'HR', etc.). That condition has never matched a single row, so the
--    "notify admins when a vehicle is sold/decommissioned" notification
--    has silently never fired since this function was written. Fixed to
--    the correct uppercase values. Also added the missing
--    `SET search_path TO 'public'` this function never had.
--
-- 3. invite_user / suspend_user / reactivate_user
--    (database/patches/users/user-activity-tracking.sql) are confirmed
--    dead — the app now does invite/suspend/reactivate through
--    src/app/users/actions.ts server actions using the service-role key,
--    not these RPCs — but they were still live in the database with no
--    auth check, directly callable by anyone holding the anon key.
--    suspend_user/reactivate_user in particular take a raw p_user_id with
--    no ownership check: anyone could suspend or reactivate an arbitrary
--    account. Not dropped (no destructive action on possibly-referenced
--    code without confirmation) — fully revoked from anon, authenticated,
--    and PUBLIC instead, leaving them inert (only the service role /
--    function owner can still invoke them, same as if they were dropped,
--    but reversible).
--
-- 4. Blanket REVOKE EXECUTE ... FROM anon across every SECURITY DEFINER
--    function in public — the cheap, high-leverage fix for the 44-function
--    "executable by anon" advisory category as a whole, done via a DO
--    block over pg_proc (using oid::regprocedure for correct handling of
--    overloaded functions, e.g. get_user_role which has two signatures)
--    rather than 44 individual statements, so it also covers anything
--    added after this migration without needing another pass.
--    `authenticated` grants are left untouched — the app calls these RPCs
--    only after sign-in, and role authorization inside each function body
--    (already present on all financial posting functions; added above for
--    the two that lacked it) is the actual per-role boundary.
--
-- 5. The 21 SECURITY DEFINER views flagged by the advisor
--    (v_customer_balances, trial_balance, profit_loss_summary, etc.) are
--    all confirmed unused by the live app (its Trial Balance/P&L pages
--    compute figures client-side from accounts + journal_entry_lines, not
--    from these views) — but a SECURITY DEFINER view still bypasses RLS on
--    its underlying tables for anyone who queries it directly via
--    /rest/v1/<view>, unlike a dead table (which fails closed). Converted
--    to SECURITY INVOKER so they respect the querying user's own RLS
--    instead, via a DO block that only touches views that actually exist.
--
-- Not fixed here (not a SQL/migration change): Auth's leaked-password
-- protection (HaveIBeenPwned check) is disabled — that's a toggle in the
-- Supabase Auth dashboard settings, not something a migration can set.
--
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.post_credit_note(p_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_note credit_notes;
  v_total NUMERIC;
  v_net NUMERIC;
  v_vat NUMERIC;
  v_rate NUMERIC;
  v_entry_id UUID;
BEGIN
  IF current_user_role() NOT IN ('CEO', 'ADMIN', 'ACCOUNTANT') THEN
    RAISE EXCEPTION 'Only CEO/ADMIN/ACCOUNTANT may post a credit note';
  END IF;

  SELECT * INTO v_note FROM credit_notes WHERE id = p_id FOR UPDATE;
  IF v_note.id IS NULL THEN
    RAISE EXCEPTION 'Credit note not found';
  END IF;
  IF v_note.status <> 'draft' THEN
    RAISE EXCEPTION 'Credit note % is already %; cannot re-post', v_note.credit_note_number, v_note.status;
  END IF;

  v_total := v_note.total_amount;
  v_net := v_note.amount;
  v_vat := COALESCE(v_note.vat_amount, 0);

  IF COALESCE(v_note.currency, 'TZS') <> 'TZS' THEN
    SELECT rate INTO v_rate
      FROM exchange_rates
     WHERE from_currency = v_note.currency AND to_currency = 'TZS'
     ORDER BY effective_date DESC
     LIMIT 1;
    IF v_rate IS NULL THEN
      RAISE EXCEPTION 'No exchange rate found for % -> TZS — cannot post credit note %', v_note.currency, v_note.credit_note_number;
    END IF;
    v_total := v_total * v_rate;
    v_net := v_net * v_rate;
    v_vat := v_vat * v_rate;
  END IF;

  INSERT INTO journal_entries (
    entry_number, entry_date, date, description, reference_type, reference_id, invoice_id,
    currency, status, is_posted, total_debit, total_credit, created_by
  ) VALUES (
    generate_entry_number(), v_note.issue_date, v_note.issue_date,
    'Credit note ' || v_note.credit_note_number || ' — ' || COALESCE(v_note.customer_name, 'customer'),
    'CREDIT_NOTE', v_note.id, v_note.original_invoice_id, 'TZS', 'draft', false, v_total, v_total, auth.uid()
  )
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, '4009', v_net, 0, 'Sales return — ' || v_note.credit_note_number, 'TZS', 1);

  IF v_vat > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
    VALUES (v_entry_id, '2106', v_vat, 0, 'VAT reversed — ' || v_note.credit_note_number, 'TZS', 2);
  END IF;

  INSERT INTO journal_entry_lines (journal_entry_id, account_code, debit_amount, credit_amount, description, currency, line_order)
  VALUES (v_entry_id, '1104', 0, v_total, 'AR reduced — ' || v_note.credit_note_number, 'TZS', 3);

  PERFORM post_journal_entry(v_entry_id);

  UPDATE credit_notes SET status = 'issued', journal_entry_id = v_entry_id, updated_at = now() WHERE id = p_id;

  RETURN v_entry_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_vehicle_deletion(p_vehicle_id uuid, p_deletion_reason text, p_sold_to text DEFAULT NULL::text, p_sale_price numeric DEFAULT NULL::numeric, p_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_vehicle RECORD;
  v_audit_id UUID;
BEGIN
  IF current_user_role() NOT IN ('CEO', 'ADMIN', 'OPERATOR') THEN
    RETURN json_build_object('success', false, 'error', 'Only CEO/ADMIN/OPERATOR may delete or dispose of a vehicle');
  END IF;

  SELECT * INTO v_vehicle
  FROM vehicles
  WHERE id = p_vehicle_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Vehicle not found');
  END IF;

  INSERT INTO vehicle_deletion_audit (
    vehicle_id,
    vehicle_plate,
    vehicle_make,
    vehicle_model,
    vehicle_year,
    mileage_at_deletion,
    sale_price,
    sold_to,
    sold_date,
    deletion_reason,
    deleted_by,
    deleted_by_name,
    previous_status,
    notes
  ) VALUES (
    v_vehicle.id,
    v_vehicle.plate_number,
    v_vehicle.make,
    v_vehicle.model,
    v_vehicle.year,
    v_vehicle.mileage,
    p_sale_price,
    p_sold_to,
    CASE WHEN p_deletion_reason = 'sold' THEN NOW() ELSE NULL END,
    p_deletion_reason,
    auth.uid(),
    current_setting('app.current_user_name', 'Unknown'),
    v_vehicle.status,
    p_notes
  ) RETURNING id INTO v_audit_id;

  UPDATE vehicles SET
    status = CASE
      WHEN p_deletion_reason = 'sold' THEN 'sold'
      WHEN p_deletion_reason = 'decommissioned' THEN 'decommissioned'
      ELSE 'decommissioned'
    END,
    sold_date = CASE WHEN p_deletion_reason = 'sold' THEN NOW() ELSE NULL END,
    sold_to = p_sold_to,
    sale_price = p_sale_price,
    sale_notes = p_notes,
    deleted_at = NOW(),
    deleted_by = auth.uid(),
    deletion_reason = p_deletion_reason
  WHERE id = p_vehicle_id;

  -- FIX: role values are always stored uppercase (confirmed live) — this
  -- previously matched 'admin'/'operator'/'ceo' lowercase and so never
  -- matched a real row, meaning this notification has never actually fired.
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    severity,
    is_read,
    created_at
  )
  SELECT
    up.id,
    CASE
      WHEN p_deletion_reason = 'sold' THEN 'Vehicle Sold'
      ELSE 'Vehicle Decommissioned'
    END,
    format('Vehicle %s (%s %s %s) has been %s%s',
      v_vehicle.plate_number,
      v_vehicle.make,
      v_vehicle.model,
      v_vehicle.year::text,
      p_deletion_reason,
      CASE WHEN p_sold_to IS NOT NULL THEN format(' to %s', p_sold_to) ELSE '' END
    ),
    'vehicle',
    CASE
      WHEN p_deletion_reason = 'sold' THEN 'info'
      ELSE 'warning'
    END,
    false,
    NOW()
  FROM user_profiles up
  WHERE up.role IN ('ADMIN', 'OPERATOR', 'CEO');

  RETURN json_build_object(
    'success', true,
    'audit_id', v_audit_id,
    'vehicle_plate', v_vehicle.plate_number,
    'message', format('Vehicle %s marked as %s', v_vehicle.plate_number, p_deletion_reason)
  );
END;
$function$;

-- Blanket-revoke EXECUTE from anon on every SECURITY DEFINER function in
-- public — closes the "executable by unauthenticated callers" advisory
-- across all 44 flagged functions in one pass, and covers anything added
-- later without needing another migration. authenticated grants are left
-- alone; internal current_user_role() checks (already present on the
-- financial posting functions, added above for the two that lacked one)
-- are the real per-role boundary once a caller is signed in.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname NOT IN ('invite_user', 'suspend_user', 'reactivate_user')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
  END LOOP;

  -- invite_user/suspend_user/reactivate_user are confirmed dead (the app's
  -- src/app/users/actions.ts does this server-side with the service-role
  -- key instead) but were still callable, with zero auth check, by anyone
  -- holding the anon OR authenticated key. Not dropped — fully revoked
  -- from anon, authenticated and PUBLIC instead, leaving them inert but
  -- reversible rather than deleted outright.
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('invite_user', 'suspend_user', 'reactivate_user')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, PUBLIC', r.sig);
  END LOOP;
END $$;

-- The 21 SECURITY DEFINER views the advisor flagged are all confirmed
-- unused by the live app, but unlike a dead table (which fails closed
-- under RLS) a SECURITY DEFINER view bypasses RLS on its underlying
-- tables for anyone who queries it directly via /rest/v1/<view>. Switch
-- them to SECURITY INVOKER so they respect the querying user's own RLS.
-- Guarded to only touch views that actually exist.
DO $$
DECLARE
  v TEXT;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'v_customer_balances', 'v_ar_aging', 'v_vat_position', 'trial_balance',
    'profit_loss_summary', 'monthly_financial_summary', 'revenue_by_customer',
    'expense_by_category', 'sales_pipeline_summary', 'parts_requests_view',
    'low_stock_alerts', 'insurance_dashboard_summary', 'insurance_policy_register',
    'expiring_insurance_policies', 'cross_border_coverage_check', 'tira_compliance_report',
    'fleet_fuel_summary', 'user_activity_overview', 'v_compliance_expiry_alerts',
    'v_daily_sustainability', 'vehicle_compliance_alerts'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = v) THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v);
    END IF;
  END LOOP;
END $$;

INSERT INTO public.schema_migrations (version) VALUES ('057_security_hardening.sql')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
