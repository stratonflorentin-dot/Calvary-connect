import { NextResponse } from 'next/server';
import { InsuranceService } from '@/services/insurance-service';
import { InsuranceStatus } from '@/types/roles';

function getAccessToken(req: Request): string | undefined {
    return req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
}

function authErrorStatus(message: string): number {
    return /signed in/i.test(message) ? 401 : 500;
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') as InsuranceStatus | null;
        const insurer = searchParams.get('insurer');
        const policy_type = searchParams.get('policy_type');

        const filters = {
            ...(status && { status }),
            ...(insurer && { insurer }),
            ...(policy_type && { policy_type }),
        };

        const data = await InsuranceService.getAllInsurance(filters, getAccessToken(req));
        return NextResponse.json({ data });
    } catch (error: any) {
        console.error('GET /api/insurance error:', error);
        return NextResponse.json({ error: error.message }, { status: authErrorStatus(error.message) });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const data = await InsuranceService.createInsurance(body, getAccessToken(req));
        return NextResponse.json({ data }, { status: 201 });
    } catch (error: any) {
        console.error('POST /api/insurance error:', error);
        return NextResponse.json({ error: error.message }, { status: authErrorStatus(error.message) });
    }
}
