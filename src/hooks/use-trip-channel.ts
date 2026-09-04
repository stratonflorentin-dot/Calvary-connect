import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

export interface TripMessage {
  id: string;
  channel_id: string;
  sender_id: string | null;
  senderName: string | null;
  content: string;
  created_at: string;
}

/**
 * The sales<->operator channel for one trip. chat_channels already has a
 * dedicated type='trip' + trip_id column (004_internal_chat.sql) — this
 * finds or creates that channel and joins the current user as a member
 * (RLS on chat_messages/chat_channels requires membership to read or
 * write), reusing the same tables /chat already uses rather than a new
 * messaging system.
 */
export function useTripChannel(tripId: string | null, userId: string | null) {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TripMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const nameCache = useRef(new Map<string, string>());

  const resolveNames = useCallback(async (rows: { sender_id: string | null }[]) => {
    const ids = Array.from(new Set(rows.map((r) => r.sender_id).filter((id): id is string => !!id && !nameCache.current.has(id))));
    if (ids.length === 0) return;
    const { data } = await supabase.from("user_profiles").select("id, name").in("id", ids);
    for (const p of data ?? []) nameCache.current.set(p.id, p.name ?? "Unknown");
  }, []);

  const loadMessages = useCallback(
    async (cid: string) => {
      const { data } = await supabase.from("chat_messages").select("id, channel_id, sender_id, content, created_at").eq("channel_id", cid).order("created_at", { ascending: true });
      const rows = data ?? [];
      await resolveNames(rows);
      setMessages(rows.map((r) => ({ ...r, senderName: r.sender_id ? nameCache.current.get(r.sender_id) ?? null : null })));
    },
    [resolveNames]
  );

  useEffect(() => {
    if (!tripId || !userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      setLoading(true);
      let { data: channel } = await supabase.from("chat_channels").select("id").eq("trip_id", tripId).eq("type", "trip").maybeSingle();

      if (!channel) {
        const { data: created, error } = await supabase
          .from("chat_channels")
          .insert({ type: "trip", trip_id: tripId, name: `Trip handover`, created_by: userId })
          .select("id")
          .single();
        if (error || !created) {
          if (cancelled) return;
          setLoading(false);
          return;
        }
        channel = created;
      }
      if (cancelled || !channel) return;

      // Idempotent — RLS/unique constraint on (channel_id, user_id) makes a
      // duplicate insert a harmless no-op error, ignored on purpose.
      await supabase.from("chat_channel_members").insert({ channel_id: channel.id, user_id: userId });

      if (cancelled) return;
      setChannelId(channel.id);
      await loadMessages(channel.id);
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [tripId, userId, loadMessages]);

  useEffect(() => {
    if (!channelId) return;
    const sub = supabase
      .channel(`trip-channel-${channelId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${channelId}` }, () => loadMessages(channelId))
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [channelId, loadMessages]);

  const send = useCallback(
    async (content: string) => {
      if (!channelId || !userId || !content.trim()) return;
      setSending(true);
      try {
        await supabase.from("chat_messages").insert({ channel_id: channelId, sender_id: userId, content: content.trim() });
        await loadMessages(channelId);
      } finally {
        setSending(false);
      }
    },
    [channelId, userId, loadMessages]
  );

  return { channelId, messages, loading, sending, send };
}
