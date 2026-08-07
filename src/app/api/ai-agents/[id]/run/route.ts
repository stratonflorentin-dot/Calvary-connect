import { NextRequest, NextResponse } from 'next/server';
import { requireAgentAccess, authErrorResponse } from '@/lib/ai-agents/auth';
import { getAgentById } from '@/lib/ai-agents/roster';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { admin, userId } = await requireAgentAccess(request);
    const agent = getAgentById(id);
    if (!agent) {
      return NextResponse.json({ error: 'Unknown agent' }, { status: 404 });
    }

    let result;
    try {
      result = await agent.run();
    } catch (err: any) {
      console.error(`Agent ${agent.id} run failed:`, err);
      result = { status: 'error' as const, summary: err?.message || 'Agent run failed.' };
    }

    await admin.from('ai_agent_runs').insert({
      agent_id: agent.id,
      status: result.status,
      summary: result.summary,
      data: result.data ?? null,
      triggered_by: userId,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    const { status, body } = authErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
