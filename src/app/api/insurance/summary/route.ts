import { NextResponse } from 'next/server';
import { InsuranceService } from '@/services/insurance-service';

export async function GET(req: Request) {
    try {
        const summary = await InsuranceService.getInsuranceSummary();
        return NextResponse.json({ data: summary });
    } catch (error: any) {
        console.error('GET /api/insurance/summary error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
