import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, buildStatutoryData, normalizePeriods, getPayrollPeriod } from './helpers';

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const period = url.searchParams.get('period') || '';
        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from('driver_allowances')
            .select('id,driver_id,driver_name,employee_id,role,amount,status,reason,created_at')
            .eq('type', 'payroll')
            .in('status', ['pending', 'approved', 'paid'])
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const records = data || [];
        const payrollRuns = normalizePeriods(records);
        const selectedPeriod = period || payrollRuns[0] || '';
        const filteredRecords = selectedPeriod
            ? records.filter((record) => getPayrollPeriod(record) === selectedPeriod)
            : [];

        const payload = buildStatutoryData(filteredRecords);

        return NextResponse.json({
            payrollRuns,
            selectedPeriod,
            summaries: payload.summaries,
            details: payload.details,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to fetch statutory data' }, { status: 500 });
    }
}
