"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Loader2, MessageSquare, Play } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { AgentMetadata } from "@/lib/ai-agents/metadata";
import { AgentChatDrawer } from "./AgentChatDrawer";

interface RunResult {
  status: "ok" | "error";
  summary: string;
}

export function AgentCard({ agent, onRan }: { agent: AgentMetadata; onRan?: () => void }) {
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<RunResult | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const res = await fetch(`/api/ai-agents/${agent.id}/run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Agent run failed");
      setLastResult(json);
      onRan?.();
    } catch (err: any) {
      setLastResult({ status: "error", summary: err.message || "Agent run failed" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="size-5 text-indigo-600 shrink-0" />
          {agent.name}
          <Badge variant="outline" className="ml-auto text-[10px] uppercase tracking-wide">
            {agent.category}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{agent.description}</p>

        {lastResult && (
          <div
            className={cn(
              "text-xs rounded-lg border p-3",
              lastResult.status === "ok" ? "bg-muted/50 border-border" : "bg-destructive/10 border-destructive/30 text-destructive",
            )}
          >
            {lastResult.summary}
          </div>
        )}

        <div className="mt-auto flex gap-2 pt-2">
          <Button size="sm" onClick={handleRun} disabled={running} className="flex-1">
            {running ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
            {running ? "Running..." : "Run now"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setChatOpen(true)}>
            <MessageSquare className="mr-2 size-4" />
            Chat
          </Button>
        </div>
      </CardContent>

      <AgentChatDrawer agent={agent} open={chatOpen} onOpenChange={setChatOpen} />
    </Card>
  );
}
