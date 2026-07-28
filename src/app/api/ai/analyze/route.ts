import { NextRequest, NextResponse } from 'next/server';
import { generateAI } from '@/lib/ai-provider';
import { getFleetContext } from '@/lib/ai-database-context';

const TYPE_PROMPTS: Record<string, string> = {
  performance: 'Analyze fleet performance: vehicle utilization, trip completion, and driver activity.',
  cost_optimization: 'Analyze cost optimization opportunities across fuel, maintenance, and other expenses.',
  profitability: 'Analyze route/trip profitability: revenue vs cost per trip.',
};

export async function POST(request: NextRequest) {
  try {
    const { type } = await request.json();
    if (!type || !TYPE_PROMPTS[type]) {
      return NextResponse.json({ error: 'Invalid analysis type' }, { status: 400 });
    }

    const context = await getFleetContext();
    const system = `
You are a fleet operations analyst at Calvary Investment Co. Ltd, a road
freight company in Tanzania. ${TYPE_PROMPTS[type]}

Base your analysis ONLY on this real data — do not invent numbers:
Vehicles: ${JSON.stringify(context.vehicles?.slice(0, 50) ?? [])}
Trips: ${JSON.stringify(context.trips?.slice(0, 50) ?? [])}
Expenses: ${JSON.stringify(context.expenses?.slice(0, 50) ?? [])}

Respond with STRICT JSON only, no markdown, in exactly this shape:
{"insights":["..."],"recommendations":["..."],"risks":["..."]}
If the data above is too sparse to say something meaningful, say so plainly
in "insights" rather than fabricating a conclusion.
`.trim();

    try {
      const result = await generateAI({
        system,
        messages: [{ role: 'user', content: [{ text: 'Provide the analysis now.' }] }],
      });
      const cleaned = result.text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '');
      let analysis: any;
      try {
        analysis = JSON.parse(cleaned);
      } catch {
        analysis = { insights: [result.text], recommendations: [], risks: [] };
      }
      return NextResponse.json({ success: true, analysis, provider: result.provider });
    } catch (err: any) {
      console.error('AI provider failed:', err);
      return NextResponse.json({ error: err?.message || 'AI provider error' }, { status: 502 });
    }
  } catch (error: any) {
    console.error('Analysis API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
