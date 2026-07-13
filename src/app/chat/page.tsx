"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import { canRead } from "@/lib/permissions";
import { PageShell, PageHeader, EmptyState } from "@/components/shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Hash,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Plus,
  Search,
  Send,
  Users,
  Check,
  CheckCheck,
  Clock,
  XCircle,
  MoreHorizontal,
  Reply,
  Edit,
  Trash2,
  Forward,
  Phone,
  Video,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, isSameDay, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";
import { uploadToBucket } from "@/lib/storage-upload";
import { Paperclip, Image, FileText, X } from "lucide-react";
import { WebRTCManager, CallSession, formatCallDuration, isWebRTCSupported, getWebRTCConfig } from "@/lib/webrtc";
import { IncomingCallModal } from "@/components/chat/incoming-call-modal";
import { ActiveCallUI } from "@/components/chat/active-call-ui";

interface Channel {
  id: string;
  name: string | null;
  type: "group" | "trip" | "direct";
  created_at: string;
}

interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

interface Message {
  id: string;
  channel_id: string;
  sender_id: string | null;
  sender_name?: string | null;
  content: string;
  created_at: string;
  status?: "sending" | "sent" | "delivered" | "read" | "failed";
  edited_at?: string | null;
  reply_to?: string | null;
  deleted_by?: "me" | "everyone" | null;
  deleted_at?: string | null;
  attachments?: Attachment[];
}

interface Member {
  channel_id: string;
  user_id: string;
  last_read_at?: string | null;
}

interface Profile {
  id: string;
  uid?: string | null;
  user_id?: string | null;
  auth_id?: string | null;
  auth_user_id?: string | null;
  name: string | null;
  role?: string | null;
  presence_status?: "online" | "away" | "offline";
  last_seen_at?: string | null;
  avatar_url?: string | null;
}

interface TypingUser {
  channel_id: string;
  user_id: string;
  typing_at: string;
}

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function resolveProfileUserId(profile?: Partial<Profile> | null): string | null {
  const candidates = [
    profile?.id,
    profile?.uid,
    (profile as Partial<Profile> & { user_id?: string | null })?.user_id,
    (profile as Partial<Profile> & { auth_id?: string | null })?.auth_id,
    (profile as Partial<Profile> & { auth_user_id?: string | null })?.auth_user_id,
  ];

  return candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? null;
}

function dayLabel(date: Date) {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMM d");
}

function StatusIcon({ status }: { status?: string }) {
  switch (status) {
    case "sending":
      return <Clock className="w-3 h-3 opacity-70" />;
    case "sent":
      return <Check className="w-3 h-3 opacity-70" />;
    case "delivered":
      return <CheckCheck className="w-3 h-3 opacity-70" />;
    case "read":
      return <CheckCheck className="w-3 h-3 text-blue-400" />;
    case "failed":
      return <XCircle className="w-3 h-3 text-red-400" />;
    default:
      return <Check className="w-3 h-3 opacity-70" />;
  }
}

