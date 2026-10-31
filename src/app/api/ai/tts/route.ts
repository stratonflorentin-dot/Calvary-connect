import { NextResponse } from 'next/server';
import { AiRequestAuthError, authenticateAiRequest } from '@/lib/ai-request-auth';

export const runtime = 'nodejs';

// ElevenLabs voice "Mino" — the company AI Analyst's voice.
// Use the user's custom voice ID if provided, otherwise use default
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Default: Rachel
const MAX_CHARS = 2500;

export async function POST(req: Request) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
        return NextResponse.json(
            { error: 'Voice is not configured — add ELEVENLABS_API_KEY to the environment.' },
            { status: 503 },
        );
    }

    // Require a valid session — ElevenLabs TTS is a paid API, not for
    // unauthenticated use. (Reads only the Authorization header, so req.json()
    // below still works.)
    try {
        await authenticateAiRequest(req);
    } catch (err: any) {
        const status = err instanceof AiRequestAuthError ? err.status : 401;
        return NextResponse.json({ error: err?.message || 'Sign in to use voice.' }, { status });
    }

    let text = '';
    try {
        const body = await req.json();
        text = String(body?.text || '');
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    text = text.trim();
    if (!text) return NextResponse.json({ error: 'No text to speak' }, { status: 400 });

    // Strip markdown so the voice doesn't read symbols aloud.
    const spoken = text
        .replace(/```[\s\S]*?```/g, ' (code block omitted) ')
        .replace(/[#*_`>|]/g, ' ')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_CHARS);

    try {
        const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json',
                Accept: 'audio/mpeg',
            },
            body: JSON.stringify({
                text: spoken,
                model_id: 'eleven_turbo_v2_5',
                voice_settings: { stability: 0.5, similarity_boost: 0.75 },
            }),
        });

        if (!resp.ok || !resp.body) {
            const detail = await resp.text().catch(() => '');
            console.error('ElevenLabs TTS failed:', resp.status, detail.slice(0, 300));
            return NextResponse.json({ error: 'Voice service failed' }, { status: 502 });
        }

        return new NextResponse(resp.body, {
            headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
        });
    } catch (err: any) {
        console.error('TTS route error:', err);
        return NextResponse.json({ error: err?.message || 'Voice service error' }, { status: 502 });
    }
}
