import { NextResponse } from 'next/server';
import { generateAI } from '@/lib/ai-provider';
import { AiRequestAuthError, authenticateAiRequest } from '@/lib/ai-request-auth';

function buildPrompt(customer: any): string {
  return `
You are a customer-relationship analyst at Calvary Investment Co. Ltd, a
road freight company in Tanzania. Write a short (3-4 sentence) relationship
summary for this customer based ONLY on the real metrics below — do not
invent numbers or facts not given here. If a metric is missing/zero, say so
plainly (e.g. "no quotations yet") rather than guessing why.

Customer: ${customer.company_name}
Status: ${customer.status}
Risk level: ${customer.risk_level || 'not set'}
Bookings: ${customer.bookingsCount} (total revenue Tsh ${Number(customer.totalBookingRevenue).toLocaleString()})
Quotations: ${customer.quotationsCount}, conversion rate: ${customer.conversionRate !== null ? `${customer.conversionRate}%` : 'no quotations yet'}
Invoices: Tsh ${Number(customer.totalPaid).toLocaleString()} paid, Tsh ${Number(customer.totalOutstanding).toLocaleString()} outstanding
Days since last recorded activity: ${customer.daysSinceLastActivity ?? 'unknown (no activity recorded)'}

Respond with plain text only, no markdown, no JSON.
`.trim();
}

export async function POST(req: Request) {
  try {
    await authenticateAiRequest(req); // paid LLM — require a valid session
    const body = await req.json().catch(() => ({}));
    const customer = body?.customer;
    if (!customer || !customer.company_name) {
      return NextResponse.json({ error: 'customer object is required' }, { status: 400 });
    }

    try {
      const result = await generateAI({
        system: buildPrompt(customer),
        messages: [{ role: 'user', content: [{ text: 'Write the relationship summary now.' }] }],
      });
      return NextResponse.json({ summary: result.text.trim(), provider: result.provider, generatedAt: new Date().toISOString(), source: 'customer records supplied by the application' });
    } catch (err: any) {
      console.error('AI provider failed:', err);
      return NextResponse.json({ error: 'AI provider is unavailable. Check OPENROUTER_API_KEY or GROQ_API_KEY and retry.', code: 'AI_PROVIDER_UNAVAILABLE' }, { status: 502 });
    }
  } catch (err: any) {
    console.error('API customer-relationship-summary error:', err);
    const status = err instanceof AiRequestAuthError ? err.status : 500;
    return NextResponse.json({ error: err.message || 'Server error' }, { status });
  }
}
