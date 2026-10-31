import { NextResponse } from 'next/server';
import { InsuranceService } from '@/services/insurance-service';
import { AiRequestAuthError, authenticateAiRequest } from '@/lib/ai-request-auth';

export async function GET(req: Request) {
    try {
        // Require a valid session — service-role reads must not be unauthenticated.
        await authenticateAiRequest(req);
        const summary = await InsuranceService.getInsuranceSummary();
        return NextResponse.json({ data: summary });
    } catch (error: any) {
        console.error('GET /api/insurance/summary error:', error);
        const status = error instanceof AiRequestAuthError ? error.status : 500;
        return NextResponse.json({ error: error.message }, { status });
    }
}
