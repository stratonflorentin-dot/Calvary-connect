import { createClient } from '@supabase/supabase-js';

export type StatutoryRow = {
    employee_id: string;
    employee_name: string;
    employee_id_no: string;
    gross_pay: number;
    deduction: number;
    employer_contribution: number;
    paye: number;
    nssf_employee: number;
    nssf_employer: number;
    nhif: number;
    sdl: number;
    wcf: number;
};

export type StatutorySummary = {
    total: number;
    status: 'Pending' | 'Submitted' | 'Filed';
};

export const createAdminClient = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error('Missing Supabase admin credentials');
    }
    return createClient(url, key, { auth: { persistSession: false } });
};

export const parseReason = (reason: unknown) => {
    if (!reason) return {};
    if (typeof reason === 'string') {
        try {
            return JSON.parse(reason);
        } catch {
            return {};
        }
    }
    if (typeof reason === 'object') {
        return reason;
    }
    return {};
};

export const getPayrollPeriod = (record: any) => {
    if (!record) return 'Unknown Period';
    const reason = parseReason(record.reason);
    if (reason?.period) return String(reason.period);
    if (record.created_at) {
        const date = new Date(record.created_at);
        return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    }
    return 'Unknown Period';
};

export const calcPaye = (gross: number) => {
    if (gross <= 240000) return 0;
    if (gross <= 323333) return Math.round(gross * 0.09);
    if (gross <= 441666) return Math.round(gross * 0.20);
    if (gross <= 590000) return Math.round(gross * 0.25);
    return Math.round(gross * 0.30);
};

export const calcNhif = (gross: number) => {
    if (gross <= 59999) return 3000;
    if (gross <= 79999) return 4000;
    if (gross <= 119999) return 5000;
    if (gross <= 149999) return 6000;
    if (gross <= 199999) return 7500;
    if (gross <= 249999) return 8500;
    if (gross <= 299999) return 9000;
    if (gross <= 349999) return 9500;
    if (gross <= 399999) return 10000;
    if (gross <= 449999) return 11000;
    if (gross <= 499999) return 12000;
    if (gross <= 599999) return 13000;
    if (gross <= 699999) return 14000;
    if (gross <= 799999) return 15000;
    if (gross <= 899999) return 16000;
    if (gross <= 999999) return 17000;
    return 18000;
};

export const calcSdl = (gross: number) => Math.round(gross * 0.045);
export const calcWcf = (gross: number) => Math.round(gross * 0.01 * 2); // placeholder industry factor

export const getStatusLabel = (status: string) => {
    if (status === 'paid') return 'Filed';
    if (status === 'approved') return 'Submitted';
    return 'Pending';
};

export const normalizePeriods = (records: any[]) => {
    const seen = new Set<string>();
    const periods: string[] = [];
    records.forEach((record) => {
        const period = getPayrollPeriod(record);
        if (!seen.has(period)) {
            seen.add(period);
            periods.push(period);
        }
    });
    return periods.sort((a, b) => {
        const dateA = new Date(a);
        const dateB = new Date(b);
        return dateB.getTime() - dateA.getTime();
    });
};

export const buildStatutoryData = (records: any[]) => {
    const grouped = new Map<string, StatutoryRow>();
    const totals: Record<string, number> = { paye: 0, nssf: 0, nhif: 0, sdl: 0, wcf: 0 };
    const statusSet = new Set<string>();

    records.forEach((record) => {
        const reason = parseReason(record.reason);
        const baseSalary = Number(reason.baseSalary || 0);
        const allowances = Number(reason.allowances || 0);
        const grossPay = baseSalary + allowances || Number(record.amount || 0);
        const paye = calcPaye(grossPay);
        const nssfEmployee = Math.round(grossPay * 0.1);
        const nssfEmployer = Math.round(grossPay * 0.1);
        const nhif = calcNhif(grossPay);
        const sdl = calcSdl(grossPay);
        const wcf = calcWcf(grossPay);
        const deduction = paye + nssfEmployee + nhif + sdl;
        const employeeId = record.employee_id || reason.employee_id || record.driver_id || 'unknown';
        const employeeName = record.driver_name || reason.employeeName || 'Unknown Employee';
        const employeeIdNo = record.employee_id || reason.employee_id || employeeId;
        const key = `${employeeId}_${employeeName}`;

        statusSet.add(record.status || 'pending');

        if (!grouped.has(key)) {
            grouped.set(key, {
                employee_id: employeeId,
                employee_name: employeeName,
                employee_id_no: employeeIdNo,
                gross_pay: grossPay,
                deduction,
                employer_contribution: nssfEmployer,
                paye,
                nssf_employee: nssfEmployee,
                nssf_employer: nssfEmployer,
                nhif,
                sdl,
                wcf,
            });
        } else {
            const existing = grouped.get(key)!;
            existing.gross_pay += grossPay;
            existing.deduction += deduction;
            existing.employer_contribution += nssfEmployer;
            existing.paye += paye;
            existing.nssf_employee += nssfEmployee;
            existing.nssf_employer += nssfEmployer;
            existing.nhif += nhif;
            existing.sdl += sdl;
            existing.wcf += wcf;
        }

        totals.paye += paye;
        totals.nssf += nssfEmployee + nssfEmployer;
        totals.nhif += nhif;
        totals.sdl += sdl;
        totals.wcf += wcf;
    });

    const rows = Array.from(grouped.values());
    const status = getStatusLabel(statusSet.has('paid') ? 'paid' : statusSet.has('approved') ? 'approved' : 'pending');

    return {
        details: rows,
        summaries: {
            paye: { total: totals.paye, status },
            nssf: { total: totals.nssf, status },
            nhif: { total: totals.nhif, status },
            sdl: { total: totals.sdl, status },
            wcf: { total: totals.wcf, status },
        },
        statuses: status,
    };
};

export const buildPdfMarkup = (agencyLabel: string, period: string, rows: StatutoryRow[], total: number) => {
    const content = rows.map((row) => `
      <tr>
        <td>${row.employee_name}</td>
        <td>${row.employee_id_no}</td>
        <td>${row.gross_pay.toLocaleString('en-TZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>${row.deduction.toLocaleString('en-TZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>${row.employer_contribution.toLocaleString('en-TZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>${agencyLabel} Statutory Report</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
      h1 { color: #0369a1; margin-bottom: 0.25rem; }
      p { margin: 0.15rem 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; }
      th { background: #eff6ff; color: #0f172a; }
      .summary { margin-top: 20px; font-weight: 700; }
    </style>
  </head>
  <body>
    <h1>Statutory Report: ${agencyLabel}</h1>
    <p>Payroll period: ${period}</p>
    <p class="summary">Total amount due: TZS ${total.toLocaleString('en-TZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
    <table>
      <thead>
        <tr>
          <th>Employee</th>
          <th>ID / NIDA</th>
          <th>Gross Pay</th>
          <th>Deduction</th>
          <th>Employer Contribution</th>
        </tr>
      </thead>
      <tbody>
        ${content}
      </tbody>
    </table>
  </body>
</html>`;
};
