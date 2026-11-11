-- 150_rls_role_hardening.sql
-- Security: fix two scanner categories across the named policies:
--   * rls-policy-missing-role-restriction  -> add an explicit `TO authenticated`
--   * rls-policy-overly-permissive (USING true) -> `TO authenticated` AND tighten
--     a `true` predicate to `auth.uid() IS NOT NULL`
--
-- HOW THIS STAYS FAITHFUL: it does NOT re-type each policy's predicate by hand.
-- For every policy below it reads the CURRENT command / USING / WITH CHECK straight
-- from pg_policies and re-creates the policy with the same definition, changing only
-- the role (PUBLIC default -> authenticated) and, for the overly-permissive set, a
-- predicate that is exactly `true`. Postgres supplies the real predicate, so nothing
-- is reconstructed or guessed.
--
-- SAFETY / SCOPE
--   * Only the policies the scan flagged are touched (listed explicitly below).
--   * A policy that no longer exists (renamed/dropped) is skipped (IF NOT FOUND).
--   * `TO authenticated` removes anon/PUBLIC access. Every table here is internal
--     business data that is only read/written after login, so this is the intended
--     tightening — but because it cannot be tested without the live DB, APPLY ON A
--     STAGING/BRANCH DB FIRST and smoke-test each module before production.
--   * Idempotent: re-running reads the (already-authenticated) policy and re-applies
--     the same shape. `rate_sheet_edits` open insert policy is handled by migration 149.
--
-- Apply in the Supabase SQL editor.

