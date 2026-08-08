"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AGENT_METADATA } from "@/lib/ai-agents/metadata";
import { useAiAgentActivity } from "@/hooks/data/use-ai-agent-activity";

const agentNameById = new Map(AGENT_METADATA.map((a) => [a.id, a.name]));

export function ActivityFeed() {
  const { items, loading, error, refresh } = useAiAgentActivity();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-5 text-muted-foreground" />
          Agent Activity
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </Button>
      </CardHeader>
      <CardContent>
        {error && <p className="text-xs text-destructive mb-2">{error}</p>}
        {!loading && items.length === 0 && (
          <p className="text-xs text-muted-foreground">No agent activity yet — run an agent or start a chat.</p>
        )}
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {items.map((item) => (
            <div
              key={`${item.kind}-${item.id}`}
              className={cn(
                "text-xs rounded-lg border p-3",
                item.status === "error" ? "bg-destructive/10 border-destructive/30" : "bg-muted/40 border-border",
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold">{agentNameById.get(item.agentId) || item.agentId}</span>
                <Badge variant="outline" className="text-[9px] uppercase">
                  {item.kind}
                </Badge>
              </div>
              <p className="text-muted-foreground line-clamp-3">{item.text}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
