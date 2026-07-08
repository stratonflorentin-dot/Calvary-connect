import { NextResponse } from 'next/server';
import { getFuelPrediction, FuelPredictionInputSchema } from '@/ai/flows/fuel-prediction';

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

        const result = await getFuelPrediction(validation.data);
        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        console.error('Fuel Prediction API Error:', error);
        return NextResponse.json(
            { error: error?.message || 'Internal server error' },
            { status: 500 },
        );
    }
}
