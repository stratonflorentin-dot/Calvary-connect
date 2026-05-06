import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service';
import { getFleetContext } from '@/lib/ai-database-context';

export async function POST(request: NextRequest) {
  try {
    const { type } = await request.json();

    if (!type) {
      return NextResponse.json({ error: 'Missing analysis type' }, { status: 400 });
    }

    // Get relevant data from database
    const context = await getFleetContext();

    let analysis;
    switch (type) {
      case 'performance':
        analysis = await aiService.analyzeFleet({
          vehicles: context.vehicles,
          trips: context.trips,
          type: 'performance'
        });
        break;
      case 'cost_optimization':
        analysis = await aiService.analyzeFleet({
          vehicles: context.vehicles,
          expenses: context.expenses,
          type: 'cost_optimization'
        });
        break;
      case 'profitability':
        analysis = await aiService.analyzeFleet({
          trips: context.trips,
          expenses: context.expenses,
          type: 'profitability'
        });
        break;
      default:
        return NextResponse.json({ error: 'Invalid analysis type' }, { status: 400 });
    }

    return NextResponse.json({ success: true, analysis });
  } catch (error: any) {
    console.error('Analysis API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
