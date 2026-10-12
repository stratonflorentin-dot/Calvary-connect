import { NextResponse } from 'next/server';
import { getCeoAiInsightsWithMeta, CeoAiInsightsInputSchema } from '@/ai/flows/ceo-ai-insights';

export async function POST(req: Request) {
    try {
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
        return NextResponse.json(
            { error: error?.message || 'Internal server error' },
            { status: 500 },
        );
    }
}
