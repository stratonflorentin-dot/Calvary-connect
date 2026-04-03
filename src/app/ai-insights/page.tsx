"use client";

export const dynamic = 'force-dynamic';

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { AiInsightPanel } from '@/components/dashboard/ai-insight-panel';

export default function AiInsightsPage() {
  const { role } = useRole();
  if (!role) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-headline tracking-tighter">AI Operations Insights</h1>
          <p className="text-muted-foreground text-sm font-sans">Full analysis view powered by Genkit.</p>
        </header>
        <div className="max-w-4xl">
          <AiInsightPanel />
        </div>
      </main>
    </div>
  );
}
