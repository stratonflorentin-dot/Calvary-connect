import { NextResponse } from 'next/server';
import {
    getPredictiveMaintenance,
    PredictiveMaintenanceInputSchema,
} from '@/ai/flows/predictive-maintenance';

export async function POST(req: Request) {
    try {
        const payload = await req.json();
        const validation = PredictiveMaintenanceInputSchema.safeParse(payload);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.format() },
                { status: 400 },
            );
        }

        const result = await getPredictiveMaintenance(validation.data);
        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        console.error('Predictive Maintenance API Error:', error);
        return NextResponse.json(
            { error: error?.message || 'Internal server error' },
            { status: 500 },
        );
    }
}
