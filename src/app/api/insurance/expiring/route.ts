import { NextResponse } from 'next/server';
import { InsuranceService } from '@/services/insurance-service';
import { AiRequestAuthError, authenticateAiRequest } from '@/lib/ai-request-auth';

export async function GET(req: Request) {
    try {
        // Require a valid session — service-role reads must not be unauthenticated.
        await authenticateAiRequest(req);
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
        const status = error instanceof AiRequestAuthError ? error.status : 500;
        return NextResponse.json({ error: error.message }, { status });
    }
}
