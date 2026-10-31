import { NextResponse } from 'next/server';
import { getFuelPredictionWithMeta, FuelPredictionInputSchema } from '@/ai/flows/fuel-prediction';
import { AiRequestAuthError, authenticateAiRequest } from '@/lib/ai-request-auth';

export async function POST(req: Request) {
    try {
        // Require a valid session — paid LLM call, not for unauthenticated use.
        await authenticateAiRequest(req);
        const payload = await req.json();
        const validation = FuelPredictionInputSchema.safeParse(payload);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.format() },
                { status: 400 },
            );
        }

        const { output: result, provider } = await getFuelPredictionWithMeta(validation.data);
        return NextResponse.json({ success: true, result, provider, generatedAt: new Date().toISOString(), source: 'route, vehicle efficiency, load and fuel price inputs' });
    } catch (error: any) {
        console.error('Fuel Prediction API Error:', error);
        const status = error instanceof AiRequestAuthError ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || 'Internal server error' },
            { status },
        );
    }
}
