"use client";

export const dynamic = 'force-dynamic';

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { ComprehensiveAIAnalysis } from '@/components/dashboard/comprehensive-ai-analysis';

export default function AiInsightsPage() {
  const { role, isAdmin } = useRole();
  if (!role) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">AI Company Analysis</h1>
          <p className="text-muted-foreground text-sm">Full company analysis powered by OpenRouter + Groq AI</p>
        </header>
        <div className="max-w-7xl">
          <ComprehensiveAIAnalysis />
        </div>
      </main>
    </div>
  );
}




