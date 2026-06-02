import { NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  try {
    // Small test generation to validate genkit is callable
    const response = await ai.generate({
      system: 'Diagnostic: return short OK',
      messages: [{ role: 'user', content: [{ text: 'ping' }] }],
    } as any);

    return NextResponse.json({ ok: true, result: response });
  } catch (err: any) {
    console.error('AI diagnostic error:', err);
    return NextResponse.json({ ok: false, error: err?.message, stack: err?.stack }, { status: 502 });
  }
}
