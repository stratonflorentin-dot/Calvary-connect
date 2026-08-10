import type { SupabaseClient } from '@supabase/supabase-js';
import { calculatePayslip } from './statutory-rates';

export interface GeneratePayrollResult {
  payrollPeriodId: string;
  payslipCount: number;
  totalGrossPay: number;
  totalNetPay: number;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Inclusive day-overlap between a leave request and the payroll period's calendar month. */
function overlapDays(reqStart: string, reqEnd: string, periodStart: Date, periodEnd: Date): number {
  const start = new Date(Math.max(new Date(reqStart).getTime(), periodStart.getTime()));
  const end = new Date(Math.min(new Date(reqEnd).getTime(), periodEnd.getTime()));
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return Math.max(0, diff);
}

/**
 * Generates (or regenerates, while still in 'draft') payslips for every
 * employee with an active compensation record as of the period's pay date.
 *
 * Idempotent for a draft period: re-running replaces that period's payslips
 * rather than duplicating them, so correcting one employee's allowance and
 * re-running doesn't double everyone else up. Also releases and re-claims
 * this period's approved-unpaid-leave requests on regenerate, same
 * idempotency guarantee as the payslip rows themselves — a loan's
 * outstanding_balance is NOT touched here (see postPayrollPeriod).
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
    // payslip_loan_deductions cascade-deletes with their payslip (FK ON DELETE CASCADE).
    const { error: delErr } = await supabase.from('payslips').delete().eq('payroll_period_id', payrollPeriodId);
    if (delErr) throw new Error(`Failed to clear previous draft payslips: ${delErr.message}`);
    // Release leave requests this draft had claimed, so a rejected/edited
    // request since the last generate is correctly picked up (or dropped)
    // on this run instead of staying stuck to a stale claim.
    const { error: releaseErr } = await supabase
      .from('leave_requests')
      .update({ payroll_period_id: null })
      .eq('payroll_period_id', payrollPeriodId);
    if (releaseErr) throw new Error(`Failed to release previously-claimed leave requests: ${releaseErr.message}`);
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
  const employeeIds = compRows.map((c: any) => c.employee_id);

  // 3. Overtime — approved entries for this exact year/month, one per employee.
  const { data: overtimeRows, error: overtimeErr } = await supabase
    .from('overtime_entries')
    .select('employee_id, computed_amount')
    .eq('year', year)
    .eq('month', month)
    .eq('status', 'approved')
    .in('employee_id', employeeIds);
  if (overtimeErr) throw new Error(`Failed to load overtime entries: ${overtimeErr.message}`);
  const overtimeByEmployee = new Map<string, number>();
  for (const row of overtimeRows ?? []) {
    overtimeByEmployee.set(row.employee_id, Number(row.computed_amount) || 0);
  }

  // 4. Active loans — ordered oldest-first so a partially-repaid loan
  // finishes before a newer one starts being deducted.
  const { data: loanRows, error: loanErr } = await supabase
    .from('employee_loans')
    .select('id, employee_id, installment_amount, outstanding_balance')
    .eq('status', 'active')
    .gt('outstanding_balance', 0)
    .in('employee_id', employeeIds)
    .order('created_at', { ascending: true });
  if (loanErr) throw new Error(`Failed to load employee loans: ${loanErr.message}`);
  const loansByEmployee = new Map<string, typeof loanRows>();
  for (const loan of loanRows ?? []) {
    const list = loansByEmployee.get(loan.employee_id) ?? [];
    list.push(loan);
    loansByEmployee.set(loan.employee_id, list);
  }

  // 5. Approved, unpaid, not-yet-claimed-by-any-period leave requests
  // overlapping this calendar month.
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59);
  const { data: leaveRows, error: leaveErr } = await supabase
    .from('leave_requests')
    .select('id, employee_id, start_date, end_date')
    .eq('status', 'approved')
    .eq('is_paid', false)
    .is('payroll_period_id', null)
    .lte('start_date', periodEnd.toISOString().slice(0, 10))
    .gte('end_date', periodStart.toISOString().slice(0, 10))
    .in('employee_id', employeeIds);
  if (leaveErr) throw new Error(`Failed to load leave requests: ${leaveErr.message}`);
  const leaveByEmployee = new Map<string, typeof leaveRows>();
  for (const lr of leaveRows ?? []) {
    const list = leaveByEmployee.get(lr.employee_id) ?? [];
    list.push(lr);
    leaveByEmployee.set(lr.employee_id, list);
  }
  const claimedLeaveIds: string[] = [];
  const monthDays = daysInMonth(year, month);

  // 6. Build payslip rows, plus the loan-deduction breakdown per employee
  // (written after insert, once we have real payslip ids).
  const loanDeductionsByEmployee = new Map<string, { employee_loan_id: string; amount: number }[]>();

  const payslipRows = compRows.map((comp: any) => {
    const overtimeAmount = overtimeByEmployee.get(comp.employee_id) ?? 0;

    let unpaidLeaveDays = 0;
    for (const lr of leaveByEmployee.get(comp.employee_id) ?? []) {
      unpaidLeaveDays += overlapDays(lr.start_date, lr.end_date, periodStart, periodEnd);
      claimedLeaveIds.push(lr.id);
    }
    const unpaidLeaveDeduction = Math.round((Number(comp.base_salary) / monthDays) * unpaidLeaveDays);

    let loanDeductionTotal = 0;
    const appliedLoans: { employee_loan_id: string; amount: number }[] = [];
    for (const loan of loansByEmployee.get(comp.employee_id) ?? []) {
      const applied = Math.min(Number(loan.installment_amount), Number(loan.outstanding_balance));
      if (applied > 0) {
        loanDeductionTotal += applied;
        appliedLoans.push({ employee_loan_id: loan.id, amount: applied });
      }
    }
    if (appliedLoans.length > 0) loanDeductionsByEmployee.set(comp.employee_id, appliedLoans);

    const grossPay = Math.max(
      0,
      Number(comp.base_salary) +
        Number(comp.housing_allowance) +
        Number(comp.transport_allowance) +
        Number(comp.other_allowances) +
        overtimeAmount -
        unpaidLeaveDeduction,
    );

    const calc = calculatePayslip(grossPay, loanDeductionTotal, payDate);

    const noteParts: string[] = [];
    if (unpaidLeaveDeduction > 0) noteParts.push(`Unpaid leave: ${unpaidLeaveDays} day(s) (-${unpaidLeaveDeduction})`);
    if (loanDeductionTotal > 0) noteParts.push(`Loan repayment: ${loanDeductionTotal}`);

    return {
      payroll_period_id: payrollPeriodId,
      employee_id: comp.employee_id,
      employee_compensation_id: comp.id,
      cost_category: comp.cost_category,
      base_salary: comp.base_salary,
      housing_allowance: comp.housing_allowance,
      transport_allowance: comp.transport_allowance,
      other_allowances: comp.other_allowances,
      overtime_pay: overtimeAmount,
      unpaid_leave_deduction: unpaidLeaveDeduction,
      gross_pay: calc.grossPay,
      paye: calc.paye,
      nssf_employee: calc.nssfEmployee,
      nssf_employer: calc.nssfEmployer,
      nhif_employee: calc.nhifEmployee,
      other_deductions: calc.otherDeductions,
      other_deductions_note: noteParts.length > 0 ? noteParts.join('; ') : null,
      sdl: calc.sdl,
      wcf: calc.wcf,
      net_pay: calc.netPay,
      currency: comp.currency,
      status: 'draft',
    };
  });

  const { data: insertedPayslips, error: insertErr } = await supabase
    .from('payslips')
    .insert(payslipRows)
    .select('id, employee_id');
  if (insertErr) throw new Error(`Failed to insert payslips: ${insertErr.message}`);

  // 7. Loan-deduction junction rows, now that payslip ids exist.
  const junctionRows: { payslip_id: string; employee_loan_id: string; amount: number }[] = [];
  for (const p of insertedPayslips ?? []) {
    for (const applied of loanDeductionsByEmployee.get(p.employee_id) ?? []) {
      junctionRows.push({ payslip_id: p.id, employee_loan_id: applied.employee_loan_id, amount: applied.amount });
    }
  }
  if (junctionRows.length > 0) {
    const { error: junctionErr } = await supabase.from('payslip_loan_deductions').insert(junctionRows);
    if (junctionErr) throw new Error(`Failed to record loan deductions: ${junctionErr.message}`);
  }

  // 8. Claim the leave requests this run actually used.
  if (claimedLeaveIds.length > 0) {
    const { error: claimErr } = await supabase
      .from('leave_requests')
      .update({ payroll_period_id: payrollPeriodId })
      .in('id', claimedLeaveIds);
    if (claimErr) throw new Error(`Failed to claim leave requests for this period: ${claimErr.message}`);
  }

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
 * actual double-entry insert + balance update in one transaction. Once that
 * succeeds, this also applies this period's loan deductions to each loan's
 * outstanding_balance — the ONE place that happens, since posting a period
 * is irreversible (periods can't be regenerated once no longer 'draft'),
 * unlike draft-generate which can run many times over.
 */
export async function postPayrollPeriod(
  supabase: SupabaseClient,
  payrollPeriodId: string,
): Promise<{ journalEntryId: string }> {
  const { data, error } = await supabase.rpc('post_payroll_period', { p_payroll_period_id: payrollPeriodId });
  if (error) throw new Error(`Failed to post payroll period to the ledger: ${error.message}`);

  const { data: payslipIds, error: payslipErr } = await supabase
    .from('payslips')
    .select('id')
    .eq('payroll_period_id', payrollPeriodId);
  if (payslipErr) throw new Error(`Posted to the ledger, but failed to load payslips for loan deduction: ${payslipErr.message}`);

  const ids = (payslipIds ?? []).map((p: any) => p.id);
  if (ids.length > 0) {
    const { data: deductions, error: dedErr } = await supabase
      .from('payslip_loan_deductions')
      .select('employee_loan_id, amount')
      .in('payslip_id', ids);
    if (dedErr) throw new Error(`Posted to the ledger, but failed to load loan deductions: ${dedErr.message}`);

    const totalByLoan = new Map<string, number>();
    for (const d of deductions ?? []) {
      totalByLoan.set(d.employee_loan_id, (totalByLoan.get(d.employee_loan_id) ?? 0) + Number(d.amount));
    }

    for (const [loanId, deducted] of totalByLoan) {
      const { data: loan, error: loanFetchErr } = await supabase
        .from('employee_loans')
        .select('outstanding_balance')
        .eq('id', loanId)
        .single();
      if (loanFetchErr) throw new Error(`Posted to the ledger, but failed to load loan ${loanId}: ${loanFetchErr.message}`);

      const newBalance = Math.max(0, Number(loan.outstanding_balance) - deducted);
      const { error: loanUpdateErr } = await supabase
        .from('employee_loans')
        .update({
          outstanding_balance: newBalance,
          status: newBalance <= 0 ? 'completed' : 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', loanId);
      if (loanUpdateErr) throw new Error(`Posted to the ledger, but failed to update loan ${loanId} balance: ${loanUpdateErr.message}`);
    }
  }

  return { journalEntryId: data as string };
}
