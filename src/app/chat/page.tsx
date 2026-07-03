"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import {
  MessageSquare, Hash, Users, Search, Plus, Send,
  MoreVertical, FileText, Phone, Video, Info,
  AlertCircle, Loader2, Navigation, CheckCircle2
} from "lucide-react";

// --- Types ---
interface Channel {
  id: string;
  name: string;
  type: "group" | "trip" | "direct";
  trip_id?: string;
  created_at: string;
}

interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    full_name: string;
    avatar?: string;
  };
}

// --- Components ---
export default function InternalChatPage() {
  const { user } = useSupabase();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    loadChannels();
  }, []);

  // Fetch messages when channel changes
  useEffect(() => {
    if (activeChannel) {
      loadMessages(activeChannel.id);
      
      // Subscribe to real-time messages
      const channel = supabase
        .channel(`chat_${activeChannel.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${activeChannel.id}` },
          (payload) => {
            const newMsg = payload.new as Message;
            // Fetch sender info for real-time msg (simplification: assume we just append)
            setMessages((prev) => [...prev, newMsg]);
            scrollToBottom();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeChannel]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const loadChannels = async () => {
    setLoading(true);
    try {
      const { data, error: dbErr } = await supabase
        .from("chat_channels")
        .select("*")
        .order("created_at", { ascending: false });

      if (dbErr) {
        // Handle case where table doesn't exist
        if (dbErr.code === "42P01") {
          setError("Chat tables not found. Please run the 004_internal_chat.sql migration in Supabase.");
        } else {
          setError(dbErr.message);
        }
        return;
      }

      setChannels(data || []);
      if (data && data.length > 0) {
        setActiveChannel(data[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (channelId: string) => {
    try {
      const { data, error: dbErr } = await supabase
        .from("chat_messages")
        .select(`
          id, channel_id, sender_id, content, created_at,
          sender:users!chat_messages_sender_id_fkey(full_name, avatar)
        `)
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true });

      if (!dbErr && data) {
        // Need to cast because of the join
        const formatted = data.map(msg => ({
          ...msg,
          sender: Array.isArray(msg.sender) ? msg.sender[0] : msg.sender
        })) as unknown as Message[];
        setMessages(formatted);
        scrollToBottom();
      }
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeChannel || !user) return;

    const content = input.trim();
    setInput("");

    // Optimistic UI update could go here
    const { error: dbErr } = await supabase
      .from("chat_messages")
      .insert({
        channel_id: activeChannel.id,
        sender_id: user.id,
        content: content
      });

    if (dbErr) {
      console.error("Failed to send message:", dbErr);
      setError("Failed to send message.");
    }
  };

  // Mock channels for display if error (to show UI without migration)
  const displayChannels = error ? MOCK_CHANNELS : channels;
  const displayMessages = error ? MOCK_MESSAGES : messages;
  const currentChannel = error ? MOCK_CHANNELS[0] : activeChannel;

  return (
    <div className="h-[calc(100vh-theme(spacing.16))] bg-white flex overflow-hidden border-t border-gray-100">
      {/* ── Sidebar ── */}
      <div className="w-80 flex-shrink-0 border-r border-gray-100 flex flex-col bg-slate-50/50">
        <div className="p-4 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-500" /> Messages
            </h2>
            <button className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          {loading && !error ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* Channels */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Channels</p>
                <div className="space-y-1">
                  {displayChannels.filter(c => c.type === "group").map(c => (
                    <button
                      key={c.id}
                      onClick={() => !error && setActiveChannel(c)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                        currentChannel?.id === c.id ? "bg-indigo-500 text-white shadow-md shadow-indigo-200" : "text-slate-600 hover:bg-slate-200/50"
                      }`}
                    >
                      <Hash className={`w-4 h-4 ${currentChannel?.id === c.id ? "text-indigo-200" : "text-slate-400"}`} />
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Trips */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Trip Comm</p>
                <div className="space-y-1">
                  {displayChannels.filter(c => c.type === "trip").map(c => (
                    <button
                      key={c.id}
                      onClick={() => !error && setActiveChannel(c)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                        currentChannel?.id === c.id ? "bg-indigo-500 text-white shadow-md shadow-indigo-200" : "text-slate-600 hover:bg-slate-200/50"
                      }`}
                    >
                      <Navigation className={`w-4 h-4 ${currentChannel?.id === c.id ? "text-indigo-200" : "text-emerald-500"}`} />
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col bg-white relative">
        {/* Error overlay (if migration missing) */}
        {error && (
          <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="max-w-md bg-white p-6 rounded-2xl shadow-2xl border border-red-100 text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-2">Database Setup Required</h3>
              <p className="text-sm text-slate-600 mb-4">{error}</p>
              <div className="p-4 bg-slate-50 rounded-xl text-xs font-mono text-left text-slate-700 border border-slate-200">
                Please execute the migration script located at:<br/>
                <span className="font-bold text-indigo-600">supabase/migrations/004_internal_chat.sql</span>
              </div>
              <p className="text-xs text-slate-400 mt-4">Showing a preview of the UI in the background.</p>
            </div>
          </div>
        )}

        {/* Chat Header */}
        <div className="h-16 px-6 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${currentChannel?.type === 'trip' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
              {currentChannel?.type === 'trip' ? <Navigation className="w-5 h-5" /> : <Hash className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">{currentChannel?.name || "Select a channel"}</h3>
              <p className="text-xs text-slate-400">
                {currentChannel?.type === 'trip' ? 'Active Dispatch Channel' : 'Company Wide Channel'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Phone className="w-4 h-4" /></button>
            <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Video className="w-4 h-4" /></button>
            <div className="w-px h-6 bg-gray-200 mx-1"></div>
            <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Info className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Messages feed */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          <div className="space-y-6 max-w-4xl mx-auto">
            {displayMessages.map((msg, i) => {
              const isMe = msg.sender_id === user?.id || (error && msg.sender_id === "me");
              return (
                <div key={msg.id} className={`flex gap-3 ${isMe ? "justify-end" : ""}`}>
                  {!isMe && (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-700 font-bold text-xs mt-1">
                      {msg.sender?.full_name?.charAt(0) || "U"}
                    </div>
                  )}
                  <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[70%]`}>
                    {!isMe && (
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-xs font-bold text-slate-700">{msg.sender?.full_name || "User"}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                    <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                      isMe 
                        ? "bg-indigo-600 text-white rounded-br-sm shadow-md shadow-indigo-200" 
                        : "bg-white text-slate-700 border border-gray-100 rounded-bl-sm shadow-sm"
                    }`}>
                      {msg.content}
                    </div>
                    {isMe && (
                      <div className="flex items-center gap-1 mt-1 pr-1">
                        <span className="text-[10px] text-slate-400">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message Input */}
        <div className="p-4 bg-white border-t border-gray-100">
          <form onSubmit={sendMessage} className="max-w-4xl mx-auto relative flex items-end gap-2">
            <div className="flex-1 bg-slate-100 rounded-2xl p-2 flex items-center gap-2 border border-transparent focus-within:border-indigo-300 focus-within:bg-white transition-all">
              <button type="button" className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors shrink-0">
                <Plus className="w-5 h-5" />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-transparent border-none outline-none resize-none max-h-32 min-h-[40px] text-sm py-2.5"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e);
                  }
                }}
              />
              <button type="button" className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors shrink-0">
                <FileText className="w-5 h-5" />
              </button>
            </div>
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:shadow-none"
            >
              <Send className="w-5 h-5 ml-1" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// --- Mock Data for Preview ---
const MOCK_CHANNELS: Channel[] = [
  { id: "c1", name: "General Dispatch", type: "group", created_at: new Date().toISOString() },
  { id: "c2", name: "Driver Announcements", type: "group", created_at: new Date().toISOString() },
  { id: "c3", name: "TRP-2024-001 (Mombasa)", type: "trip", created_at: new Date().toISOString() },
];

const MOCK_MESSAGES: Message[] = [
  { id: "m1", channel_id: "c1", sender_id: "other", content: "Morning team! We have 4 new shipments to assign.", created_at: new Date(Date.now() - 3600000).toISOString(), sender: { full_name: "Sarah (Ops)" } },
  { id: "m2", channel_id: "c1", sender_id: "me", content: "I'll take the Mombasa route. Truck KCC 123J is ready.", created_at: new Date(Date.now() - 1800000).toISOString() },
  { id: "m3", channel_id: "c1", sender_id: "other", content: "Great. Please ensure PODs are uploaded immediately upon delivery.", created_at: new Date(Date.now() - 900000).toISOString(), sender: { full_name: "Sarah (Ops)" } },
];
