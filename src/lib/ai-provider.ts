// Server-side AI provider abstraction.
// Chooses provider by `AI_PROVIDER` env (openrouter|genkit) or falls back.
import { NextResponse } from 'next/server';

type Msg = { role: string; content: Array<{ text: string }> };

export async function generateAI(opts: { system: string; messages: Msg[] }) {
    const { system, messages } = opts;
    const preferred = (process.env.AI_PROVIDER || '').toLowerCase();
    const openKey = process.env.OPENROUTER_API_KEY;

    const tryOpenRouter = async () => {
        if (!openKey) throw new Error('No OpenRouter key');
        const orMessages = [
            { role: 'system', content: system },
            ...messages.map((m) => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content[0].text })),
            // user prompt should be included in messages already
        ];

        const resp = await fetch('https://api.openrouter.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${openKey}`,
            },
            body: JSON.stringify({ model: 'claude-sonnet-4-20250514', messages: orMessages, max_tokens: 1000 }),
        });

        const raw = await resp.text();
        if (!resp.ok) {
            // try parse JSON error if possible
            try {
                const parsed = JSON.parse(raw);
                throw new Error(`OpenRouter error: ${JSON.stringify(parsed)}`);
            } catch (e) {
                throw new Error(`OpenRouter error status=${resp.status} body=${raw.slice(0, 1000)}`);
            }
        }

        try {
            const json = JSON.parse(raw);
            const text = json?.choices?.[0]?.message?.content || json?.choices?.[0]?.text || JSON.stringify(json);
            return { text: String(text), provider: 'openrouter' };
        } catch (e) {
            return { text: raw, provider: 'openrouter' };
        }
    };

    const tryGenkit = async () => {
        // dynamic import to avoid bundling node-only libs into client
        const { createGenkit } = await import('../ai/genkit');
        if (typeof createGenkit !== 'function') throw new Error('genkit factory not available');
        const ai = await createGenkit();
        const response = await ai.generate({ system, messages });
        const text = (response as any).text || '';
        return { text, provider: 'genkit' };
    };

    // Decide order
    if (preferred === 'openrouter') {
        try {
            return await tryOpenRouter();
        } catch (err) {
            console.error('OpenRouter preferred but failed:', err);
            return await tryGenkit();
        }
    }

    if (preferred === 'genkit') {
        try {
            return await tryGenkit();
        } catch (err) {
            console.error('Genkit preferred but failed:', err);
            if (openKey) return await tryOpenRouter();
            throw err;
        }
    }

    // Default: try OpenRouter if key present, else genkit
    if (openKey) {
        try {
            return await tryOpenRouter();
        } catch (err) {
            console.warn('OpenRouter failed, falling back to genkit:', err.message || err);
            return await tryGenkit();
        }
    }

    // Last resort genkit
    return await tryGenkit();
}

export function ensureServer() {
    if (typeof window !== 'undefined') throw new Error('ai-provider must be used on server');
}
