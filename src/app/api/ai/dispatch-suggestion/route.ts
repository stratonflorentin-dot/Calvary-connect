import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildDispatchPrompt } from '@/ai/flows/dispatch-suggestion.server';
import { getDispatchContext } from '@/lib/ai-database-context';
import { generateAI } from '@/lib/ai-provider';

const SuggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      driverId: z.string(),
      vehicleId: z.string(),
      trailerId: z.string().optional(),
      score: z.number(),
      reasoning: z.string(),
    }),
  ),
  caveats: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  try {
    // Safely parse request body to avoid crashing on empty or invalid JSON
    const raw = await req.text();
    let body: any = {};
    if (raw && raw.trim().length > 0) {
      try {
        body = JSON.parse(raw);
      } catch (parseErr) {
        console.warn('Invalid JSON received in /api/ai/dispatch-suggestion', parseErr);
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
      }
    }

    const { origin, destination, cargoDescription, cargoWeightTons } = body;
    if (!origin || !destination) {
      return NextResponse.json({ error: 'origin and destination are required' }, { status: 400 });
    }

    // Resolve fleet/driver availability server-side — never trust
    // client-supplied fleet data, same rationale as ask-company/route.ts.
    const context = await getDispatchContext();
    const system = buildDispatchPrompt(
      { origin, destination, cargoDescription, cargoWeightTons: cargoWeightTons != null ? Number(cargoWeightTons) : undefined },
      context,
    );

    try {
      const result = await generateAI({
        system,
        messages: [{ role: 'user', content: [{ text: 'Suggest the best driver and vehicle for this trip.' }] }],
      });

      const cleaned = result.text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '');
      const parsed = SuggestionSchema.safeParse(JSON.parse(cleaned));
      if (!parsed.success) {
        console.error('Dispatch suggestion response failed validation:', parsed.error, result.text);
        return NextResponse.json({ error: 'AI returned an unexpected response shape' }, { status: 502 });
      }

      return NextResponse.json({ ...parsed.data, provider: result.provider });
    } catch (err: any) {
      console.error('AI provider failed:', err);
      if (process.env.NODE_ENV !== 'production') {
        return NextResponse.json({
          suggestions: [],
          caveats: ['Mock response — AI provider unavailable in this environment.'],
          fallback: 'mock',
        });
      }
      return NextResponse.json({ error: err?.message || 'AI provider error' }, { status: 502 });
    }
  } catch (err: any) {
    console.error('API dispatch-suggestion error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
