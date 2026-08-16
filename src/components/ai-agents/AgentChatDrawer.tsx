"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Bot, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { AgentMetadata } from "@/lib/ai-agents/metadata";

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

export function AgentChatDrawer({
  agent,
  open,
  onOpenChange,
}: {
  agent: AgentMetadata;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      setLoadingHistory(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not signed in");
        const res = await fetch(`/api/ai-agents/${agent.id}/chat`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load chat history");
        if (mounted) setMessages(json.messages || []);
      } catch (err: any) {
        if (mounted) setError(err.message || "Failed to load chat history");
      } finally {
        if (mounted) setLoadingHistory(false);
      }
    })();
    return () => { mounted = false; };
  }, [open, agent.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const res = await fetch(`/api/ai-agents/${agent.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ message: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Chat request failed");
      setMessages((prev) => [...prev, { role: "assistant", content: json.reply }]);
    } catch (err: any) {
      setError(err.message || "Chat request failed");
    } finally {
      setSending(false);
    }
  };

  const handleClear = async () => {
    if (clearing || messages.length === 0) return;
    if (!window.confirm(`Clear the conversation with ${agent.name}? This can't be undone.`)) return;

    setClearing(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const res = await fetch(`/api/ai-agents/${agent.id}/chat`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to clear chat");
      setMessages([]);
    } catch (err: any) {
      setError(err.message || "Failed to clear chat");
    } finally {
      setClearing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between gap-2 pr-8">
            <SheetTitle className="flex items-center gap-2">
              <Bot className="size-5 text-primary" />
              {agent.name}
            </SheetTitle>
            {messages.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={handleClear}
                disabled={clearing}
              >
                {clearing ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                Clear
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 text-sm">
          {loadingHistory && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="animate-spin size-5" />
            </div>
          )}
          {!loadingHistory && messages.length === 0 && (
            <p className="text-muted-foreground text-xs">
              Ask {agent.name} anything about its domain — it has live fleet data to work from.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={m.id || i}
              className={cn(
                "max-w-[90%] rounded-2xl p-3 leading-relaxed",
                m.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground rounded-tr-sm"
                  : "mr-auto bg-muted text-foreground border rounded-tl-sm",
              )}
            >
              <div className="whitespace-pre-line text-[13px]">{m.content}</div>
            </div>
          ))}
          {sending && (
            <div className="mr-auto bg-muted border rounded-2xl p-3 flex items-center gap-2 text-muted-foreground text-xs">
              <Loader2 className="animate-spin size-4" /> Thinking...
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div ref={endRef} />
        </div>

        <form onSubmit={handleSend} className="p-3 border-t flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask ${agent.name}...`}
            disabled={sending}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={sending || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
