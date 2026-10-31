import { NextResponse } from 'next/server';
import { getCeoAiInsightsWithMeta, CeoAiInsightsInputSchema } from '@/ai/flows/ceo-ai-insights';
import { AiRequestAuthError, authenticateAiRequest } from '@/lib/ai-request-auth';

export async function POST(req: Request) {
    try {
        // Require a valid session — this route calls a paid LLM, so it must not
        // be callable unauthenticated. The caller (callAiRoute) sends the token.
        await authenticateAiRequest(req);
        const payload = await req.json();
        const validation = CeoAiInsightsInputSchema.safeParse(payload);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.format() },
                { status: 400 },
            );
        }

        const { output: result, provider } = await getCeoAiInsightsWithMeta(validation.data);
        return NextResponse.json({ success: true, result, provider, generatedAt: new Date().toISOString(), source: 'current fleet, trip, revenue and maintenance metrics' });
    } catch (error: any) {
        console.error('CEO Insights API Error:', error);
        const status = error instanceof AiRequestAuthError ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || 'Internal server error' },
            { status },
        );
    }
}
