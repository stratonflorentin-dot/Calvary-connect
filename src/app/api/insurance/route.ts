import { NextResponse } from 'next/server';
import { InsuranceService } from '@/services/insurance-service';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');
        const insurer = searchParams.get('insurer');
        const policy_type = searchParams.get('policy_type');

        const filters = {
            ...(status && { status }),
            ...(insurer && { insurer }),
            ...(policy_type && { policy_type }),
        };

        const data = await InsuranceService.getAllInsurance(filters);
        return NextResponse.json({ data });
    } catch (error: any) {
        console.error('GET /api/insurance error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const data = await InsuranceService.createInsurance(body);
        return NextResponse.json({ data }, { status: 201 });
    } catch (error: any) {
        console.error('POST /api/insurance error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
