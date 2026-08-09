import type { SupabaseClient } from '@supabase/supabase-js';
import { calculatePayslip } from './statutory-rates';

export interface GeneratePayrollResult {
  payrollPeriodId: string;
  payslipCount: number;
  totalGrossPay: number;
  totalNetPay: number;
}

/**
 * Generates (or regenerates, while still in 'draft') payslips for every
 * employee with an active compensation record as of the period's pay date.
 *
 * Idempotent for a draft period: re-running replaces that period's payslips
 * rather than duplicating them, so correcting one employee's allowance and
 * re-running doesn't double everyone else up.
 */
export async function generatePayrollPeriod(
  supabase: SupabaseClient,
  params: { year: number; month: number; payDate: string; generatedBy: string },
): Promise<GeneratePayrollResult> {
  const { year, month, payDate, generatedBy } = params;

  // 1. Get or create the period (draft only — posted/paid periods are locked).
  const { data: existing, error: findErr } = await supabase
    .from('payroll_periods')
    .select('id, status')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();
  if (findErr) throw new Error(`Failed to look up payroll period: ${findErr.message}`);

  let payrollPeriodId: string;
  if (existing) {
    if (existing.status !== 'draft') {
      throw new Error(`Payroll period ${month}/${year} is already '${existing.status}' and cannot be regenerated.`);
    }
    payrollPeriodId = existing.id;
    const { error: delErr } = await supabase.from('payslips').delete().eq('payroll_period_id', payrollPeriodId);
    if (delErr) throw new Error(`Failed to clear previous draft payslips: ${delErr.message}`);
  } else {
    const { data: created, error: createErr } = await supabase
      .from('payroll_periods')
      .insert({ year, month, pay_date: payDate, generated_by: generatedBy, status: 'draft' })
      .select('id')
      .single();
    if (createErr) throw new Error(`Failed to create payroll period: ${createErr.message}`);
    payrollPeriodId = created.id;
  }

  // 2. Active compensation as of payDate: effective_from <= payDate AND (effective_to IS NULL OR effective_to >= payDate)
  const { data: compRows, error: compErr } = await supabase
    .from('employee_compensation')
    .select('*')
    .lte('effective_from', payDate)
    .or(`effective_to.is.null,effective_to.gte.${payDate}`);
  if (compErr) throw new Error(`Failed to load employee compensation: ${compErr.message}`);
  if (!compRows || compRows.length === 0) {
    throw new Error('No active employee compensation records found for this pay date — nothing to run.');
  }

  // 3. Build payslip rows
  const payslipRows = compRows.map((comp: any) => {
    const grossPay =
      Number(comp.base_salary) +
      Number(comp.housing_allowance) +
      Number(comp.transport_allowance) +
      Number(comp.other_allowances);

    const calc = calculatePayslip(grossPay, 0, payDate);

    return {
      payroll_period_id: payrollPeriodId,
      employee_id: comp.employee_id,
      employee_compensation_id: comp.id,
      cost_category: comp.cost_category,
      base_salary: comp.base_salary,
      housing_allowance: comp.housing_allowance,
      transport_allowance: comp.transport_allowance,
      other_allowances: comp.other_allowances,
      overtime_pay: 0,
      gross_pay: calc.grossPay,
      paye: calc.paye,
      nssf_employee: calc.nssfEmployee,
      nssf_employer: calc.nssfEmployer,
      nhif_employee: calc.nhifEmployee,
      other_deductions: calc.otherDeductions,
      sdl: calc.sdl,
      wcf: calc.wcf,
      net_pay: calc.netPay,
      currency: comp.currency,
      status: 'draft',
    };
  });

  const { error: insertErr } = await supabase.from('payslips').insert(payslipRows);
  if (insertErr) throw new Error(`Failed to insert payslips: ${insertErr.message}`);

  const totalGrossPay = payslipRows.reduce((s, r) => s + r.gross_pay, 0);
  const totalNetPay = payslipRows.reduce((s, r) => s + r.net_pay, 0);

  return { payrollPeriodId, payslipCount: payslipRows.length, totalGrossPay, totalNetPay };
}

/** Marks a draft period 'approved' — a checkpoint before it's posted to the ledger. */
export async function approvePayrollPeriod(
  supabase: SupabaseClient,
  payrollPeriodId: string,
  approvedBy: string,
): Promise<void> {
  const { data: period, error: findErr } = await supabase
    .from('payroll_periods')
    .select('status')
    .eq('id', payrollPeriodId)
    .single();
  if (findErr) throw new Error(`Payroll period not found: ${findErr.message}`);
  if (period.status !== 'draft') {
    throw new Error(`Payroll period is '${period.status}', not 'draft' — cannot approve.`);
  }

  const { error } = await supabase
    .from('payroll_periods')
    .update({ status: 'approved', approved_by: approvedBy, approved_at: new Date().toISOString() })
    .eq('id', payrollPeriodId);
  if (error) throw new Error(`Failed to approve payroll period: ${error.message}`);

  await supabase.from('payslips').update({ status: 'approved' }).eq('payroll_period_id', payrollPeriodId);
}

/**
 * Posts the period to the general ledger via the `post_payroll_period` SQL
 * function (database/migrations/010-payroll-engine.sql), which does the
 * actual double-entry insert + balance update in one transaction.
 */
export async function postPayrollPeriod(
  supabase: SupabaseClient,
  payrollPeriodId: string,
): Promise<{ journalEntryId: string }> {
  const { data, error } = await supabase.rpc('post_payroll_period', { p_payroll_period_id: payrollPeriodId });
  if (error) throw new Error(`Failed to post payroll period to the ledger: ${error.message}`);
  return { journalEntryId: data as string };
}
