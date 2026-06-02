import { NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import SYSTEM_PROMPT from '@/ai/flows/company-chat';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { message, history = [], liveMetrics = {}, dbContext = {} } = body;

        const system = SYSTEM_PROMPT(liveMetrics, dbContext);
        const formattedHistory = (history || []).map((h: any) => ({ role: h.role, content: [{ text: h.text }] }));

        const response = await ai.generate({
            system,
            messages: [...formattedHistory, { role: 'user', content: [{ text: message }] }],
        });

        const text = (response as any).text || '';
        return NextResponse.json({ text });
    } catch (err: any) {
        console.error('API ask-company error:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
