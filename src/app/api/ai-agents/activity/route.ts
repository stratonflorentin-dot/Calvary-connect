import { NextRequest, NextResponse } from 'next/server';
import { requireAgentAccess, authErrorResponse } from '@/lib/ai-agents/auth';

export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireAgentAccess(request);

    const [{ data: runs }, { data: messages }] = await Promise.all([
      admin
        .from('ai_agent_runs')
        .select('id, agent_id, status, summary, created_at')
        .order('created_at', { ascending: false })
        .limit(30),
      admin
        .from('ai_agent_messages')
        .select('id, agent_id, content, created_at')
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    const items = [
      ...(runs || []).map((r: any) => ({
        kind: 'run' as const,
        id: r.id,
        agentId: r.agent_id,
        status: r.status as 'ok' | 'error',
        text: r.summary as string,
        createdAt: r.created_at as string,
      })),
      ...(messages || []).map((m: any) => ({
        kind: 'chat' as const,
        id: m.id,
        agentId: m.agent_id,
        status: 'ok' as const,
        text: m.content as string,
        createdAt: m.created_at as string,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 30);

    return NextResponse.json({ items });
  } catch (err: any) {
    const { status, body } = authErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
