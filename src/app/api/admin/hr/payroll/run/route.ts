import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../statutory/helpers';
import { generatePayrollPeriod, approvePayrollPeriod, postPayrollPeriod } from '@/lib/finance/payroll/engine';

// Payroll runs are visible/actionable to Finance roles + HR (statutory
// filing views stay Finance-only via requireStatutoryAccess in ../statutory/helpers).
const PAYROLL_ROLES = ['CEO', 'ADMIN', 'ACCOUNTANT', 'HR'];

async function requirePayrollAccess(request: NextRequest) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!accessToken) throw new Error('UNAUTHORIZED: missing access token');

  const admin = createAdminClient();
  const { data: { user }, error } = await admin.auth.getUser(accessToken);
  if (error || !user) throw new Error('UNAUTHORIZED: invalid session');

  const { data: profile } = await admin.from('user_profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || !PAYROLL_ROLES.includes(String(profile.role).toUpperCase())) {
    throw new Error('FORBIDDEN: not authorized to run payroll');
  }
  return { admin, userId: user.id };
}

function errorResponse(error: any) {
  const status = /^UNAUTHORIZED/.test(error.message) ? 401 : /^FORBIDDEN/.test(error.message) ? 403 : 400;
  return NextResponse.json({ error: error.message || 'Payroll operation failed' }, { status });
}

// GET /api/admin/hr/payroll/run?year=2026&month=8 — view a period's payslips
export async function GET(request: NextRequest) {
  try {
    const { admin } = await requirePayrollAccess(request);
    const url = new URL(request.url);
    const year = Number(url.searchParams.get('year'));
    const month = Number(url.searchParams.get('month'));
    if (!year || !month) {
      return NextResponse.json({ error: 'year and month are required' }, { status: 400 });
    }

    const { data: period, error: periodErr } = await admin
      .from('payroll_periods')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();
    if (periodErr) throw new Error(periodErr.message);
    if (!period) return NextResponse.json({ period: null, payslips: [] });

    const { data: payslips, error: payslipErr } = await admin
      .from('payslips')
      .select('*, employee:employee_id(name, email)')
      .eq('payroll_period_id', period.id)
      .order('created_at', { ascending: true });
    if (payslipErr) throw new Error(payslipErr.message);

    return NextResponse.json({ period, payslips: payslips || [] });
  } catch (error: any) {
    return errorResponse(error);
  }
}

// POST /api/admin/hr/payroll/run
// body: { action: 'generate' | 'approve' | 'post', year, month, payDate?, payrollPeriodId? }
export async function POST(request: NextRequest) {
  try {
    const { admin, userId } = await requirePayrollAccess(request);
    const body = await request.json();
    const { action } = body;

    if (action === 'generate') {
      const { year, month, payDate } = body;
      if (!year || !month || !payDate) {
        return NextResponse.json({ error: 'year, month and payDate are required' }, { status: 400 });
      }
      const result = await generatePayrollPeriod(admin, { year, month, payDate, generatedBy: userId });
      return NextResponse.json(result);
    }

    if (action === 'approve') {
      const { payrollPeriodId } = body;
      if (!payrollPeriodId) return NextResponse.json({ error: 'payrollPeriodId is required' }, { status: 400 });
      await approvePayrollPeriod(admin, payrollPeriodId, userId);
      return NextResponse.json({ ok: true });
    }

    if (action === 'post') {
      const { payrollPeriodId } = body;
      if (!payrollPeriodId) return NextResponse.json({ error: 'payrollPeriodId is required' }, { status: 400 });
      const result = await postPayrollPeriod(admin, payrollPeriodId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: `Unknown action '${action}'` }, { status: 400 });
  } catch (error: any) {
    return errorResponse(error);
  }
}
