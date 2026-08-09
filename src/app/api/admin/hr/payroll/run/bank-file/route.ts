import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../statutory/helpers';

const PAYROLL_ROLES = ['CEO', 'ADMIN', 'ACCOUNTANT', 'HR'];

const escapeCsv = (value: string | number | undefined | null) => {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

// GET /api/admin/hr/payroll/run/bank-file?payrollPeriodId=...
// Produces a generic CSV: employee name, bank name, account number, amount, currency, reference.
// Most Tanzanian banks' bulk-payment portals (and mobile money bulk disbursement tools) accept a
// CSV in this shape or something close to it — check your specific bank's required column order
// before uploading; this is not guaranteed to match any one bank's exact template.
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!accessToken) throw new Error('UNAUTHORIZED: missing access token');
    const admin = createAdminClient();
    const { data: { user }, error: authErr } = await admin.auth.getUser(accessToken);
    if (authErr || !user) throw new Error('UNAUTHORIZED: invalid session');
    const { data: profile } = await admin.from('user_profiles').select('role').eq('id', user.id).maybeSingle();
    if (!profile || !PAYROLL_ROLES.includes(String(profile.role).toUpperCase())) {
      throw new Error('FORBIDDEN: not authorized to export the payroll bank file');
    }

    const url = new URL(request.url);
    const payrollPeriodId = url.searchParams.get('payrollPeriodId');
    if (!payrollPeriodId) return NextResponse.json({ error: 'payrollPeriodId is required' }, { status: 400 });

    const { data: period, error: periodErr } = await admin
      .from('payroll_periods')
      .select('year, month, status')
      .eq('id', payrollPeriodId)
      .single();
    if (periodErr) throw new Error(periodErr.message);
    if (period.status !== 'approved' && period.status !== 'posted' && period.status !== 'paid') {
      return NextResponse.json(
        { error: `Payroll period is still '${period.status}' — approve it before generating the bank file.` },
        { status: 400 },
      );
    }

    const { data: payslips, error: payslipErr } = await admin
      .from('payslips')
      .select('net_pay, currency, employee_compensation_id, employee:employee_id(name)')
      .eq('payroll_period_id', payrollPeriodId);
    if (payslipErr) throw new Error(payslipErr.message);
    if (!payslips || payslips.length === 0) {
      return NextResponse.json({ error: 'No payslips found for this period' }, { status: 404 });
    }

    const compIds = payslips.map((p: any) => p.employee_compensation_id).filter(Boolean);
    const { data: compRows, error: compErr } = await admin
      .from('employee_compensation')
      .select('id, bank_name, bank_account_number')
      .in('id', compIds);
    if (compErr) throw new Error(compErr.message);
    const compById = new Map((compRows || []).map((c: any) => [c.id, c]));

    const missingBankDetails: string[] = [];
    const header = ['Employee Name', 'Bank Name', 'Account Number', 'Amount', 'Currency', 'Reference'];
    const rows = [header.join(',')];

    for (const p of payslips as any[]) {
      const comp = compById.get(p.employee_compensation_id);
      const employeeName = p.employee?.name || 'Unknown';
      if (!comp?.bank_account_number) {
        missingBankDetails.push(employeeName);
        continue;
      }
      rows.push(
        [
          escapeCsv(employeeName),
          escapeCsv(comp.bank_name),
          escapeCsv(comp.bank_account_number),
          escapeCsv(Number(p.net_pay).toFixed(2)),
          escapeCsv(p.currency),
          escapeCsv(`Salary ${period.month}/${period.year}`),
        ].join(','),
      );
    }

    if (missingBankDetails.length > 0) {
      return NextResponse.json(
        {
          error: `${missingBankDetails.length} employee(s) have no bank account on file and were excluded: ${missingBankDetails.join(', ')}. Add their bank details in employee_compensation, then re-export.`,
        },
        { status: 422 },
      );
    }

    const csv = rows.join('\n');
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=payroll_bank_file_${period.month}_${period.year}.csv`,
      },
    });
  } catch (error: any) {
    console.error('Bank file export error', error);
    const status = /^UNAUTHORIZED/.test(error.message) ? 401 : /^FORBIDDEN/.test(error.message) ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Could not generate bank file' }, { status });
  }
}
