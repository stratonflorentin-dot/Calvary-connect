import { NextResponse } from 'next/server';
import { InsuranceService } from '@/services/insurance-service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await InsuranceService.getInsurance(id);
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('GET /api/insurance/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = await InsuranceService.updateInsurance(id, body);
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('PUT /api/insurance/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await InsuranceService.deleteInsurance(id);
    return NextResponse.json({ message: 'Insurance deleted successfully' });
  } catch (error: any) {
    console.error('DELETE /api/insurance/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
