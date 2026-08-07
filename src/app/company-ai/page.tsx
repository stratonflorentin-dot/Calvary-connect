"use client";

export const dynamic = 'force-dynamic';

import Link from "next/link";
import { PageShell, PageHeader } from "@/components/shell";
import { useRole } from "@/hooks/use-role";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Sparkles, ArrowRight } from "lucide-react";
import { AGENT_METADATA } from "@/lib/ai-agents/metadata";
import { AgentCard } from "@/components/ai-agents/AgentCard";
import { ActivityFeed } from "@/components/ai-agents/ActivityFeed";
import { useAiAgentActivity } from "@/hooks/data/use-ai-agent-activity";

export default function CompanyAiPage() {
  const { role } = useRole();
  const { refresh } = useAiAgentActivity();
  if (!role) return null;

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Intelligence"
        title="Company AI"
        subtitle="A roster of AI agents, each watching one part of the business — run them on demand or ask them directly"
        icon={Bot}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {AGENT_METADATA.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onRan={refresh} />
          ))}

          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-5 text-indigo-600 shrink-0" />
                General Analyst
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Open-ended chat with full database access — the existing AI Fleet Analyst console.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-auto">
                <Link href="/ai-insights">
                  Open AI Fleet Analyst <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <ActivityFeed />
        </div>
      </div>
    </PageShell>
  );
}
