import { NextResponse } from 'next/server';
import {
    getPredictiveMaintenanceWithMeta,
    PredictiveMaintenanceInputSchema,
} from '@/ai/flows/predictive-maintenance';
import { AiRequestAuthError, authenticateAiRequest } from '@/lib/ai-request-auth';

export async function POST(req: Request) {
    try {
        // Require a valid session — paid LLM call, not for unauthenticated use.
        await authenticateAiRequest(req);
        const payload = await req.json();
        const validation = PredictiveMaintenanceInputSchema.safeParse(payload);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.format() },
                { status: 400 },
            );
        }

        const { output: result, provider } = await getPredictiveMaintenanceWithMeta(validation.data);
        return NextResponse.json({ success: true, result, provider, generatedAt: new Date().toISOString(), source: 'vehicle odometer, condition and maintenance inputs' });
    } catch (error: any) {
        console.error('Predictive Maintenance API Error:', error);
        const status = error instanceof AiRequestAuthError ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || 'Internal server error' },
            { status },
        );
    }
}
