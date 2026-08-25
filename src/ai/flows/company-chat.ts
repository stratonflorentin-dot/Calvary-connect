'use client';

// The actual system prompt lives in company-chat.server.ts (server-only —
// imported by src/app/api/ai/ask-company/route.ts). This file used to also
// export its own duplicate SYSTEM_PROMPT, built before that server/client
// split existed; it was never imported by anything (askCompanyAI below
// just calls the API route, which builds its own prompt server-side) and
// had drifted out of sync — still reading trips.revenue (a dead column)
// and missing quotations/invoices/shipments entirely. Removed rather than
// left to rot as a second, wrong copy of the same prompt.

export async function askCompanyAI(
  userMessage: string,
  history: Array<{ role: string; content: string }> = [],
  liveMetrics: any = {},
  dbContext?: any
) {
  const res = await fetch('/api/ai/ask-company', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userMessage, history, liveMetrics })
  });
  if (!res.ok) throw new Error('AI request failed');
  const data = await res.json();
  return data.text;
}