DO $$
DECLARE
  r      record;
  pol    record;
  new_qual text;
  new_chk  text;
  ddl    text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- ===== overly-permissive (USING true): tighten + TO authenticated =====
      ('public','event_log','System can insert events','true'),
      ('public','user_profiles','Enable all access to user_profiles','true'),
      ('public','sales','sales_select_all','true'),
      ('public','vehicle_service_records','Full read access for authenticated users','true'),
      ('public','meetings','meetings_select_all','true'),
      ('public','reports','reports_select_all','true'),
      ('public','expenses','Allow all operations for authenticated users','true'),
      ('public','monthly_reports','monthly_reports_select_all','true'),
      ('public','invoices','Allow all operations','true'),
      ('public','bookings','Allow all access to bookings','true'),
      ('public','contract_documents','Allow all operations for authenticated users','true'),
      ('public','quotations','Allow all operations for authenticated users','true'),
      ('public','user_profiles','Authenticated users can view all profiles','true'),
      ('public','journal_entries','authenticated_users_journal_entries_select','true'),
      ('public','user_profiles','Public manage profiles','true'),
      ('public','audit_trail','System can insert audit trail','true'),
      ('public','exchange_rates','exchange_rates_read','true'),
      ('public','vehicle_documents','vehicle_documents_read','true'),

      -- ===== missing role restriction: add TO authenticated, keep predicate =====
      ('public','expenses','expenses_write','role'),
      ('public','shipments','Users can view assigned shipments','role'),
      ('public','employee_compensation','HR/Finance manage compensation','role'),
      ('public','vehicle_costs','Finance/Ops manage vehicle costs','role'),
      ('public','user_profiles','Users can insert their own profile','role'),
      ('public','expenses','Accountant/Admin can manage expenses','role'),
      ('public','vehicle_deletion_audit','Users can view vehicle deletion audit','role'),
      ('public','vehicle_locations','Admin/Operator can manage vehicle locations','role'),
      ('public','truck_insurance','insurance_select','role'),
      ('public','insurance_policies','Users can view insurance policies','role'),
      ('public','inventory','Admin/Operator can manage inventory','role'),
      ('public','maintenance_requests','Authenticated users can insert maintenance requests','role'),
      ('public','monthly_reports','Users can view their own reports','role'),
      ('public','fuel_requests','Users can view their own fuel requests','role'),
      ('public','delivery_proofs','delivery_proofs_auth','role'),
      ('public','vehicles','All users can view vehicles','role'),
      ('public','driver_allowances','Drivers can insert their own allowances','role'),
      ('public','driver_photos','Drivers can view their own photos','role'),
      ('public','ai_agent_runs','ai_agent_runs_admin_all','role'),
      ('public','driver_allowances','Drivers can view their own allowances','role'),
      ('public','proof_of_delivery','Users can view POD','role'),
      ('public','exchange_rates','Users can view exchange rates','role'),
      ('public','fiscal_periods','fiscal_periods_read','role'),
      ('storage','objects','compliance docs read','role'),
      ('public','chat_channels','chat_channels_select','role'),
      ('public','chat_typing','chat_typing_select','role'),
      ('public','instagram_conversations','instagram_conversations_read','role'),
      ('public','instagram_conversations','instagram_conversations_update','role'),
      ('public','route_role_overrides','route_role_overrides_read','role'),
      ('public','driver_allowances','Admins can manage allowances','role'),
      ('public','bank_transactions','bank_transactions_read','role'),
      ('public','fuel_logs','fuel_logs_write','role'),
      ('public','schema_migrations','schema_migrations_read','role'),
      ('public','vehicles','vehicles_write','role'),
      ('public','sales','sales_all','role'),
      ('public','employee_loans','employee_loans_self','role'),
      ('public','customers','customers_all','role'),
      ('public','client_emails','client_emails_all','role'),
      ('public','inventory','inventory_all','role'),
      ('public','credit_notes','credit_notes_all','role'),
      ('public','contract_documents','contract_documents_all','role'),
      ('public','trips','trips_delete','role'),
      ('public','vehicle_loans','vehicle_loans_all','role'),
      ('public','user_profiles','user_profiles_insert','role'),
      ('public','trip_advances','trip_advances_all','role'),
      ('public','vendor_bills','vendor_bills_all','role'),
      ('public','vehicle_depreciation_entries','vehicle_depreciation_entries_read','role'),
      ('public','fuel_anomalies','fuel_anomalies_driver_read','role'),
      ('public','vehicle_telemetry_history','vehicle_telemetry_history_read','role'),
      ('public','suppliers','suppliers_all','role'),
      ('public','purchase_orders','purchase_orders_read','role'),
      ('public','driver_scorecards','driver_scorecards_read','role'),
      ('public','performance_reviews','performance_reviews_self_select','role'),
      ('public','budgets','budgets_read','role'),
      ('public','bank_statement_batches','bank_statement_batches_read','role'),
      ('public','petty_cash_transactions','petty_cash_transactions_all','role'),
      ('public','petty_cash_settings','petty_cash_settings_read','role'),
      ('public','expense_categories','expense_categories_read','role'),
      ('public','audit_logs','audit_logs_delete','role'),
      ('public','quotations','quotations_read','role'),
      ('public','waybills','waybills_read','role'),
      ('public','notifications','notifications_delete_own','role'),
      ('public','contract_history','history_authenticated_view','role'),
      ('public','trip_assignments','trip_assignments_read','role'),
      ('public','ai_audit_log','ai_audit_log_read','role'),
      ('public','cash_requests','cash_requests_select','role'),
      ('public','proforma_invoices','proforma_invoices_read','role'),
      ('public','bank_transfers','bank_transfers_read','role'),
      ('public','journal_entries','journal_entries_update','role'),
      ('public','expenses','expenses_update','role'),
      ('public','company_loans','company_loans_all','role'),
      ('public','notebook_sources','notebook_sources_all','role'),
      ('public','maintenance_records','Authenticated users can read maintenance','role'),
      ('public','meetings','Users can view meetings they are attendees of','role'),
      ('public','vehicle_documents','Auth read vehicle_documents','role')
    ) AS t(schemaname, tablename, policyname, fixkind)
  LOOP
    SELECT cmd, qual, with_check, permissive
      INTO pol
      FROM pg_policies
     WHERE schemaname = r.schemaname
       AND tablename  = r.tablename
       AND policyname = r.policyname;

    IF NOT FOUND THEN
      RAISE NOTICE 'skip %.% / "%": policy not found', r.schemaname, r.tablename, r.policyname;
      CONTINUE;
    END IF;

    new_qual := pol.qual;
    new_chk  := pol.with_check;

    -- Overly-permissive: a predicate that is exactly `true` becomes authenticated-only.
    IF r.fixkind = 'true' THEN
      IF new_qual IS NOT NULL AND btrim(new_qual) = 'true' THEN
        new_qual := 'auth.uid() IS NOT NULL';
      END IF;
      IF new_chk IS NOT NULL AND btrim(new_chk) = 'true' THEN
        new_chk := 'auth.uid() IS NOT NULL';
      END IF;
    END IF;

    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);

    ddl := format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO authenticated',
                  r.policyname, r.schemaname, r.tablename, pol.permissive, pol.cmd);
    IF new_qual IS NOT NULL THEN
      ddl := ddl || ' USING (' || new_qual || ')';
    END IF;
    IF new_chk IS NOT NULL THEN
      ddl := ddl || ' WITH CHECK (' || new_chk || ')';
    END IF;

    EXECUTE ddl;
    RAISE NOTICE 'hardened %.% / "%"', r.schemaname, r.tablename, r.policyname;
  END LOOP;
END $$;
