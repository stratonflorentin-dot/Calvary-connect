import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { requireStatutoryAccess, buildStatutoryData, getPayrollPeriod, buildPdfMarkup } from '../../helpers';

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const period = url.searchParams.get('period') || '';
        const agency = url.searchParams.get('agency') || 'paye';

        if (!period) {
            return NextResponse.json({ error: 'Missing payroll period' }, { status: 400 });
        }

        const supabase = await requireStatutoryAccess(request);
        const { data, error } = await supabase
            .from('driver_allowances')
            .select('id,driver_id,driver_name,employee_id,role,amount,status,reason,created_at')
            .eq('type', 'payroll')
            .in('status', ['pending', 'approved', 'paid'])
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const records = (data || []).filter((record: any) => getPayrollPeriod(record) === period);
        const payload = buildStatutoryData(records);
        const agencySummary = payload.summaries[agency as keyof typeof payload.summaries];

        const html = buildPdfMarkup(
            agency.toUpperCase(),
            period,
            payload.details,
            agencySummary?.total ?? 0,
        );

        const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'load' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: 20, bottom: 20, left: 20, right: 20 } });
        await browser.close();

        // Convert to Node Buffer for NextResponse compatibility
        const nodeBuffer = Buffer.from(pdfBuffer as any);

        return new NextResponse(nodeBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=statutory_${agency}_${period.replace(/[^\w\d]/g, '_')}.pdf`,
            },
        });
    } catch (error: any) {
        console.error('PDF export error', error);
        const status = /^UNAUTHORIZED/.test(error.message) ? 401 : /^FORBIDDEN/.test(error.message) ? 403 : 500;
        return NextResponse.json({ error: error.message || 'Could not generate PDF' }, { status });
    }
}
