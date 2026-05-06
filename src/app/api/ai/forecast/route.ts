import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service';
import { getFleetContext } from '@/lib/ai-database-context';

export async function POST(request: NextRequest) {
  try {
    const { type, timeframe } = await request.json();

    if (!type || !timeframe) {
      return NextResponse.json({ error: 'Missing type or timeframe' }, { status: 400 });
    }

    // Get relevant data from database
    const context = await getFleetContext();

    let forecast;
    switch (type) {
      case 'revenue':
        forecast = await aiService.forecastRevenue(timeframe, context.trips);
        break;
      case 'expenses':
        forecast = await aiService.forecastExpenses(timeframe, context.expenses);
        break;
      default:
        return NextResponse.json({ error: 'Invalid forecast type' }, { status: 400 });
    }

    return NextResponse.json({ success: true, forecast });
  } catch (error: any) {
    console.error('Forecast API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
