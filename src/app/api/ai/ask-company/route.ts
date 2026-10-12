import { NextResponse } from 'next/server';
import SYSTEM_PROMPT from '@/ai/flows/company-chat.server';
import { computeBusinessMetrics, getFleetContext } from '@/lib/ai-database-context';
import { generateAI } from '@/lib/ai-provider';
import { AiRequestAuthError, authenticateAiRequest } from '@/lib/ai-request-auth';

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
        const { message } = body;
        if (typeof message !== 'string' || !message.trim()) {
            return NextResponse.json({ error: 'Enter a message for the AI analyst.' }, { status: 400 });
        }
        if (message.length > 8000) return NextResponse.json({ error: 'Message is too long. Keep it under 8,000 characters.' }, { status: 413 });

        const history = Array.isArray(body.history)
            ? body.history.slice(-12).filter((item: any) => ['user', 'model'].includes(item?.role) && typeof item?.text === 'string').map((item: any) => ({ role: item.role, text: item.text.slice(0, 4000) }))
            : [];

        const { profile, dataClient } = await authenticateAiRequest(req);

        const dbContext = await getFleetContext(dataClient);
        const computed = computeBusinessMetrics(dbContext);
        const currencies = new Set([...Object.keys(computed.revenueThisMonthByCurrency), ...Object.keys(computed.expensesThisMonthByCurrency)]);
        const profitThisMonthByCurrency = Object.fromEntries([...currencies].map((currency) => [
            currency,
            (computed.revenueThisMonthByCurrency[currency] || 0) - (computed.expensesThisMonthByCurrency[currency] || 0),
        ]));
        const liveMetrics = {
            fleetSize: dbContext.vehicles.length,
            utilization: `${computed.fleetUtilization}%`,
            activeTrips: computed.activeTripsCount,
            revenue: computed.revenueThisMonthByCurrency,
            expenses: computed.expensesThisMonthByCurrency,
            profit: profitThisMonthByCurrency,
            activeContracts: computed.activeContracts,
            expiringContracts: computed.expiringContracts,
            overdueMaintenanceCount: computed.overdueMaintenanceCount,
            totalFuelCost: computed.totalFuelCost,
            monthlyTrips: computed.deliveredTripsThisMonthCount,
            openQuotations: computed.openQuotationsCount,
            overdueReceivables: computed.overdueReceivablesByCurrency,
        };
        const identity = { email: profile.email || '', name: profile.name || null, role: profile.role || null };

        // Short-circuit health-checks in development to allow quick local smoke tests.
        if (typeof message === 'string' && message.toLowerCase().includes('health check')) {
            return NextResponse.json({ text: 'OK' });
        }
        const system = SYSTEM_PROMPT(liveMetrics, dbContext, identity);
        const formattedHistory = history.map((h: any) => ({ role: h.role, content: [{ text: h.text }] }));

        // Use centralized provider abstraction
        try {
            const result = await generateAI({ system, messages: [...formattedHistory, { role: 'user', content: [{ text: message }] }] as any });
            return NextResponse.json({
                text: result.text,
                provider: result.provider,
                generatedAt: new Date().toISOString(),
                source: 'current fleet, trip, finance and operations records',
                dataHealth: dbContext.dataHealth,
            });
        } catch (err: any) {
            console.error('AI provider failed:', err);
            return NextResponse.json({ error: 'AI provider is unavailable. Check OPENROUTER_API_KEY or GROQ_API_KEY and retry.', code: 'AI_PROVIDER_UNAVAILABLE' }, { status: 502 });
        }
    } catch (err: any) {
        console.error('API ask-company error:', err);
        const status = err instanceof AiRequestAuthError ? err.status : 500;
        return NextResponse.json({ error: err.message || 'Server error' }, { status });
    }
}
