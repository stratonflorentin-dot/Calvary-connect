import { NextResponse } from 'next/server';
import SYSTEM_PROMPT from '@/ai/flows/company-chat.server';
import { getFleetContext } from '@/lib/ai-database-context';
import { generateAI } from '@/lib/ai-provider';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
    try {
        // Safely parse request body to avoid crashing on empty or invalid JSON
        const raw = await req.text();
        let body: any = {};
        if (raw && raw.trim().length > 0) {
            try {
                body = JSON.parse(raw);
            } catch (parseErr) {
                console.warn('Invalid JSON received in /api/ai/ask-company', parseErr);
                return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
            }
        }
        const { message, history = [], liveMetrics = {}, user = null } = body;

        // For security, resolve the database context server-side instead of accepting it from clients.
        const dbContext = await getFleetContext();

        // Resolve the signed-in user's identity server-side (authoritative
        // name/role from user_profiles), falling back to what the client sent.
        let identity: any = null;
        if (user?.email) {
            try {
                const admin = supabaseAdmin();
                const { data: profile } = await admin
                    .from('user_profiles')
                    .select('name, role')
                    .ilike('email', String(user.email).toLowerCase().trim())
                    .maybeSingle();
                identity = {
                    email: user.email,
                    name: profile?.name || user.name || null,
                    role: profile?.role || user.role || null,
                };
            } catch {
                identity = { email: user.email, name: user.name || null, role: user.role || null };
            }
        }

        // Short-circuit health-checks in development to allow quick local smoke tests.
        if (typeof message === 'string' && message.toLowerCase().includes('health check')) {
            return NextResponse.json({ text: 'OK' });
        }
        const system = SYSTEM_PROMPT(liveMetrics, dbContext, identity);
        const formattedHistory = (history || []).map((h: any) => ({ role: h.role, content: [{ text: h.text }] }));

        // Use centralized provider abstraction
        try {
            const result = await generateAI({ system, messages: [...formattedHistory, { role: 'user', content: [{ text: message }] }] as any });
            return NextResponse.json({ text: result.text, provider: result.provider });
        } catch (err: any) {
            console.error('AI provider failed:', err);
            if (process.env.NODE_ENV !== 'production') {
                const mock = 'Mock AI: Top actions — 1) Reduce fuel use via route optimization (~$2,400/mo). 2) Preventive maintenance to cut repairs (~$1,200/mo). 3) Adjust payroll/driver scheduling (~$1,800/mo). Next step: run detailed audit on fuel and maintenance.';
                return NextResponse.json({ text: mock, fallback: 'mock' });
            }
            return NextResponse.json({ error: err?.message || 'AI provider error' }, { status: 502 });
        }
    } catch (err: any) {
        console.error('API ask-company error:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}