export default function InternalChatPage() {
  const { user } = useSupabase();
  const { role } = useRole();
  const router = useRouter();

  // Permission check
  useEffect(() => {
    if (role && !canRead(role as any, 'chat')) {
      router.push("/");
    }
  }, [role, router]);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);

  // Call state
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [webrtcManager, setWebrtcManager] = useState<WebRTCManager | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Refs to avoid stale closures in Realtime subscriptions
  const activeCallRef = useRef<CallSession | null>(null);
  const incomingCallRef = useRef<CallSession | null>(null);
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const dbUserIdRef = useRef<string | null>(null);
  // ICE candidate queue: buffer candidates before remoteDescription is set
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSet = useRef(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [peopleSearch, setPeopleSearch] = useState("");
  const [channelNameDraft, setChannelNameDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editInput, setEditInput] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ messageId: string, type: 'me' | 'everyone' } | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [forwardSearch, setForwardSearch] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeRef = useRef<Channel | null>(null);
  activeRef.current = activeChannel;

  // Available emojis for reactions
  const reactionEmojis = ["👍", "❤️", "😂", "😮", "😢", "👏"];
  // Configurable edit window (5 minutes)
  const EDIT_WINDOW_MS = 5 * 60 * 1000;

  const dbUserId = user?.id && UUID_RE.test(user.id) ? user.id : null;
  const myName = user?.name ?? (user as any)?.email ?? null;

  // Keep refs in sync with state for use in subscriptions
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);
  useEffect(() => { webrtcManagerRef.current = webrtcManager; }, [webrtcManager]);
  useEffect(() => { dbUserIdRef.current = dbUserId; }, [dbUserId]);

  const scrollToBottom = () =>
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ch, prof] = await Promise.all([
        supabase.from("chat_channels").select("*").order("created_at", { ascending: false }),
        supabase.from("user_profiles").select("id, uid, name, role, presence_status, last_seen_at").order("name"),
      ]);
      if (ch.error) {
        setError("Unable to load conversations.");
        console.error("Chat load error:", ch.error);
        // Clear stale active channel if it no longer exists
        if (activeChannel) {
          const channelExists = Array.isArray(ch.data) && (ch.data as any[]).some((c: any) => c.id === activeChannel.id);
          if (!channelExists) {
            console.log("Clearing stale active channel:", activeChannel.id);
            setActiveChannel(null);
          }
        }
        return;
      }
      setChannels((ch.data ?? []) as Channel[]);
      setProfiles(prof.data ?? []);

      // DIAGNOSTIC: Log profile identity mapping
      console.log('[CHAT DIAGNOSTIC] Loaded profiles:', {
        dbUserId,
        profileCount: prof.data?.length,
        profiles: prof.data?.map(p => ({ id: p.id, name: p.name, role: p.role })),
        currentUserProfile: prof.data?.find((p: any) => p.id === dbUserId),
        allProfileIds: prof.data?.map(p => p.id),
        duplicateIds: prof.data?.map(p => p.id).filter((id, index, arr) => arr.indexOf(id) !== index),
        idMatchesCurrentUser: prof.data?.filter(p => p.id === dbUserId).length
      });

      // Memberships power direct-chat names and unread counts.
      const mem = await supabase.from("chat_channel_members").select("channel_id, user_id, last_read_at");
      if (mem.error) {
        console.error("Members load error:", mem.error);
        setMembers([]);
      } else {
        setMembers(mem.data ?? []);
      }

      // Recent messages
      const recent = await supabase
        .from("chat_messages")
        .select("id, channel_id, sender_id, sender_name, content, created_at, status, edited_at, reply_to, deleted_by, deleted_at, attachments")
        .order("created_at", { ascending: false })
        .limit(400);
      if (!recent.error) setRecentMessages(recent.data ?? []);

      // Reactions
      const react = await supabase.from("chat_reactions").select("*");
      if (!react.error) setReactions(react.data ?? []);
    } catch (err) {
      setError("Unable to load conversations.");
      console.error("Chat load error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeChannel]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Update user's own presence on mount and unmount
  useEffect(() => {
    if (!dbUserId) return;

    const updatePresence = async (status: "online" | "offline" | "away") => {
      await supabase.from("user_profiles").upsert({
        id: dbUserId,
        presence_status: status,
        last_seen_at: new Date().toISOString()
      }, { onConflict: "id" });
    };

    updatePresence("online");

    const handleVisibilityChange = () => {
      updatePresence(document.visibilityState === "visible" ? "online" : "away");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      updatePresence("offline");
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [dbUserId]);

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (!activeChannel || !dbUserId) return;

    // Update typing state
    supabase.from("chat_typing").upsert({
      channel_id: activeChannel.id,
      user_id: dbUserId,
      typing_at: new Date().toISOString()
    }, { onConflict: "channel_id,user_id" });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      supabase.from("chat_typing").delete().match({ channel_id: activeChannel.id, user_id: dbUserId });
    }, 3000);
  }, [activeChannel, dbUserId]);

  // ── Realtime subscriptions ────
  useEffect(() => {
    // Messages
    const messagesChannel = supabase
      .channel("chat_all_messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const m = payload.new as Message;
        setRecentMessages((prev) => [m, ...prev].slice(0, 400));
        if (activeRef.current && m.channel_id === activeRef.current.id) {
          setMessages((prev) => {
            const withoutOptimistic = prev.filter(
              (x) => !(String(x.id).startsWith("tmp-") && x.content === m.content),
            );
            if (withoutOptimistic.some((x) => x.id === m.id)) return withoutOptimistic;
            return [...withoutOptimistic, m];
          });
          markRead(m.channel_id);
          scrollToBottom();
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages" }, (payload) => {
        const m = payload.new as Message;
        setRecentMessages((prev) => prev.map(x => x.id === m.id ? m : x));
        if (activeRef.current && m.channel_id === activeRef.current.id) {
          setMessages((prev) => prev.map(x => x.id === m.id ? m : x));
        }
      })
      .subscribe();

    // Typing
    const typingChannel = supabase
      .channel("chat_typing")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_typing" }, async () => {
        if (!activeRef.current) return;
        const { data } = await supabase.from("chat_typing").select("*").eq("channel_id", activeRef.current.id);
        setTypingUsers(data ?? []);
      })
      .subscribe();

    // Reactions
    const reactionsChannel = supabase
      .channel("chat_reactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_reactions" }, async () => {
        const { data } = await supabase.from("chat_reactions").select("*");
        setReactions(data ?? []);
      })
      .subscribe();

    // Profiles (presence updates)
    const profilesChannel = supabase
      .channel("profiles_presence")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_profiles" }, async () => {
        const { data } = await supabase.from("user_profiles").select("id, uid, user_id, auth_id, auth_user_id, name, role, presence_status, last_seen_at").order("name");
        setProfiles(data ?? []);
      })
      .subscribe();

    // Call sessions - listen for incoming calls (uses ref to avoid stale closures)
    const callsChannel = supabase
      .channel("call_sessions_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_sessions" }, (payload) => {
        const call = payload.new as CallSession;
        const uid = dbUserIdRef.current;
        // Only show incoming calls where I'm the receiver and not already in a call
        if (call.receiver_id === uid && call.status === 'initiated' && !activeCallRef.current) {
          console.log('[CALL] Incoming call from', call.caller_id);
          setIncomingCall(call);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "call_sessions" }, (payload) => {
        const call = payload.new as CallSession;
        const curActive = activeCallRef.current;
        const curIncoming = incomingCallRef.current;
        // Update active call state
        if (curActive && curActive.id === call.id) {
          setActiveCall(call);
        }
        // Handle call ended/declined by remote party — cleanup without looping back
        if (call.status === 'ended' || call.status === 'declined') {
          if (curIncoming && curIncoming.id === call.id) {
            setIncomingCall(null);
          }
          if (curActive && curActive.id === call.id) {
            // Cleanup WebRTC directly instead of calling endCall (which calls rpc again)
            const mgr = webrtcManagerRef.current;
            if (mgr) { mgr.cleanup(); setWebrtcManager(null); }
            setLocalStream(null);
            setRemoteStream(null);
            setActiveCall(null);
            setIsMuted(false);
            iceCandidateQueue.current = [];
            remoteDescSet.current = false;
          }
        }
      })
      .subscribe();

    // Call signaling - handle WebRTC offers/answers/ICE candidates
    // Uses refs so the handler always sees current call/manager state
    const signalingChannel = supabase
      .channel("call_signaling_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_signaling" }, async (payload) => {
        const signal = payload.new as any;
        const uid = dbUserIdRef.current;
        const curActive = activeCallRef.current;
        const curIncoming = incomingCallRef.current;
        const mgr = webrtcManagerRef.current;

        // Only process signals for my active or incoming calls
        const relevantCallId = curActive?.id || curIncoming?.id;
        if (!relevantCallId) return;
        if (signal.call_id !== relevantCallId) return;
        if (signal.sender_id === uid) return; // Ignore own signals

        console.log('[SIGNALING] Received', signal.signal_type, 'for call', signal.call_id);

        if (!mgr) {
          console.warn('[SIGNALING] webrtcManager not ready for signal:', signal.signal_type);
          return;
        }

        try {
          switch (signal.signal_type) {
            case 'offer': {
              // Receiver: process offer and send answer
              remoteDescSet.current = false;
              const answer = await mgr.createAnswer(signal.signal_data);
              remoteDescSet.current = true;
              // Drain queued ICE candidates
              for (const c of iceCandidateQueue.current) {
                await mgr.addIceCandidate(c);
              }
              iceCandidateQueue.current = [];
              await supabase.from('call_signaling').insert({
                call_id: signal.call_id,
                sender_id: uid,
                signal_type: 'answer',
                signal_data: answer
              });
              break;
            }
            case 'answer': {
              // Caller: set remote description from answer
              await mgr.setRemoteDescription(signal.signal_data);
              remoteDescSet.current = true;
              // Drain queued ICE candidates
              for (const c of iceCandidateQueue.current) {
                await mgr.addIceCandidate(c);
              }
              iceCandidateQueue.current = [];
              break;
            }
            case 'ice_candidate': {
              if (remoteDescSet.current) {
                await mgr.addIceCandidate(signal.signal_data);
              } else {
                // Queue until remoteDescription is set
                iceCandidateQueue.current.push(signal.signal_data);
                console.log('[SIGNALING] Queued ICE candidate, queue length:', iceCandidateQueue.current.length);
              }
              break;
            }
            case 'declined':
            case 'busy':
            case 'ended': {
              // Remote party ended - cleanup
              mgr.cleanup();
              setWebrtcManager(null);
              setLocalStream(null);
              setRemoteStream(null);
              setActiveCall(null);
              setIncomingCall(null);
              setIsMuted(false);
              iceCandidateQueue.current = [];
              remoteDescSet.current = false;
              break;
            }
          }
        } catch (err) {
          console.error('[SIGNALING] Error handling signal:', signal.signal_type, err);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(typingChannel);
      supabase.removeChannel(reactionsChannel);
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(callsChannel);
      supabase.removeChannel(signalingChannel);
    };
    // Only re-subscribe when dbUserId changes — refs handle stale closures for call/webrtc state
  }, [dbUserId]);

  const profileById = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of profiles) {
      const ids = [p.id, p.uid, (p as Profile & { user_id?: string | null }).user_id, (p as Profile & { auth_id?: string | null }).auth_id, (p as Profile & { auth_user_id?: string | null }).auth_user_id].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
      for (const id of ids) m.set(id, p);
    }
    return m;
  }, [profiles]);

  const membersByChannel = useMemo(() => {
    const m = new Map<string, Member[]>();
    for (const row of members) {
      const list = m.get(row.channel_id) ?? [];
      list.push(row);
      m.set(row.channel_id, list);
    }
    return m;
  }, [members]);

  const reactionsByMessage = useMemo(() => {
    const m = new Map<string, Reaction[]>();
    for (const r of reactions) {
      const list = m.get(r.message_id) ?? [];
      list.push(r);
      m.set(r.message_id, list);
    }
    return m;
  }, [reactions]);

  const typingInActiveChannel = useMemo(() => {
    if (!activeChannel) return [];
    return typingUsers.filter(t => t.channel_id === activeChannel.id && t.user_id !== dbUserId);
  }, [typingUsers, activeChannel, dbUserId]);

  // Get mentionable users (only members of active channel)
  const mentionableUsers = useMemo(() => {
    if (!activeChannel || !dbUserId) return [];
    const channelMembers = membersByChannel.get(activeChannel.id) || [];
    return channelMembers
      .map(m => profileById.get(m.user_id))
      .filter(u => u && u.id !== dbUserId) as Profile[];
  }, [activeChannel, dbUserId, membersByChannel, profileById]);

  // Filtered users for mention dropdown
  const filteredMentionUsers = useMemo(() => {
    const searchLower = mentionSearch.toLowerCase();
    return mentionableUsers.filter(u =>
      (u.name && u.name.toLowerCase().includes(searchLower)) ||
      (u.role && u.role.toLowerCase().includes(searchLower))
    );
  }, [mentionableUsers, mentionSearch]);

  // Handle inserting a mention
  const insertMention = (user: Profile) => {
    if (!textareaRef.current) return;
    const currentValue = input;
    const beforeMention = currentValue.substring(0, mentionStartIndex);
    const afterMention = currentValue.substring(textareaRef.current.selectionStart);
    const mentionText = `@${user.name} `;
    const newValue = beforeMention + mentionText + afterMention;
    setInput(newValue);
    setShowMentions(false);
    setMentionSearch("");
    setMentionStartIndex(-1);
    // Focus and set cursor position
    setTimeout(() => {
      textareaRef.current?.focus();
      const newCursorPos = beforeMention.length + mentionText.length;
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  /** Display name for a channel: for DMs, the other person's name. */
  const channelDisplay = useCallback(
    (c: Channel): { name: string; isDirect: boolean } => {
      if (c.type !== "direct") return { name: c.name ?? "Channel", isDirect: false };
      const mem = membersByChannel.get(c.id) ?? [];
      const other = mem.find((m) => m.user_id !== dbUserId);
      const mine = mem.find((m) => m.user_id === dbUserId);

      // DIAGNOSTIC: Log channel member resolution
      console.log('[CHAT DIAGNOSTIC] Channel display resolution:', {
        channelId: c.id,
        channelType: c.type,
        dbUserId,
        members: mem,
        otherMember: other,
        myMember: mine,
        otherProfile: other ? profileById.get(other.user_id) : null,
        myProfile: mine ? profileById.get(mine.user_id) : null,
        memberCount: mem.length,
        distinctUserIds: [...new Set(mem.map(m => m.user_id))]
      });

      if (other && (mine || mem.length === 1)) {
        return { name: profileById.get(other.user_id)?.name ?? "Direct chat", isDirect: true };
      }
      const names = mem.map((m) => profileById.get(m.user_id)?.name).filter(Boolean);
      return { name: names.join(" & ") || c.name || "Direct chat", isDirect: true };
    },
    [membersByChannel, profileById, dbUserId],
  );

  const lastMessageByChannel = useMemo(() => {
    const m = new Map<string, Message>();
    for (const msg of recentMessages) {
      if (!m.has(msg.channel_id)) m.set(msg.channel_id, msg); // recentMessages is desc
    }
    return m;
  }, [recentMessages]);

  const unreadByChannel = useMemo(() => {
    const m = new Map<string, number>();
    if (!dbUserId) return m;
    const lastReadByChannel = new Map<string, string | null>();
    for (const row of members) {
      if (row.user_id === dbUserId) lastReadByChannel.set(row.channel_id, row.last_read_at ?? null);
    }
    for (const msg of recentMessages) {
      if (msg.sender_id === dbUserId) continue;
      const lastRead = lastReadByChannel.get(msg.channel_id);
      if (lastRead === undefined) continue;
      if (!lastRead || new Date(msg.created_at) > new Date(lastRead)) {
        m.set(msg.channel_id, (m.get(msg.channel_id) ?? 0) + 1);
      }
    }
    return m;
  }, [recentMessages, members, dbUserId]);

  const markRead = useCallback(
    async (channelId: string) => {
      if (!dbUserId) return;
      await supabase
        .from("chat_channel_members")
        .upsert({ channel_id: channelId, user_id: dbUserId, last_read_at: new Date().toISOString() }, { onConflict: "channel_id,user_id" });
      setMembers((prev) => {
        const has = prev.some((m) => m.channel_id === channelId && m.user_id === dbUserId);
        const now = new Date().toISOString();
        return has
          ? prev.map((m) => (m.channel_id === channelId && m.user_id === dbUserId ? { ...m, last_read_at: now } : m))
          : [...prev, { channel_id: channelId, user_id: dbUserId, last_read_at: now }];
      });
    },
    [dbUserId],
  );

  const openChannel = async (c: Channel) => {
    setActiveChannel(c);
    const res = await supabase
      .from("chat_messages")
      .select("id, channel_id, sender_id, sender_name, content, created_at, status, edited_at, reply_to, deleted_by, deleted_at, attachments")
      .eq("channel_id", c.id)
      .order("created_at", { ascending: true })
      .limit(500);
    let rows = res.data;
    if (res.error) {
      const legacy = await supabase
        .from("chat_messages")
        .select("id, channel_id, sender_id, content, created_at")
        .eq("channel_id", c.id)
        .order("created_at", { ascending: true })
        .limit(500);
      rows = legacy.data as any;
    }
    const nameFallback = (r: any) => r.sender_name ?? profileById.get(r.sender_id)?.name ?? null;
    setMessages((rows ?? []).map((r: any) => ({ ...r, sender_name: nameFallback(r) })));
    markRead(c.id);
    scrollToBottom();
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() && pendingAttachments.length === 0) return; // Require at least one or the other
    if (!activeChannel || !user || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");
    setReplyToMessage(null); // Clear reply after sending
    const attachmentsToSend = [...pendingAttachments];
    setPendingAttachments([]); // Clear pending

    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      channel_id: activeChannel.id,
      sender_id: dbUserId,
      content,
      created_at: new Date().toISOString(),
      sender_name: myName ?? "You",
      status: "sending",
      reply_to: replyToMessage?.id || null,
      attachments: attachmentsToSend
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom();

    let { error: dbErr, data } = await supabase.from("chat_messages").insert({
      channel_id: activeChannel.id,
      sender_id: dbUserId,
      sender_name: myName ?? "Team member",
      content,
      status: "sent",
      reply_to: replyToMessage?.id || null,
      attachments: attachmentsToSend
    }).select();
    if (dbErr) {
      setMessages((prev) => prev.map(m => m.id === optimistic.id ? { ...m, status: "failed" } : m));
      setError("Failed to send message.");
    }
    setSending(false);
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!dbUserId) return;

    const existingReaction = reactions.find(r => r.message_id === messageId && r.user_id === dbUserId && r.emoji === emoji);

    if (existingReaction) {
      // Remove reaction
      await supabase.from("chat_reactions").delete().match({ id: existingReaction.id });
    } else {
      // Add reaction
      await supabase.from("chat_reactions").insert({ message_id: messageId, user_id: dbUserId, emoji });
    }
    setShowReactionPicker(null);
  };

  const handleReply = (message: Message) => {
    setReplyToMessage(message);
  };

  const handleEdit = (message: Message) => {
    const messageAge = Date.now() - new Date(message.created_at).getTime();
    if (messageAge > EDIT_WINDOW_MS) {
      setError("You can only edit messages within 5 minutes of sending them.");
      return;
    }
    setEditingMessage(message);
    setEditInput(message.content);
  };

  const saveEdit = async () => {
    if (!editingMessage || !dbUserId) return;
    await supabase
      .from("chat_messages")
      .update({ content: editInput, edited_at: new Date().toISOString() })
      .match({ id: editingMessage.id });
    setEditingMessage(null);
    setEditInput("");
  };

  const deleteMessage = async () => {
    if (!deleteConfirm || !dbUserId) return;
    await supabase
      .from("chat_messages")
      .update({ deleted_by: deleteConfirm.type, deleted_at: new Date().toISOString() })
      .match({ id: deleteConfirm.messageId });
    setDeleteConfirm(null);
  };

  const handleForward = (message: Message) => {
    setForwardingMessage(message);
    setShowForwardDialog(true);
    setForwardSearch("");
  };

  const forwardMessage = async (targetChannel: Channel) => {
    if (!forwardingMessage || !dbUserId) return;
    // Send the forwarded message
    const forwardText = `Forwarded from ${forwardingMessage.sender_name}:\n${forwardingMessage.content}`;
    await supabase.from("chat_messages").insert({
      channel_id: targetChannel.id,
      sender_id: dbUserId,
      sender_name: myName || "Team member",
      content: forwardText,
      status: "sent",
      attachments: forwardingMessage.attachments
    });
    setShowForwardDialog(false);
    setForwardingMessage(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !activeChannel) return;

    setIsUploading(true);
    const newAttachments: Attachment[] = [];

    for (const file of files) {
      const url = await uploadToBucket(
        "chat-attachments",
        activeChannel.id,
        file
      );
      if (url) {
        newAttachments.push({
          name: file.name,
          url,
          type: file.type,
          size: file.size,
        });
      }
    }

    setPendingAttachments(prev => [...prev, ...newAttachments]);
    setIsUploading(false);
    e.target.value = ""; // Reset file input
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  /** Start (or resume) a 1:1 conversation with a colleague. */
  const startDirectChat = async (person: Profile) => {
    if (!dbUserId) {
      setError("Direct messages need a signed-in account — the offline admin session can use group channels.");
      setNewChatOpen(false);
      return;
    }

    const recipientId = resolveProfileUserId(person);
    if (!recipientId) {
      setError("Unable to resolve the selected colleague's account.");
      setNewChatOpen(false);
      return;
    }

    // HARD ASSERTION: Block self-chat creation
    if (recipientId === dbUserId) {
      const error = new Error("SELF_CHAT_BLOCKED: Cannot create direct chat with yourself");
      console.error("[SELF_CHAT_BLOCKED]", {
        currentAuthUid: dbUserId,
        selectedProfileId: recipientId,
        selectedProfileName: person.name,
        error: error.message
      });
      setError("Cannot create a conversation with yourself.");
      setNewChatOpen(false);
      return;
    }

    setCreating(true);
    try {
      // DIAGNOSTIC: Log identity mapping
      console.log('[CHAT DIAGNOSTIC] Starting direct chat with:', {
        currentAuthUid: dbUserId,
        selectedProfileId: person.id,
        resolvedRecipientId: recipientId,
        selectedProfileName: person.name,
        selectedProfileRole: person.role,
        rpcName: 'find_or_create_direct_chat',
        rpcPayload: { p_other_user_id: recipientId }
      });

      const { data: channelId, error: fnErr } = await supabase.rpc('find_or_create_direct_chat', {
        p_other_user_id: recipientId
      });

      console.log('[CHAT DIAGNOSTIC] RPC response:', {
        channelId,
        error: fnErr,
        errorCode: fnErr?.code,
        errorMessage: fnErr?.message,
        errorDetails: fnErr?.details,
        errorHint: fnErr?.hint
      });

      if (fnErr) {
        setError("Unable to start conversation.");
        console.error("Direct chat error:", fnErr);
        throw fnErr;
      }

      // Fetch the channel details
      const { data: ch, error: chErr } = await supabase
        .from("chat_channels")
        .select("*")
        .eq("id", channelId)
        .maybeSingle();

      if (chErr) {
        setError("Unable to load conversation.");
        console.error("Channel load error:", chErr);
        throw chErr;
      }

      if (!ch) {
        setError("Conversation not found. Please try again.");
        console.error("Channel not found after creation:", channelId);
        await loadAll();
        setNewChatOpen(false);
        return;
      }

      // Refresh channels and members
      await loadAll();

      setNewChatOpen(false);
      openChannel(ch as Channel);
    } catch (err: any) {
      setError("Unable to start conversation.");
      console.error("Direct chat error:", err);
    } finally {
      setCreating(false);
    }
  };

  const createGroupChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = channelNameDraft.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const { data, error: dbErr } = await supabase
        .from("chat_channels")
        .insert({ name, type: "group", created_by: dbUserId })
        .select()
        .maybeSingle();

      if (dbErr) {
        setError("Unable to create channel.");
        console.error("Channel creation error:", dbErr);
        throw dbErr;
      }

      if (!data) {
        setError("Channel creation failed. Please try again.");
        console.error("Channel not created");
        return;
      }

      // Add creator as member
      const { error: memErr } = await supabase.from("chat_channel_members").insert({
        channel_id: data.id,
        user_id: dbUserId
      });

      if (memErr) {
        setError("Unable to add you to the channel.");
        console.error("Member addition error:", memErr);
        throw memErr;
      }

      setChannelNameDraft("");
      setNewChatOpen(false);
      await loadAll();
      openChannel(data as Channel);
    } catch (err: any) {
      setError("Unable to create channel.");
      console.error("Group channel error:", err);
    } finally {
      setCreating(false);
    }
  };

  // Call management functions
  const startCall = async (callType: 'voice' | 'video', receiverId: string) => {
    if (!dbUserId) {
      setError("You must be signed in to make calls.");
      return;
    }

    // HARD ASSERTION: Block self-call
    if (receiverId === dbUserId) {
      const error = new Error("SELF_CALL_BLOCKED: Cannot call yourself");
      console.error("[SELF_CALL_BLOCKED]", {
        currentAuthUid: dbUserId,
        receiverId,
        error: error.message
      });
      setError("Cannot call yourself.");
      return;
    }

    if (!isWebRTCSupported()) {
      setError("Your browser does not support WebRTC calls.");
      return;
    }

    try {
      const { data: callId, error: initErr } = await supabase.rpc('initiate_call', {
        p_receiver_id: receiverId,
        p_call_type: callType,
        p_channel_id: activeChannel?.id || null
      });

      if (initErr) {
        setError("Unable to start call.");
        console.error("Call initiation error:", initErr);
        return;
      }

      // Fetch call details
      const { data: call, error: callErr } = await supabase
        .from('call_sessions')
        .select('*')
        .eq('id', callId)
        .single();

      if (callErr) {
        setError("Unable to load call.");
        console.error("Call fetch error:", callErr);
        return;
      }

      if (call.status === 'busy') {
        setError(`${profileById.get(receiverId)?.name || 'User'} is on another call.`);
        return;
      }

      setActiveCall(call as CallSession);

      // Initialize WebRTC
      const manager = new WebRTCManager(getWebRTCConfig());
      setWebrtcManager(manager);

      await manager.initialize(
        callType,
        (stream) => setRemoteStream(stream),
        async (candidate) => {
          await supabase.from('call_signaling').insert({
            call_id: call.id,
            sender_id: dbUserId,
            signal_type: 'ice_candidate',
            signal_data: candidate
          });
        },
        (state) => {
          console.log('Connection state:', state);
          if (state === 'disconnected' || state === 'failed') {
            endCall();
          }
        }
      );

      setLocalStream(manager.getLocalStream());

      // Create and send offer
      const offer = await manager.createOffer();
      await supabase.from('call_signaling').insert({
        call_id: call.id,
        sender_id: dbUserId,
        signal_type: 'offer',
        signal_data: offer
      });

      // Update call status to ringing
      await supabase.from('call_sessions').update({ status: 'ringing' }).eq('id', call.id);

    } catch (err: any) {
      setError("Unable to start call.");
      console.error("Call error:", err);
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !dbUserId) return;
    const callSnapshot = incomingCall;

    try {
      // Answer call in database first
      const { error: answerErr } = await supabase.rpc('answer_call', {
        p_call_id: callSnapshot.id
      });

      if (answerErr) {
        setError("Unable to answer call.");
        console.error("Answer error:", answerErr);
        return;
      }

      setIncomingCall(null);
      setActiveCall(callSnapshot);

      // Reset ICE queue and remoteDesc flag
      iceCandidateQueue.current = [];
      remoteDescSet.current = false;

      // Initialize WebRTC
      const manager = new WebRTCManager(getWebRTCConfig());
      // Set ref immediately so signaling handler can use it
      webrtcManagerRef.current = manager;
      setWebrtcManager(manager);

      await manager.initialize(
        callSnapshot.call_type,
        (stream) => setRemoteStream(stream),
        async (candidate) => {
          await supabase.from('call_signaling').insert({
            call_id: callSnapshot.id,
            sender_id: dbUserId,
            signal_type: 'ice_candidate',
            signal_data: candidate
          });
        },
        (state) => {
          console.log('[WebRTC] Connection state:', state);
          if (state === 'failed') {
            endCall();
          }
        }
      );

      setLocalStream(manager.getLocalStream());

      // Now fetch the offer that the caller already sent to the DB
      // (It may have arrived before acceptCall was called)
      const { data: signals } = await supabase
        .from('call_signaling')
        .select('*')
        .eq('call_id', callSnapshot.id)
        .eq('signal_type', 'offer')
        .order('created_at', { ascending: false })
        .limit(1);

      if (signals && signals.length > 0) {
        const offerSignal = signals[0];
        console.log('[WebRTC] Processing existing offer from DB');
        const answer = await manager.createAnswer(offerSignal.signal_data);
        remoteDescSet.current = true;
        // Drain any queued ICE candidates
        for (const c of iceCandidateQueue.current) {
          await manager.addIceCandidate(c);
        }
        iceCandidateQueue.current = [];
        await supabase.from('call_signaling').insert({
          call_id: callSnapshot.id,
          sender_id: dbUserId,
          signal_type: 'answer',
          signal_data: answer
        });
      } else {
        console.log('[WebRTC] No offer in DB yet, waiting for signaling subscription');
      }

    } catch (err: any) {
      setError("Unable to answer call.");
      console.error("Accept call error:", err);
    }
  };

  const declineCall = async () => {
    if (!incomingCall || !dbUserId) return;

    try {
      await supabase.rpc('decline_call', { p_call_id: incomingCall.id });
      setIncomingCall(null);
    } catch (err: any) {
      console.error("Decline call error:", err);
    }
  };

  const endCall = async () => {
    const callSnapshot = activeCallRef.current;
    if (!callSnapshot || !dbUserIdRef.current) return;

    // Cleanup WebRTC immediately (before await) so UI updates fast
    const mgr = webrtcManagerRef.current;
    if (mgr) {
      mgr.cleanup();
      webrtcManagerRef.current = null;
      setWebrtcManager(null);
    }
    setLocalStream(null);
    setRemoteStream(null);
    setActiveCall(null);
    setIsMuted(false);
    setIsSpeakerOn(true);
    iceCandidateQueue.current = [];
    remoteDescSet.current = false;

    try {
      await supabase.rpc('end_call', {
        p_call_id: callSnapshot.id,
        p_end_reason: 'user_ended'
      });
    } catch (err: any) {
      console.error("End call RPC error:", err);
    }
  };

  const toggleMute = () => {
    if (webrtcManager) {
      webrtcManager.toggleAudio(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  // ── Sidebar ordering: most recent activity first, unread pinned visually ──
  const sortedChannels = useMemo(() => {
    const q = search.trim().toLowerCase();
    return channels
      .map((c) => ({ c, display: channelDisplay(c), last: lastMessageByChannel.get(c.id) }))
      .filter(({ display }) => !q || display.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const ta = a.last ? new Date(a.last.created_at).getTime() : new Date(a.c.created_at).getTime();
        const tb = b.last ? new Date(b.last.created_at).getTime() : new Date(b.c.created_at).getTime();
        return tb - ta;
      });
  }, [channels, channelDisplay, lastMessageByChannel, search]);

  const people = useMemo(() => {
    const q = peopleSearch.trim().toLowerCase();
    return profiles
      .filter((p) => resolveProfileUserId(p) !== dbUserId)
      .filter((p) => !q || (p.name ?? "").toLowerCase().includes(q));
  }, [profiles, peopleSearch, dbUserId]);

  const activeDisplay = activeChannel ? channelDisplay(activeChannel) : null;
  const otherUserInDirectChat = activeDisplay?.isDirect ? profileById.get((membersByChannel.get(activeChannel?.id ?? "") ?? []).find((m) => m.user_id !== dbUserId)?.user_id ?? "") : null;

  return (
    <PageShell width="wide">
      {/* Incoming Call Modal */}
      {incomingCall && (
        <IncomingCallModal
          call={incomingCall}
          callerName={profileById.get(incomingCall.caller_id)?.name || 'Unknown'}
          callerAvatar={profileById.get(incomingCall.caller_id)?.avatar_url || undefined}
          onAccept={acceptCall}
          onDecline={declineCall}
          open={!!incomingCall}
        />
      )}

      {/* Active Call UI */}
      {activeCall && (
        <ActiveCallUI
          call={activeCall}
          userName={profileById.get(activeCall.caller_id === dbUserId ? activeCall.receiver_id : activeCall.caller_id)?.name || 'Unknown'}
          userAvatar={profileById.get(activeCall.caller_id === dbUserId ? activeCall.receiver_id : activeCall.caller_id)?.avatar_url || undefined}
          localStream={localStream}
          remoteStream={remoteStream}
          isMuted={isMuted}
          isSpeakerOn={isSpeakerOn}
          onToggleMute={toggleMute}
          onToggleSpeaker={toggleSpeaker}
          onEndCall={endCall}
        />
      )}

      <PageHeader
        eyebrow="Team"
        title="Internal chat"
        subtitle={error ? error : "Message any colleague directly, or use the team channels"}
        icon={MessageSquare}
        iconAccent="bg-primary text-primary-foreground"
      />

      <div className="cv-surface overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
        <div className="flex h-full">
          {/* ── Conversation list ── */}
          <aside className="w-80 shrink-0 border-r border-border flex flex-col bg-muted/30">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Chats</p>
                <button
                  onClick={() => setNewChatOpen(true)}
                  className="h-7 px-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1 text-[11px] font-bold"
                  title="New chat"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" /> New
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats…" className="pl-9 h-9 bg-card" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="py-8 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : sortedChannels.length === 0 ? (
                <div className="p-4 space-y-2">
                  <p className="text-xs text-muted-foreground italic">No conversations yet.</p>
                  <Button size="sm" variant="outline" className="w-full gap-1.5 h-8" onClick={() => setNewChatOpen(true)}>
                    <MessageSquarePlus className="w-3.5 h-3.5" /> Start a chat
                  </Button>
                </div>
              ) : (
                sortedChannels.map(({ c, display, last }) => {
                  const isActive = activeChannel?.id === c.id;
                  const unread = unreadByChannel.get(c.id) ?? 0;
                  return (
                    <button
                      key={c.id}
                      onClick={() => openChannel(c)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border/50 transition-colors",
                        isActive ? "bg-primary/10" : "hover:bg-muted/60",
                      )}
                    >
                      <div className="relative">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xs font-black",
                          display.isDirect ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                        )}>
                          {display.isDirect ? initials(display.name) : <Hash className="w-4 h-4" />}
                        </div>
                        {display.isDirect && (() => {
                          const other = (membersByChannel.get(c.id) ?? []).find((m) => m.user_id !== dbUserId);
                          const profile = other ? profileById.get(other.user_id) : null;
                          if (profile?.presence_status === "online") {
                            return <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-background" />;
                          }
                          return null;
                        })()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className={cn("text-sm truncate", unread > 0 ? "font-black text-foreground" : "font-bold text-foreground")}>
                            {display.name}
                          </p>
                          {last && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {isToday(new Date(last.created_at)) ? format(new Date(last.created_at), "HH:mm") : format(new Date(last.created_at), "MMM d")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn("text-xs truncate", unread > 0 ? "text-foreground font-semibold" : "text-muted-foreground")}>
                            {last ? `${last.sender_id === dbUserId ? "You: " : ""}${last.content}` : display.isDirect ? "Say hello 👋" : "No messages yet"}
                          </p>
                          {unread > 0 && (
                            <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">
                              {unread > 99 ? "99+" : unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* ── Messages pane ── */}
          <section className="flex-1 flex flex-col min-w-0">
            {!activeChannel || !activeDisplay ? (
              <EmptyState icon={MessageSquare} title="Pick a conversation" description="Choose a chat on the left, or start a new one with any colleague." />
            ) : (
              <>
                <header className="px-5 py-3 border-b border-border flex items-center gap-3">
                  <div className="relative">
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0",
                      activeDisplay.isDirect ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                    )}>
                      {activeDisplay.isDirect ? initials(activeDisplay.name) : <Hash className="w-4 h-4" />}
                    </div>
                    {activeDisplay.isDirect && otherUserInDirectChat?.presence_status === "online" && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-black text-foreground truncate">{activeDisplay.name}</h2>
                    <p className="text-[10px] text-muted-foreground">
                      {activeDisplay.isDirect
                        ? (otherUserInDirectChat?.presence_status === "online" ? "Online" :
                          otherUserInDirectChat?.last_seen_at ? `Last seen ${format(new Date(otherUserInDirectChat.last_seen_at), "MMM d, HH:mm")}` : "Offline")
                        : `${(membersByChannel.get(activeChannel.id) ?? []).length || "Team"} members`}
                    </p>
                  </div>
                  {(() => {
                    // DIAGNOSTIC: Log call button visibility condition
                    console.log('[CALL BUTTONS DIAGNOSTIC]', {
                      activeDisplay,
                      isDirect: activeDisplay?.isDirect,
                      otherUserInDirectChat,
                      otherUserId: otherUserInDirectChat?.id,
                      otherUserName: otherUserInDirectChat?.name,
                      dbUserId,
                      shouldShow: activeDisplay?.isDirect && otherUserInDirectChat
                    });
                    return activeDisplay?.isDirect && otherUserInDirectChat;
                  })() && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => startCall('voice', otherUserInDirectChat!.id)}
                          title="Voice call"
                          aria-label="Start voice call"
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => startCall('video', otherUserInDirectChat!.id)}
                          title="Video call"
                          aria-label="Start video call"
                        >
                          <Video className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                </header>

                <div className="flex-1 overflow-y-auto p-5 space-y-1 bg-muted/20">
                  {messages.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground italic mt-10">No messages yet. Say hi 👋</div>
                  ) : (
                    messages.map((m, i) => {
                      if (m.deleted_by) {
                        return (
                          <div key={m.id} className="flex justify-center my-2">
                            <span className="text-xs text-muted-foreground italic">
                              {m.deleted_by === "everyone" ? "Message deleted" : "You deleted this message"}
                            </span>
                          </div>
                        );
                      }
                      const mine = m.sender_id
                        ? m.sender_id === dbUserId
                        : m.sender_name != null && m.sender_name === myName;
                      const prev = messages[i - 1];
                      const newDay = !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at));
                      const sameSenderAsPrev = prev && prev.sender_id === m.sender_id && prev.sender_name === m.sender_name && !newDay;
                      const msgReactions = reactionsByMessage.get(m.id) ?? [];
                      const reactionCounts = msgReactions.reduce((acc, r) => {
                        acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
                        return acc;
                      }, {} as Record<string, number>);
                      return (
                        <div key={m.id}>
                          {newDay && (
                            <div className="flex justify-center my-3">
                              <span className="text-[10px] font-bold text-muted-foreground bg-card border border-border rounded-full px-3 py-1">
                                {dayLabel(new Date(m.created_at))}
                              </span>
                            </div>
                          )}
                          <div className={cn("flex", mine ? "justify-end" : "justify-start", sameSenderAsPrev ? "mt-0.5" : "mt-2")}>
                            <div className={cn("max-w-lg", mine && "text-right")}>
                              {!mine && !sameSenderAsPrev && !activeDisplay.isDirect && (
                                <p className="text-[10px] font-bold text-primary mb-0.5 ml-1">{m.sender_name ?? "Team member"}</p>
                              )}
                              {/* Quoted message if replying */}
                              {m.reply_to && (() => {
                                const quotedMessage = messages.find(msg => msg.id === m.reply_to);
                                if (!quotedMessage) return null;
                                const quotedSender = quotedMessage.sender_name ?? profileById.get(quotedMessage.sender_id ?? "")?.name ?? "Someone";
                                return (
                                  <div className={cn(
                                    "mb-2 p-2 rounded-lg text-xs border-l-2",
                                    mine
                                      ? "bg-primary-foreground/10 border-primary-foreground/30"
                                      : "bg-muted/50 border-primary"
                                  )}>
                                    <p className="font-bold mb-0.5">↩️ {quotedSender}</p>
                                    <p className="line-clamp-2">{quotedMessage.content}</p>
                                  </div>
                                );
                              })()}

                              <div className="flex items-start gap-2">
                                {/* Message bubble */}
                                <div className={cn(
                                  "rounded-2xl px-4 py-2 text-sm inline-block text-left flex-1",
                                  mine
                                    ? "bg-primary text-primary-foreground rounded-br-sm"
                                    : "bg-card border border-border text-foreground rounded-bl-sm",
                                )}>
                                  {/* Attachments */}
                                  {m.attachments && m.attachments.length > 0 && (
                                    <div className="flex flex-col gap-2 mb-2">
                                      {m.attachments.map((attachment, index) => (
                                        <a
                                          key={index}
                                          href={attachment.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-2 p-2 rounded-lg bg-black/5 hover:bg-black/10 transition-colors"
                                        >
                                          {attachment.type.startsWith("image/") ? (
                                            <Image className="w-8 h-8 text-muted-foreground" />
                                          ) : (
                                            <FileText className="w-8 h-8 text-muted-foreground" />
                                          )}
                                          <span className="text-sm truncate">{attachment.name}</span>
                                        </a>
                                      ))}
                                    </div>
                                  )}

                                  {m.content}
                                  <div className="flex items-center justify-end gap-1 mt-0.5">
                                    {m.edited_at && <span className={cn("text-[8px]", mine ? "text-primary-foreground/60" : "text-muted-foreground")}>(edited)</span>}
                                    <span className={cn("text-[9px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                      {format(new Date(m.created_at), "HH:mm")}
                                    </span>
                                    {mine && <StatusIcon status={m.status} />}
                                  </div>
                                </div>

                                {/* Message actions dropdown (only show on hover or focus) */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="text-muted-foreground hover:text-foreground p-1 rounded opacity-70 hover:opacity-100 transition-opacity">
                                      <MoreHorizontal className="w-3 h-3" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align={mine ? "end" : "start"}>
                                    <DropdownMenuItem onClick={() => handleReply(m)}>
                                      <Reply className="w-4 h-4 mr-2" />
                                      Reply
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleForward(m)}>
                                      <Forward className="w-4 h-4 mr-2" />
                                      Forward
                                    </DropdownMenuItem>
                                    {mine && (
                                      <DropdownMenuItem onClick={() => handleEdit(m)}>
                                        <Edit className="w-4 h-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => setDeleteConfirm({ messageId: m.id, type: 'me' })}>
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete for me
                                    </DropdownMenuItem>
                                    {mine && (
                                      <DropdownMenuItem onClick={() => setDeleteConfirm({ messageId: m.id, type: 'everyone' })}>
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete for everyone
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              {Object.keys(reactionCounts).length > 0 && (
                                <div className={cn("flex gap-1 mt-1", mine ? "justify-end" : "justify-start")}>
                                  {Object.entries(reactionCounts).map(([emoji, count]) => {
                                    const userReacted = msgReactions.some(r => r.user_id === dbUserId && r.emoji === emoji);
                                    return (
                                      <button
                                        key={emoji}
                                        onClick={() => toggleReaction(m.id, emoji)}
                                        className={cn(
                                          "border rounded-full px-2 py-0.5 text-xs transition-colors",
                                          userReacted
                                            ? "bg-primary/20 border-primary text-primary"
                                            : "bg-background border-border text-muted-foreground hover:border-primary/50"
                                        )}
                                      >
                                        {emoji} {count}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                              {/* Reaction picker button */}
                              <div className={cn("mt-1", mine ? "text-right" : "text-left")}>
                                <button
                                  onClick={() => setShowReactionPicker(m.id)}
                                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                                >
                                  + Add reaction
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {typingInActiveChannel.length > 0 && (
                    <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {typingInActiveChannel.map(t => profileById.get(t.user_id)?.name ?? "Someone").join(", ")} typing...
                    </div>
                  )}
                  <div ref={messagesEndRef} />

                  {/* Reaction picker */}
                  {showReactionPicker && (
                    <div className="fixed inset-0 bg-transparent z-50 flex items-center justify-center" onClick={() => setShowReactionPicker(null)}>
                      <div className="bg-card border border-border rounded-xl p-3 shadow-lg" onClick={(e) => e.stopPropagation()}>
                        <p className="text-xs font-bold text-muted-foreground mb-2 text-center">Add a reaction</p>
                        <div className="flex gap-2">
                          {reactionEmojis.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(showReactionPicker, emoji)}
                              className="text-2xl hover:bg-muted p-2 rounded-lg transition-colors"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Reply bar */}
                {replyToMessage && (
                  <div className="px-4 py-2 border-t border-border bg-muted/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Reply className="w-4 h-4 text-primary" />
                      <p className="text-sm text-muted-foreground">
                        Replying to <span className="font-bold">{replyToMessage.sender_name ?? "someone"}</span>
                      </p>
                    </div>
                    <button onClick={() => setReplyToMessage(null)} className="text-muted-foreground hover:text-foreground">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Edit mode */}
                {editingMessage && (
                  <form onSubmit={(e) => { e.preventDefault(); saveEdit(); }} className="p-4 border-t border-border bg-card">
                    <div className="flex items-end gap-2">
                      <textarea
                        value={editInput}
                        onChange={(e) => setEditInput(e.target.value)}
                        placeholder="Edit your message..."
                        className="flex-1 min-h-[44px] max-h-32 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        rows={1}
                      />
                      <Button type="button" onClick={() => { setEditingMessage(null); setEditInput(""); }} variant="outline" className="h-11">
                        Cancel
                      </Button>
                      <Button type="submit" disabled={!editInput.trim()} className="h-11">
                        Save
                      </Button>
                    </div>
                  </form>
                )}

                {/* Pending attachments preview */}
                {pendingAttachments.length > 0 && !editingMessage && (
                  <div className="px-4 pt-2 border-t border-border bg-card flex gap-2 flex-wrap">
                    {pendingAttachments.map((attachment, index) => (
                      <div key={index} className="relative group">
                        {attachment.type.startsWith("image/") ? (
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="w-20 h-20 object-cover rounded-lg border border-border"
                          />
                        ) : (
                          <div className="w-20 h-20 flex items-center justify-center rounded-lg border border-border bg-muted/50">
                            <FileText className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <button
                          onClick={() => removePendingAttachment(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Normal message input */}
                {!editingMessage && (
                  <form onSubmit={sendMessage} className="p-4 border-t border-border bg-card">
                    <div className="flex items-end gap-2">
                      {/* File upload button */}
                      <label className="h-11 w-11 rounded-2xl bg-muted hover:bg-muted/80 flex items-center justify-center cursor-pointer transition-colors">
                        <Paperclip className="w-4 h-4 text-muted-foreground" />
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleFileSelect}
                          disabled={isUploading}
                        />
                      </label>
                      <div className="relative flex-1">
                        <textarea
                          ref={textareaRef}
                          value={input}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            setInput(newValue);
                            handleTyping();
                            // Check for mention trigger
                            const cursorPos = e.target.selectionStart;
                            const textBeforeCursor = newValue.substring(0, cursorPos);
                            const lastAtIndex = textBeforeCursor.lastIndexOf("@");
                            if (lastAtIndex !== -1) {
                              const textAfterLastAt = textBeforeCursor.substring(lastAtIndex + 1);
                              if (!textAfterLastAt.includes(" ")) {
                                setShowMentions(false);
                                setMentionSearch("");
                                setMentionStartIndex(-1);
                              } else {
                                setShowMentions(true);
                                setMentionSearch(textAfterLastAt);
                                setMentionStartIndex(lastAtIndex);
                              }
                            } else {
                              setShowMentions(false);
                              setMentionSearch("");
                              setMentionStartIndex(-1);
                            }
                          }}
                          placeholder={`Message ${activeDisplay.name}`}
                          className="flex-1 min-h-[44px] max-h-32 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-full"
                          rows={1}
                          onKeyDown={(e) => {
                            if (showMentions) {
                              if (e.key === "Escape") {
                                setShowMentions(false);
                                setMentionSearch("");
                                setMentionStartIndex(-1);
                              } else if (e.key === "Enter" && filteredMentionUsers.length > 0) {
                                e.preventDefault();
                                insertMention(filteredMentionUsers[0]);
                              }
                            } else if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              sendMessage();
                            }
                          }}
                        />

                        {/* Mention dropdown */}
                        {showMentions && filteredMentionUsers.length > 0 && (
                          <div className="absolute bottom-full left-0 mb-2 w-72 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50 max-h-48 overflow-y-auto">
                            {filteredMentionUsers.map((user) => (
                              <button
                                key={user.id}
                                onClick={() => insertMention(user)}
                                className="w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors flex items-center gap-2"
                              >
                                <div className="w-8 h-8 rounded-full bg-primary/15 text-primary text-xs font-black flex items-center justify-center shrink-0">
                                  {initials(user.name)}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                                  <p className="text-xs text-muted-foreground">{user.role}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        type="submit"
                        disabled={(!input.trim() && pendingAttachments.length === 0) || sending || isUploading}
                        className="h-11 w-11 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground p-0 shrink-0"
                      >
                        {sending || isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                  </form>
                )}

                {/* Delete confirmation dialog */}
                <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                  <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                      <DialogTitle>Delete message?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                      {deleteConfirm?.type === 'me'
                        ? "This will delete the message only for you."
                        : "This will delete the message for everyone in the conversation."}
                    </p>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                        Cancel
                      </Button>
                      <Button variant="destructive" onClick={deleteMessage}>
                        Delete
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Forward message dialog */}
                <Dialog open={showForwardDialog} onOpenChange={setShowForwardDialog}>
                  <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                      <DialogTitle>Forward message</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      {/* Preview of the message to forward */}
                      {forwardingMessage && (
                        <div className="bg-muted/30 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">From: {forwardingMessage.sender_name}</p>
                          <p className="text-sm">{forwardingMessage.content}</p>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1.5">
                          <Search className="w-3.5 h-3.5" />
                          Select a conversation
                        </Label>
                        <Input
                          value={forwardSearch}
                          onChange={(e) => setForwardSearch(e.target.value)}
                          placeholder="Search conversations..."
                        />
                        <div className="max-h-56 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                          {sortedChannels
                            .filter(({ display }) =>
                              display.name.toLowerCase().includes(forwardSearch.toLowerCase())
                            )
                            .map(({ c, display }) => (
                              <button
                                key={c.id}
                                onClick={() => forwardMessage(c)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 text-left transition-colors"
                              >
                                <div className={cn(
                                  "w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-black",
                                  display.isDirect ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                                )}>
                                  {display.isDirect ? initials(display.name) : <Hash className="w-4 h-4" />}
                                </div>
                                <span className="min-w-0">
                                  <span className="block text-sm font-semibold text-foreground truncate">
                                    {display.name}
                                  </span>
                                </span>
                              </button>
                            ))}
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </section>
        </div>
      </div>

      {/* ── New chat dialog: pick a colleague or create a channel ── */}
      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>New chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Message a colleague</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={peopleSearch} onChange={(e) => setPeopleSearch(e.target.value)} placeholder="Search people…" className="pl-9 h-9" />
              </div>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                {people.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground italic text-center">No colleagues found.</p>
                ) : (
                  people.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => startDirectChat(p)}
                      disabled={creating}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 text-left transition-colors"
                    >
                      <div className="relative">
                        <span className="w-9 h-9 rounded-full bg-primary/15 text-primary text-xs font-black flex items-center justify-center shrink-0">
                          {initials(p.name)}
                        </span>
                        {p.presence_status === "online" && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                        )}
                      </div>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-foreground truncate">{p.name ?? "Unnamed"}</span>
                        <span className="block text-[10px] text-muted-foreground uppercase tracking-wider">{p.role ?? ""}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-border">
              <Label className="text-xs flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Or create a team channel</Label>
              <form onSubmit={createGroupChannel} className="flex items-center gap-2">
                <Input
                  value={channelNameDraft}
                  onChange={(e) => setChannelNameDraft(e.target.value)}
                  placeholder="e.g. Border crossings"
                  className="h-9"
                />
                <Button type="submit" size="sm" disabled={creating || !channelNameDraft.trim()} className="h-9 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0">
                  {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Create
                </Button>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
