import { NextRequest, NextResponse } from 'next/server';
import { requireAgentAccess, authErrorResponse } from '@/lib/ai-agents/auth';
import { getAgentById } from '@/lib/ai-agents/roster';
import { getFleetContext } from '@/lib/ai-database-context';
import { generateAI } from '@/lib/ai-provider';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { admin, userId } = await requireAgentAccess(request);
    const agent = getAgentById(id);
    if (!agent) {
      return NextResponse.json({ error: 'Unknown agent' }, { status: 404 });
    }

    const { data } = await admin
      .from('ai_agent_messages')
      .select('id, role, content, created_at')
      .eq('agent_id', agent.id)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(50);

    return NextResponse.json({ messages: data || [] });
  } catch (err: any) {
    const { status, body } = authErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { admin, userId } = await requireAgentAccess(request);
    const agent = getAgentById(id);
    if (!agent) {
      return NextResponse.json({ error: 'Unknown agent' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const message: string = body?.message;
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const { data: priorMessages } = await admin
      .from('ai_agent_messages')
      .select('role, content')
      .eq('agent_id', agent.id)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    const history = (priorMessages || []).slice().reverse();

    await admin.from('ai_agent_messages').insert({ agent_id: agent.id, user_id: userId, role: 'user', content: message });

    const context = await getFleetContext();
    const system = agent.chatSystemPrompt(context);
    const formattedHistory = history.map((h: any) => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      content: [{ text: h.content }],
    }));

    let reply: string;
    try {
      const result = await generateAI({ system, messages: [...formattedHistory, { role: 'user', content: [{ text: message }] }] });
      reply = result.text.trim();
    } catch (err: any) {
      console.error(`Agent ${agent.id} chat failed:`, err);
      if (process.env.NODE_ENV !== 'production') {
        reply = 'Mock response — AI provider unavailable in this environment.';
      } else {
        return NextResponse.json({ error: err?.message || 'AI provider error' }, { status: 502 });
      }
    }

    await admin.from('ai_agent_messages').insert({ agent_id: agent.id, user_id: userId, role: 'assistant', content: reply });

    return NextResponse.json({ reply });
  } catch (err: any) {
    const { status, body } = authErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
