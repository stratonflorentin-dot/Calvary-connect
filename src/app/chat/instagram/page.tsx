"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/hooks/use-role";
import { PageShell, PageHeader, EmptyState } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Instagram, Send, Loader2, Shield, Search } from "lucide-react";
import { sendInstagramReply } from "./actions";

const INBOX_ROLES = ["CEO", "ADMIN", "SALESMAN", "OPERATOR"];

interface Conversation {
  id: string;
  ig_sender_id: string;
  ig_username: string | null;
  last_message_at: string | null;
  is_read: boolean;
  assigned_to: string | null;
  customer_id: string | null;
}

interface Message {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  content: string | null;
  media_url: string | null;
  created_at: string;
}

interface StaffOption {
  id: string;
  name: string;
}

interface CustomerOption {
  id: string;
  company_name: string;
}

export default function InstagramInboxPage() {
  const { role, isAdmin, isLoading: roleLoading } = useRole();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const canView = isAdmin || INBOX_ROLES.includes(String(role || "").toUpperCase());

  const loadConversations = async () => {
    const { data } = await supabase
      .from("instagram_conversations")
      .select("id, ig_sender_id, ig_username, last_message_at, is_read, assigned_to, customer_id")
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
    supabase.from("user_profiles").select("id, name").in("role", INBOX_ROLES).order("name")
      .then(({ data }) => setStaff(data ?? []));
    supabase.from("customers").select("id, company_name").order("company_name")
      .then(({ data }) => setCustomers(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const openConversation = async (conversation: Conversation) => {
    setActiveId(conversation.id);
    if (!conversation.is_read) {
      setConversations((prev) => prev.map((c) => (c.id === conversation.id ? { ...c, is_read: true } : c)));
      await supabase.from("instagram_conversations").update({ is_read: true }).eq("id", conversation.id);
    }
  };

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

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? conversations.filter((c) => (c.ig_username || c.ig_sender_id).toLowerCase().includes(q))
      : conversations;
    // Unread first, then most recent.
    return [...list].sort((a, b) => {
      if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
      return (b.last_message_at || "").localeCompare(a.last_message_at || "");
    });
  }, [conversations, search]);

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

  const assignTo = async (userId: string) => {
    if (!activeId) return;
    const value = userId === "__none" ? null : userId;
    setConversations((prev) => prev.map((c) => (c.id === activeId ? { ...c, assigned_to: value } : c)));
    await supabase.from("instagram_conversations").update({ assigned_to: value }).eq("id", activeId);
  };

  const linkToCustomer = async (customerId: string) => {
    if (!activeId) return;
    const value = customerId === "__none" ? null : customerId;
    setConversations((prev) => prev.map((c) => (c.id === activeId ? { ...c, customer_id: value } : c)));
    await supabase.from("instagram_conversations").update({ customer_id: value }).eq("id", activeId);
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
        <div className="border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <EmptyState icon={Instagram} title="No conversations" description="Incoming Instagram DMs will appear here." />
            ) : (
              filteredConversations.map((c) => {
                const assignee = staff.find((s) => s.id === c.assigned_to);
                return (
                  <button
                    key={c.id}
                    onClick={() => openConversation(c)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-border hover:bg-muted/40 transition-colors",
                      activeId === c.id && "bg-muted/60",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {!c.is_read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                      <p className={cn("text-sm truncate", c.is_read ? "font-medium text-foreground" : "font-black text-foreground")}>
                        {c.ig_username || `IG user ${c.ig_sender_id.slice(0, 8)}`}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground">
                        {c.last_message_at ? new Date(c.last_message_at).toLocaleString() : "—"}
                      </p>
                      {assignee && <span className="text-[10px] text-primary font-bold">{assignee.name}</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="md:col-span-2 border border-border rounded-xl flex flex-col">
          {!activeConversation ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 p-3 border-b border-border flex-wrap">
                <p className="text-sm font-bold text-foreground mr-auto">
                  {activeConversation.ig_username || `IG user ${activeConversation.ig_sender_id.slice(0, 8)}`}
                </p>
                <Select value={activeConversation.assigned_to ?? "__none"} onValueChange={assignTo}>
                  <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Assign to" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Unassigned</SelectItem>
                    {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={activeConversation.customer_id ?? "__none"} onValueChange={linkToCustomer}>
                  <SelectTrigger className="h-8 text-xs w-48"><SelectValue placeholder="Link to customer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No customer linked</SelectItem>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
