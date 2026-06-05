import { NextResponse } from 'next/server';
import { InsuranceService } from '@/services/insurance-service';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const days = searchParams.get('days');
        const daysThreshold = days ? parseInt(days) : 30;

        const data = await InsuranceService.getExpiringPolicies(daysThreshold);

        return NextResponse.json({
            data,
            threshold_days: daysThreshold,
            count: data.length,
        });
    } catch (error: any) {
        console.error('GET /api/insurance/expiring error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
