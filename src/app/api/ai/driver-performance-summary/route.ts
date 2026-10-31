import { NextResponse } from 'next/server';
import { generateAI } from '@/lib/ai-provider';
import { AiRequestAuthError, authenticateAiRequest } from '@/lib/ai-request-auth';

function buildPrompt(driver: any): string {
  const distanceLine = driver.distanceTracked
    ? `${driver.totalDistanceKm.toLocaleString()} km driven`
    : 'distance not recorded for these trips';
  const ratingLine = driver.hasReviews
    ? `${driver.averagePerformanceScore}/5 average review rating`
    : 'no performance reviews on file yet';
  const onTimeLine = driver.onTimeDeliveryRate !== null
    ? `${driver.onTimeDeliveryRate}% on-time delivery rate (${driver.onTimeSampleSize} of ${driver.completedTripsCount} trips had enough data to judge)`
    : 'not enough delivery-timestamp data to compute an on-time rate';

  return `
You are an HR/operations analyst at Calvary Investment Co. Ltd, a road
freight company in Tanzania. Write a short (3-4 sentence) coaching summary
for this driver based ONLY on the real metrics below — do not invent
numbers, incidents, or facts not given here. If a metric says data is
missing, say so plainly rather than guessing.

Driver: ${driver.name} (ID ${driver.employeeId})
Completed trips: ${driver.completedTripsCount}
Distance: ${distanceLine}
Revenue generated: TZS ${Number(driver.totalRevenueTZS).toLocaleString()}
Fuel cost: TZS ${Number(driver.totalFuelCostTZS).toLocaleString()}${driver.fuelPriceIsEstimate ? ' (estimated from an average rate, not exact)' : ''}
On-time delivery: ${onTimeLine}
Performance rating: ${ratingLine}
Incidents: not tracked in this system

Respond with plain text only, no markdown, no JSON.
`.trim();
}

export async function POST(req: Request) {
  try {
    await authenticateAiRequest(req); // paid LLM — require a valid session
    const body = await req.json().catch(() => ({}));
    const driver = body?.driver;
    if (!driver || !driver.name) {
      return NextResponse.json({ error: 'driver object is required' }, { status: 400 });
    }

    try {
      const result = await generateAI({
        system: buildPrompt(driver),
        messages: [{ role: 'user', content: [{ text: 'Write the coaching summary now.' }] }],
      });
      return NextResponse.json({ summary: result.text.trim(), provider: result.provider, generatedAt: new Date().toISOString(), source: 'driver and trip records supplied by the application' });
    } catch (err: any) {
      console.error('AI provider failed:', err);
      return NextResponse.json({ error: 'AI provider is unavailable. Check OPENROUTER_API_KEY or GROQ_API_KEY and retry.', code: 'AI_PROVIDER_UNAVAILABLE' }, { status: 502 });
    }
  } catch (err: any) {
    console.error('API driver-performance-summary error:', err);
    const status = err instanceof AiRequestAuthError ? err.status : 500;
    return NextResponse.json({ error: err.message || 'Server error' }, { status });
  }
}
