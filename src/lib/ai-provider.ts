// Server-side AI provider abstraction.
// Chooses provider by `AI_PROVIDER` env (openrouter|genkit) or falls back.

type Msg = { role: string; content: Array<{ text: string }> };
type Usage = { tokensIn: number; tokensOut: number } | null;

export async function generateAI(opts: { system: string; messages: Msg[] }): Promise<{ text: string; provider: string; usage: Usage }> {
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

        // Was 'https://api.openrouter.ai/...' — that host doesn't resolve at
        // all (confirmed via curl); the real API lives under openrouter.ai/api.
        // Also was hardcoded to an Anthropic model id, which OpenRouter's API
        // doesn't recognize (it expects "provider/model", e.g. the free model
        // already configured in .env) — every call silently failed over to
        // Genkit/Groq regardless of AI_PROVIDER.
        const baseUrl = process.env.NEXT_PUBLIC_OPENROUTER_BASE_URL || 'https://openrouter.ai/api';
        const model = process.env.NEXT_PUBLIC_OPENROUTER_MODEL || 'minimax/minimax-m2.5:free';

        const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${openKey}`,
            },
            body: JSON.stringify({ model, messages: orMessages, max_tokens: 1000 }),
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
            const usage: Usage = json?.usage
                ? { tokensIn: Number(json.usage.prompt_tokens) || 0, tokensOut: Number(json.usage.completion_tokens) || 0 }
                : null;
            return { text: String(text), provider: 'openrouter', usage };
        } catch (e) {
            return { text: raw, provider: 'openrouter', usage: null as Usage };
        }
    };

    const tryGenkit = async () => {
        // genkitx-groq (the genkit plugin previously used here) ships its own
        // small, hardcoded model allowlist that hasn't kept up with Groq's
        // actual catalog — confirmed live: of every model that plugin
        // recognizes, only "allam-2-7b" (a niche Arabic model, wrong for this
        // agent) still exists on Groq's API at all. gpt-oss-120b (Groq's
        // current general-purpose model, confirmed via a live /v1/models
        // call) isn't in the plugin's list under any prefix, so no model
        // string could ever satisfy it. Calling Groq's OpenAI-compatible API
        // directly sidesteps that stale allowlist entirely — same pattern as
        // tryOpenRouter above.
        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey) throw new Error('No Groq API key');
        const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
        const groqMessages = [
            { role: 'system', content: system },
            ...messages.map((m) => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content[0].text })),
        ];

        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
            body: JSON.stringify({ model, messages: groqMessages, max_tokens: 1000 }),
        });
        const raw = await resp.text();
        if (!resp.ok) throw new Error(`Groq error status=${resp.status} body=${raw.slice(0, 1000)}`);

        const json = JSON.parse(raw);
        const text = json?.choices?.[0]?.message?.content || '';
        const usage: Usage = json?.usage
            ? { tokensIn: Number(json.usage.prompt_tokens) || 0, tokensOut: Number(json.usage.completion_tokens) || 0 }
            : null;
        return { text, provider: 'groq', usage };
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
        } catch (err: any) {
            console.warn('OpenRouter failed, falling back to genkit:', err?.message || err);
            return await tryGenkit();
        }
    }

    // Last resort genkit
    return await tryGenkit();
}

export function ensureServer() {
    if (typeof window !== 'undefined') throw new Error('ai-provider must be used on server');
}
