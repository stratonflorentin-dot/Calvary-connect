import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { createAdminClient } from '../../statutory/helpers';

const PAYROLL_ROLES = ['CEO', 'ADMIN', 'ACCOUNTANT', 'HR'];

const formatAmount = (value: number, currency: string) =>
  `${currency} ${Number(value ?? 0).toLocaleString('en-TZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function buildPayslipHtml(companyName: string, period: string, payslip: any, employeeName: string) {
  const earningsRows = [
    ['Base Salary', payslip.base_salary],
    ['Housing Allowance', payslip.housing_allowance],
    ['Transport Allowance', payslip.transport_allowance],
    ['Other Allowances', payslip.other_allowances],
    ['Overtime', payslip.overtime_pay],
  ].filter(([, v]) => Number(v) > 0);

  const deductionRows = [
    ['PAYE', payslip.paye],
    ['NSSF (Employee)', payslip.nssf_employee],
    ['NHIF', payslip.nhif_employee],
    ['Other Deductions', payslip.other_deductions],
  ].filter(([, v]) => Number(v) > 0);

  const row = (label: string, value: number) => `
    <tr><td>${label}</td><td style="text-align:right">${formatAmount(Number(value), payslip.currency)}</td></tr>
  `;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Payslip — ${employeeName}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
      h1 { color: #0369a1; margin-bottom: 0.1rem; font-size: 20px; }
      h2 { font-size: 14px; color: #475569; margin-top: 0; font-weight: 500; }
      .meta { margin: 12px 0 20px; font-size: 13px; color: #334155; }
      .columns { display: flex; gap: 24px; }
      .col { flex: 1; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #d1d5db; padding: 8px 10px; font-size: 13px; text-align: left; }
      th { background: #eff6ff; color: #0f172a; }
      .total-row td { font-weight: 700; background: #f8fafc; }
      .net-pay { margin-top: 24px; padding: 14px; background: #ecfdf5; border: 1px solid #10b981; border-radius: 6px; font-size: 16px; font-weight: 700; color: #065f46; }
    </style>
  </head>
  <body>
    <h1>${companyName}</h1>
    <h2>Payslip — ${period}</h2>
    <div class="meta">
      <div><strong>Employee:</strong> ${employeeName}</div>
      <div><strong>Category:</strong> ${payslip.cost_category}</div>
    </div>
    <div class="columns">
      <div class="col">
        <table>
          <thead><tr><th colspan="2">Earnings</th></tr></thead>
          <tbody>
            ${earningsRows.map(([l, v]) => row(String(l), Number(v))).join('')}
            <tr class="total-row"><td>Gross Pay</td><td style="text-align:right">${formatAmount(payslip.gross_pay, payslip.currency)}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="col">
        <table>
          <thead><tr><th colspan="2">Deductions</th></tr></thead>
          <tbody>
            ${deductionRows.map(([l, v]) => row(String(l), Number(v))).join('')}
            <tr class="total-row"><td>Total Deductions</td><td style="text-align:right">${formatAmount(
              payslip.paye + payslip.nssf_employee + payslip.nhif_employee + payslip.other_deductions,
              payslip.currency,
            )}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="net-pay">Net Pay: ${formatAmount(payslip.net_pay, payslip.currency)}</div>
    <p style="font-size: 11px; color: #64748b; margin-top: 24px;">
      Employer statutory contributions this period (not deducted from employee): NSSF Employer
      ${formatAmount(payslip.nssf_employer, payslip.currency)}, SDL ${formatAmount(payslip.sdl, payslip.currency)},
      WCF ${formatAmount(payslip.wcf, payslip.currency)}.
    </p>
  </body>
</html>`;
}

// GET /api/admin/hr/payroll/run/payslip-pdf?payrollPeriodId=...&employeeId=...
// employeeId omitted => one combined PDF with every payslip in the period, page-per-employee.
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!accessToken) throw new Error('UNAUTHORIZED: missing access token');
    const admin = createAdminClient();
    const { data: { user }, error: authErr } = await admin.auth.getUser(accessToken);
    if (authErr || !user) throw new Error('UNAUTHORIZED: invalid session');
    const { data: profile } = await admin.from('user_profiles').select('role').eq('id', user.id).maybeSingle();
    if (!profile || !PAYROLL_ROLES.includes(String(profile.role).toUpperCase())) {
      throw new Error('FORBIDDEN: not authorized to view payslips');
    }

    const url = new URL(request.url);
    const payrollPeriodId = url.searchParams.get('payrollPeriodId');
    const employeeId = url.searchParams.get('employeeId');
    if (!payrollPeriodId) return NextResponse.json({ error: 'payrollPeriodId is required' }, { status: 400 });

    const { data: period, error: periodErr } = await admin
      .from('payroll_periods')
      .select('year, month')
      .eq('id', payrollPeriodId)
      .single();
    if (periodErr) throw new Error(periodErr.message);

    let query = admin
      .from('payslips')
      .select('*, employee:employee_id(name)')
      .eq('payroll_period_id', payrollPeriodId);
    if (employeeId) query = query.eq('employee_id', employeeId);
    const { data: payslips, error: payslipErr } = await query;
    if (payslipErr) throw new Error(payslipErr.message);
    if (!payslips || payslips.length === 0) {
      return NextResponse.json({ error: 'No payslips found for this period' }, { status: 404 });
    }

    const periodLabel = `${period.month}/${period.year}`;
    const combinedHtml = payslips
      .map((p: any) => buildPayslipHtml('Calvary', periodLabel, p, p.employee?.name || p.employee_id))
      .join('<div style="page-break-after: always;"></div>');

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(
      employeeId ? buildPayslipHtml('Calvary', periodLabel, payslips[0], payslips[0].employee?.name || payslips[0].employee_id) : combinedHtml,
      { waitUntil: 'load' },
    );
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: 20, bottom: 20, left: 20, right: 20 } });
    await browser.close();

    const filename = employeeId
      ? `payslip_${(payslips[0].employee?.name || payslips[0].employee_id).replace(/[^\w\d]/g, '_')}_${periodLabel.replace('/', '_')}.pdf`
      : `payslips_${periodLabel.replace('/', '_')}.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer as any), {
      status: 200,
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename=${filename}` },
    });
  } catch (error: any) {
    console.error('Payslip PDF export error', error);
    const status = /^UNAUTHORIZED/.test(error.message) ? 401 : /^FORBIDDEN/.test(error.message) ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Could not generate payslip PDF' }, { status });
  }
}
