import { NextResponse } from 'next/server';
import { getFuelPredictionWithMeta, FuelPredictionInputSchema } from '@/ai/flows/fuel-prediction';

export async function POST(req: Request) {
    try {
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
        return NextResponse.json(
            { error: error?.message || 'Internal server error' },
            { status: 500 },
        );
    }
}
