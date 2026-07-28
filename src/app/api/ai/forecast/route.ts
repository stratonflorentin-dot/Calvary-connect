import { NextRequest, NextResponse } from 'next/server';
import { generateAI } from '@/lib/ai-provider';
import { getFleetContext } from '@/lib/ai-database-context';

export async function POST(request: NextRequest) {
  try {
    const { type, timeframe } = await request.json();
    if (type !== 'revenue' && type !== 'expenses') {
      return NextResponse.json({ error: 'type must be revenue or expenses' }, { status: 400 });
    }

    const context = await getFleetContext();
    const series = type === 'revenue' ? context.trips : context.expenses;

    const system = `
You are a financial forecaster at Calvary Investment Co. Ltd, a road
freight company in Tanzania. Forecast ${type} for the next ${timeframe || '3 months'}
based ONLY on this real historical data — do not invent numbers:
${JSON.stringify((series || []).slice(0, 100))}

Respond with STRICT JSON only, no markdown, in exactly this shape:
{"forecast":"...","confidence":"low|medium|high","insights":["..."]}
If there isn't enough history to forecast responsibly, say so in "insights"
and set confidence to "low" rather than fabricating a trend.
`.trim();

    try {
      const result = await generateAI({
        system,
        messages: [{ role: 'user', content: [{ text: 'Provide the forecast now.' }] }],
      });
      const cleaned = result.text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '');
      let forecast: any;
      try {
        forecast = JSON.parse(cleaned);
      } catch {
        forecast = { forecast: result.text, confidence: 'low', insights: [] };
      }
      return NextResponse.json({ success: true, forecast, provider: result.provider });
    } catch (err: any) {
      console.error('AI provider failed:', err);
      return NextResponse.json({ error: err?.message || 'AI provider error' }, { status: 502 });
    }
  } catch (error: any) {
    console.error('Forecast API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
