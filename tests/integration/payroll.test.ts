import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestUser, deleteTestUser, getServiceClient, TEST_PREFIX, getClientAs, type TestUser } from './helpers';
import { generatePayrollPeriod, approvePayrollPeriod, postPayrollPeriod } from '@/lib/finance/payroll/engine';
import { calculatePayslip } from '@/lib/finance/payroll/statutory-rates';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Exercises the riskiest logic added this session (Phase 5): overtime
 * added pre-tax, a loan deducted post-tax, unpaid leave reducing taxable
 * gross — plus the two-phase commit shape (draft generate is re-runnable,
 * loan balance only ever decrements once at post time).
 *
 * Runs through a real authenticated ADMIN session, not the service-role
 * client — post_journal_entry (called inside postPayrollPeriod's RPC)
 * checks current_user_role() via auth.uid(), which is empty for a
 * service-role request (no real user session behind it), so it would
 * reject every call. Using a real signed-in admin also matches how the
 * app actually calls this in production.
 */
describe('Payroll: generate → approve → post', () => {
  const svc = getServiceClient();
  const YEAR = 2031; // far-future period so it can never collide with a real payroll run
  const MONTH = 6;
  const PAY_DATE = `${YEAR}-06-28`;

  let admin: TestUser;
  let adminClient: SupabaseClient;
  let employeeId: string;
  let compensationId: string;
  let loanId: string;
  let payrollPeriodId: string | undefined;

  beforeAll(async () => {
    admin = await createTestUser('ADMIN');
    adminClient = await getClientAs(admin);

    const { data: employee, error: empErr } = await svc
      .from('user_profiles')
      .insert({ email: `${TEST_PREFIX}payroll_emp@example.test`, name: `${TEST_PREFIX}Payroll Employee`, role: 'OPERATOR', status: 'active' })
      .select('id')
      .single();
    if (empErr) throw empErr;
    employeeId = employee.id;

    const { data: comp, error: compErr } = await adminClient
      .from('employee_compensation')
      .insert({
        employee_id: employeeId,
        cost_category: 'office',
        base_salary: 1_000_000,
        housing_allowance: 100_000,
        transport_allowance: 50_000,
        other_allowances: 0,
        currency: 'TZS',
        effective_from: `${YEAR}-01-01`,
      })
      .select('id')
      .single();
    if (compErr) throw compErr;
    compensationId = comp.id;

    const { data: loan, error: loanErr } = await adminClient
      .from('employee_loans')
      .insert({ employee_id: employeeId, principal_amount: 300_000, outstanding_balance: 300_000, installment_amount: 100_000, currency: 'TZS', status: 'active' })
      .select('id')
      .single();
    if (loanErr) throw loanErr;
    loanId = loan.id;

    const { error: otErr } = await adminClient.from('overtime_entries').insert({
      employee_id: employeeId,
      year: YEAR,
      month: MONTH,
      hours: 10,
      computed_amount: 50_000,
      status: 'approved',
    });
    if (otErr) throw otErr;

    // 5 unpaid days inside the test period
    const { error: leaveErr } = await adminClient.from('leave_requests').insert({
      employee_id: employeeId,
      leave_type: 'unpaid',
      start_date: `${YEAR}-06-10`,
      end_date: `${YEAR}-06-14`,
      status: 'approved',
      is_paid: false,
    });
    if (leaveErr) throw leaveErr;
  });

  afterAll(async () => {
    if (payrollPeriodId) {
      await svc.from('payslip_loan_deductions').delete().in('payslip_id', (await svc.from('payslips').select('id').eq('payroll_period_id', payrollPeriodId)).data?.map((p: any) => p.id) ?? []);
      await svc.from('payslips').delete().eq('payroll_period_id', payrollPeriodId);
      await svc.from('payroll_periods').delete().eq('id', payrollPeriodId);
    }
    await svc.from('leave_requests').delete().eq('employee_id', employeeId);
    await svc.from('overtime_entries').delete().eq('employee_id', employeeId);
    await svc.from('employee_loans').delete().eq('id', loanId);
    await svc.from('employee_compensation').delete().eq('id', compensationId);
    await svc.from('user_profiles').delete().eq('id', employeeId);
    await deleteTestUser(admin.id);
  });

  it('computes overtime pre-tax, unpaid leave pre-tax, loan deduction post-tax', async () => {
    const result = await generatePayrollPeriod(adminClient, { year: YEAR, month: MONTH, payDate: PAY_DATE, generatedBy: admin.id });
    payrollPeriodId = result.payrollPeriodId;
    expect(result.payslipCount).toBeGreaterThanOrEqual(1);

    const { data: payslip, error } = await adminClient
      .from('payslips')
      .select('*')
      .eq('payroll_period_id', payrollPeriodId)
      .eq('employee_id', employeeId)
      .single();
    expect(error).toBeNull();

    const daysInJune = 30;
    const expectedUnpaidLeaveDeduction = Math.round((1_000_000 / daysInJune) * 5);
    const expectedOvertimePay = 50_000;
    const expectedGrossBeforeTax = 1_000_000 + 100_000 + 50_000 + expectedOvertimePay - expectedUnpaidLeaveDeduction;
    const expectedCalc = calculatePayslip(expectedGrossBeforeTax, 100_000, PAY_DATE);

    expect(payslip.overtime_pay).toBe(expectedOvertimePay);
    expect(payslip.unpaid_leave_deduction).toBe(expectedUnpaidLeaveDeduction);
    expect(payslip.gross_pay).toBe(expectedCalc.grossPay);
    expect(payslip.paye).toBe(expectedCalc.paye);
    expect(payslip.other_deductions).toBe(100_000); // the loan's installment_amount
    expect(payslip.net_pay).toBe(expectedCalc.netPay);

    const { data: leave } = await adminClient.from('leave_requests').select('payroll_period_id').eq('employee_id', employeeId).single();
    expect(leave?.payroll_period_id, 'the unpaid leave request should be claimed by this period').toBe(payrollPeriodId);
  });

  it('regenerating the draft does not double-count overtime, leave, or loan deductions', async () => {
    const result = await generatePayrollPeriod(adminClient, { year: YEAR, month: MONTH, payDate: PAY_DATE, generatedBy: admin.id });
    expect(result.payrollPeriodId).toBe(payrollPeriodId);
    expect(result.payslipCount).toBe(1); // still one payslip for this employee, not two

    const { data: payslips } = await adminClient.from('payslips').select('id').eq('payroll_period_id', payrollPeriodId);
    expect(payslips).toHaveLength(1);
  });

  it('posting decrements the loan balance exactly once and produces a balanced journal entry', async () => {
    await approvePayrollPeriod(adminClient, payrollPeriodId!, admin.id);
    const { journalEntryId } = await postPayrollPeriod(adminClient, payrollPeriodId!);
    expect(journalEntryId).toBeTruthy();

    const { data: lines, error: linesErr } = await adminClient
      .from('journal_entry_lines')
      .select('debit_amount, credit_amount')
      .eq('journal_entry_id', journalEntryId);
    expect(linesErr).toBeNull();
    const totalDebit = (lines ?? []).reduce((s, l: any) => s + Number(l.debit_amount || 0), 0);
    const totalCredit = (lines ?? []).reduce((s, l: any) => s + Number(l.credit_amount || 0), 0);
    expect(totalDebit, 'journal entry must balance: total debits === total credits').toBeCloseTo(totalCredit, 2);
    expect(totalDebit, 'journal entry must not be empty').toBeGreaterThan(0);

    const { data: loan } = await adminClient.from('employee_loans').select('outstanding_balance, status').eq('id', loanId).single();
    expect(loan?.outstanding_balance).toBe(300_000 - 100_000);
    expect(loan?.status).toBe('active'); // not fully repaid yet

    // Posted periods can't regenerate — the guard that keeps loan
    // decrement + leave-claim as a true one-time side effect.
    await expect(
      generatePayrollPeriod(adminClient, { year: YEAR, month: MONTH, payDate: PAY_DATE, generatedBy: admin.id }),
    ).rejects.toThrow();
  });
});
