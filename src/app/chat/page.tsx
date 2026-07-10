"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { PageShell, PageHeader, EmptyState } from "@/components/shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Hash,
  Info,
  Loader2,
  MessageSquare,
  Navigation,
  Plus,
  Search,
  Send,
  Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Channel {
  id: string;
  name: string;
  type: "group" | "trip" | "direct";
  trip_id?: string | null;
  created_at: string;
}

interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string | null;
}

const MOCK_CHANNELS: Channel[] = [
  { id: "c1", name: "General Dispatch",     type: "group", created_at: new Date().toISOString() },
  { id: "c2", name: "Driver Announcements", type: "group", created_at: new Date().toISOString() },
  { id: "c3", name: "TRP-2024-001",         type: "trip",  created_at: new Date().toISOString() },
];

export default function InternalChatPage() {
  const { user } = useSupabase();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadChannels(); }, []);

  useEffect(() => {
    if (!activeChannel) return;
    loadMessages(activeChannel.id);
    const ch = supabase
      .channel(`chat_${activeChannel.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${activeChannel.id}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => [...prev, m]);
          scrollToBottom();
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeChannel]);

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const loadChannels = async () => {
    setLoading(true);
    try {
      const { data, error: dbErr } = await supabase
        .from("chat_channels")
        .select("*")
        .order("created_at", { ascending: false });
      if (dbErr) {
        if (dbErr.code === "42P01") {
          setError("Chat tables not found — run the internal_chat migration in Supabase to enable messaging.");
        } else {
          setError(dbErr.message);
        }
        setChannels(MOCK_CHANNELS);
        setActiveChannel(MOCK_CHANNELS[0]);
        return;
      }
      setChannels(data ?? []);
      if (data && data.length > 0) setActiveChannel(data[0]);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load channels");
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (channelId: string) => {
    // Fetch messages then hydrate sender names separately to avoid schema-cache FK issues.
    const { data: rows, error: dbErr } = await supabase
      .from("chat_messages")
      .select("id, channel_id, sender_id, content, created_at")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true });
    if (dbErr) return;
    const ids = Array.from(new Set((rows ?? []).map((r) => r.sender_id).filter(Boolean)));
    let nameMap = new Map<string, string>();
    if (ids.length > 0) {
      const { data: u } = await supabase.from("user_profiles").select("id, uid, name").in("id", ids);
      for (const p of u ?? []) nameMap.set(p.id ?? p.uid, p.name);
    }
    setMessages((rows ?? []).map((r) => ({ ...r, sender_name: nameMap.get(r.sender_id) ?? null })));
    scrollToBottom();
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !activeChannel || !user || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");
    // Optimistic append
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      channel_id: activeChannel.id,
      sender_id: user.id,
      content,
      created_at: new Date().toISOString(),
      sender_name: user.name ?? "You",
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom();

    const { error: dbErr } = await supabase.from("chat_messages").insert({
      channel_id: activeChannel.id,
      sender_id: user.id,
      content,
    });
    if (dbErr) {
      // Roll back optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setError("Failed to send message.");
    }
    setSending(false);
  };

  const filteredChannels = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (channels.length ? channels : []).filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [channels, search]);

  const groupChannels = filteredChannels.filter((c) => c.type === "group");
  const tripChannels = filteredChannels.filter((c) => c.type === "trip");
  const directChannels = filteredChannels.filter((c) => c.type === "direct");

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Team"
        title="Internal chat"
        subtitle={
          error
            ? "Preview mode — chat tables not migrated"
            : `${channels.length} channel${channels.length === 1 ? "" : "s"} · ${activeChannel ? `#${activeChannel.name}` : "no channel selected"}`
        }
        icon={MessageSquare}
        iconAccent="bg-primary text-primary-foreground"
      />

      <div className="cv-surface overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
        <div className="flex h-full">
          {/* Left rail */}
          <aside className="w-80 shrink-0 border-r border-border flex flex-col bg-muted/30">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Conversations</p>
                <button className="w-7 h-7 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center" title="New conversation">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-9 h-9 bg-card" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {loading && filteredChannels.length === 0 ? (
                <div className="py-8 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : filteredChannels.length === 0 ? (
                <p className="text-xs text-muted-foreground italic px-2">No conversations yet.</p>
              ) : (
                <>
                  {groupChannels.length > 0 && (
                    <Section label="Channels" items={groupChannels} icon={Hash} active={activeChannel} onPick={setActiveChannel} />
                  )}
                  {tripChannels.length > 0 && (
                    <Section label="Trips" items={tripChannels} icon={Navigation} active={activeChannel} onPick={setActiveChannel} />
                  )}
                  {directChannels.length > 0 && (
                    <Section label="Direct" items={directChannels} icon={Users} active={activeChannel} onPick={setActiveChannel} />
                  )}
                </>
              )}
            </div>
          </aside>

          {/* Main pane */}
          <section className="flex-1 flex flex-col min-w-0">
            {!activeChannel ? (
              <EmptyState icon={MessageSquare} title="Pick a channel" description="Select a conversation on the left to start chatting." />
            ) : (
              <>
                <header className="px-5 py-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
                    <h2 className="text-sm font-black text-foreground truncate">{activeChannel.name}</h2>
                  </div>
                  <button className="w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted flex items-center justify-center" title="Channel info">
                    <Info className="w-4 h-4" />
                  </button>
                </header>

                {error && (
                  <div className="bg-amber-50 text-amber-800 border-b border-amber-200 px-5 py-2 text-xs">
                    {error}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-muted/20">
                  {messages.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground italic mt-10">
                      No messages yet. Say hi 👋
                    </div>
                  ) : (
                    messages.map((m) => {
                      const mine = m.sender_id === user?.id;
                      return (
                        <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                          <div className={cn("max-w-lg", mine && "text-right")}>
                            {!mine && (
                              <p className="text-[10px] font-bold text-muted-foreground mb-0.5">
                                {m.sender_name ?? "Team member"}
                              </p>
                            )}
                            <div className={cn(
                              "rounded-2xl px-4 py-2 text-sm inline-block",
                              mine
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-card border border-border text-foreground rounded-bl-sm",
                            )}>
                              {m.content}
                            </div>
                            <p className={cn("text-[10px] text-muted-foreground mt-0.5", mine && "text-right")}>
                              {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={sendMessage} className="p-4 border-t border-border bg-card">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={`Message #${activeChannel.name}`}
                      className="flex-1 min-h-[44px] max-h-32 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                    />
                    <Button
                      type="submit"
                      disabled={!input.trim() || sending || Boolean(error)}
                      className="h-11 w-11 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground p-0 shrink-0"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </PageShell>
  );
}

function Section({
  label,
  items,
  icon: Icon,
  active,
  onPick,
}: {
  label: string;
  items: Channel[];
  icon: any;
  active: Channel | null;
  onPick: (c: Channel) => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2 mb-1">{label}</p>
      <div className="space-y-0.5">
        {items.map((c) => {
          const isActive = active?.id === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onPick(c)}
              className={cn(
                "w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-left transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground font-bold"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
              <span className="truncate">{c.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
