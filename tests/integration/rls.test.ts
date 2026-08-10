import { describe, expect, it } from 'vitest';
import { getAnonClient } from './helpers';

/**
 * Every table in this schema requires authentication — nothing in this
 * app is meant to be publicly readable, not even "reference data" tables
 * (financial_categories, company_settings, etc. are all gated on
 * `auth.uid() IS NOT NULL` at minimum). So the correct assertion for
 * every single table, with no exceptions, is: anon gets PGRST205 (table
 * doesn't exist — fine, not a security concern) or 42501 (permission
 * denied — RLS correctly blocking). A 200 response, even with an empty
 * array, means either the table doesn't have RLS wired up right or the
 * policy is wider than intended — that ambiguity is exactly what caused
 * six separate "written but never applied" / wide-open-policy bugs this
 * project already shipped and had to find by hand (034, 038, 040, 043).
 *
 * This list is the confirmed-live table set as of the Phase 1/2/5 audit
 * this suite was built from. Keep it in sync as tables are added —
 * a table missing from this list isn't tested, which is a silent gap,
 * not a passing test.
 */
const ALL_TABLES = [
  'accounts', 'ai_agent_messages', 'ai_agent_runs', 'allowances', 'attendance_logs',
  'audit_logs', 'audit_trail', 'bank_accounts', 'bank_reconciliations', 'bank_statements',
  'bank_transactions', 'bookings', 'budgets', 'call_sessions', 'call_signaling',
  'cash_requests', 'chat_channel_members', 'chat_channels', 'chat_messages', 'chat_reactions',
  'chat_typing', 'clients', 'company_settings', 'compliance_documents', 'contract_history',
  'contract_templates', 'contracts', 'customer_activities', 'customers', 'delivery_notes',
  'departments', 'document_sequences', 'driver_allowances', 'driver_location_history',
  'driver_locations', 'employee_compensation', 'employee_loans', 'event_log', 'exchange_rates',
  'expenses', 'financial_categories', 'fiscal_periods', 'fuel_anomalies', 'fuel_logs',
  'fuel_records', 'fuel_requests', 'fuel_tracking', 'geofences', 'income',
  'instagram_conversations', 'instagram_messages', 'insurance_claims', 'insurance_policies',
  'inventory', 'invoices', 'journal_entries', 'journal_entry_lines', 'leads', 'leave_requests',
  'maintenance_records', 'maintenance_requests', 'maintenance_schedules', 'meeting_attendees',
  'meetings', 'mobile_money_transactions', 'monthly_reports', 'notifications', 'overtime_entries',
  'parts_requests', 'payment_allocations', 'payments', 'payroll_periods', 'payroll_runs',
  'payslip_loan_deductions', 'payslips', 'performance_reviews', 'proof_of_delivery', 'purchases',
  'quotations', 'rate_sheets', 'reports', 'route_constraints', 'route_quotations',
  'route_role_overrides', 'sales', 'sales_opportunities', 'schema_migrations', 'sensor_readings',
  'sensors', 'shipments', 'spare_parts', 'sustainability_metrics', 'taxes', 'tire_tracking',
  'transport_contracts', 'trip_revenue', 'trips', 'truck_insurance', 'user_profiles',
  'vehicle_costs', 'vehicle_deletion_audit', 'vehicle_documents', 'vehicle_inspections',
  'vehicle_locations', 'vehicle_service_records', 'vehicles', 'whatsapp_messages',
];

describe('RLS: anon can never read any table', () => {
  const anon = getAnonClient();

  it.each(ALL_TABLES)('%s denies anon (PGRST205 or 42501, never 200)', async (table) => {
    const { data, error, status } = await anon.from(table).select('*').limit(1);

    if (error) {
      expect(['PGRST205', '42501'], `${table} returned an unexpected error code: ${error.code} — ${error.message}`).toContain(error.code);
      return;
    }

    // No error at all means PostgREST considered the request valid and
    // returned real (or emptily-real) rows — that's the exact ambiguous
    // "200 with []" pattern that hid a wide-open policy on 20+ tables
    // earlier in this project. Fail loudly instead of treating an empty
    // array as automatically safe.
    expect.fail(`${table}: anon request succeeded (status ${status}) with ${data?.length ?? 0} row(s) — expected a permission error.`);
  });
});
