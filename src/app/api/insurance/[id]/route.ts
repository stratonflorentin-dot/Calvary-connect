import { NextResponse } from 'next/server';
import { InsuranceService } from '@/services/insurance-service';

function getAccessToken(req: Request): string | undefined {
  return req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
}

function authErrorStatus(message: string): number {
  return /signed in/i.test(message) ? 401 : 500;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await InsuranceService.getInsurance(id, getAccessToken(req));
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('GET /api/insurance/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: authErrorStatus(error.message) });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = await InsuranceService.updateInsurance(id, body, getAccessToken(req));
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('PUT /api/insurance/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: authErrorStatus(error.message) });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await InsuranceService.deleteInsurance(id, getAccessToken(req));
    return NextResponse.json({ message: 'Insurance deleted successfully' });
  } catch (error: any) {
    console.error('DELETE /api/insurance/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: authErrorStatus(error.message) });
  }
}
