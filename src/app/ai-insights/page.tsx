"use client";

export const dynamic = 'force-dynamic';

import { PageShell, PageHeader } from '@/components/shell';
import { useRole } from '@/hooks/use-role';
import { AIAnalysisDashboard } from '@/components/dashboard/ai-analysis-dashboard';
import { Sparkles } from 'lucide-react';

export default function AiInsightsPage() {
  const { role } = useRole();
  if (!role) return null;

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Intelligence"
        title="AI Fleet Analyst"
        subtitle="AI-powered analysis with full database access — ask anything about your fleet"
        icon={Sparkles}
      />
      <AIAnalysisDashboard />
    </PageShell>
  );
}
