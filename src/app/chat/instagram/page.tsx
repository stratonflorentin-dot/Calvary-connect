"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/hooks/use-role";
import { PageShell, PageHeader, EmptyState } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Instagram, Send, Loader2, Shield } from "lucide-react";
import { sendInstagramReply } from "./actions";

const INBOX_ROLES = ["CEO", "ADMIN", "SALESMAN", "OPERATOR"];

interface Conversation {
  id: string;
  ig_sender_id: string;
  ig_username: string | null;
  last_message_at: string | null;
}

interface Message {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  content: string | null;
  media_url: string | null;
  created_at: string;
}

export default function InstagramInboxPage() {
  const { role, isAdmin, isLoading: roleLoading } = useRole();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const canView = isAdmin || INBOX_ROLES.includes(String(role || "").toUpperCase());

  const loadConversations = async () => {
    const { data } = await supabase
      .from("instagram_conversations")
      .select("id, ig_sender_id, ig_username, last_message_at")
      .order("last_message_at", { ascending: false, nullsFirst: false });
    setConversations(data ?? []);
  };

  const loadMessages = async (conversationId: string) => {
    const { data } = await supabase
      .from("instagram_messages")
      .select("id, conversation_id, direction, content, media_url, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages(data ?? []);
  };

  useEffect(() => {
    if (!canView) return;
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!canView) return;
    const channel = supabase
      .channel("instagram_messages_inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "instagram_messages" }, (payload) => {
        const m = payload.new as Message;
        if (m.conversation_id === activeId) setMessages((prev) => [...prev, m]);
        loadConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, activeId]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const send = async () => {
    if (!activeId || !reply.trim()) return;
    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated");
      const result = await sendInstagramReply(token, activeId, reply.trim());
      if (!result.success) throw new Error(result.error || "Send failed");
      setReply("");
      await loadMessages(activeId);
    } catch (err) {
      // Non-blocking — the input keeps the drafted text so the user can retry.
      console.error("[instagram-inbox] send failed", err);
    } finally {
      setSending(false);
    }
  };

  if (roleLoading) return null;

  if (!canView) {
    return (
      <PageShell>
        <EmptyState icon={Shield} title="Access denied" description="You don't have permission to view the Instagram inbox." />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Client Messaging"
        title="Instagram"
        subtitle="Direct messages from @calvarytransport.tz"
        icon={Instagram}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[70vh]">
        <div className="border border-border rounded-xl overflow-y-auto">
          {conversations.length === 0 ? (
            <EmptyState icon={Instagram} title="No conversations yet" description="Incoming Instagram DMs will appear here." />
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-border hover:bg-muted/40 transition-colors",
                  activeId === c.id && "bg-muted/60",
                )}
              >
                <p className="text-sm font-bold text-foreground">{c.ig_username || `IG user ${c.ig_sender_id.slice(0, 8)}`}</p>
                <p className="text-xs text-muted-foreground">
                  {c.last_message_at ? new Date(c.last_message_at).toLocaleString() : "—"}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="md:col-span-2 border border-border rounded-xl flex flex-col">
          {!activeConversation ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className={cn("flex", m.direction === "outbound" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[75%] rounded-xl px-3 py-2 text-sm",
                        m.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                      )}
                    >
                      {m.content && <p>{m.content}</p>}
                      {m.media_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.media_url} alt="Attachment" className="mt-1 rounded-lg max-h-48" />
                      )}
                      <p className="text-[10px] opacity-70 mt-1">{new Date(m.created_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="flex items-center gap-2 p-3 border-t border-border">
                <Input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !sending) send(); }}
                  placeholder="Reply on Instagram…"
                  disabled={sending}
                />
                <Button onClick={send} disabled={sending || !reply.trim()} size="icon">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
