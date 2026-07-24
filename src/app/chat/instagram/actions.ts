"use server";

import { createClient } from "@supabase/supabase-js";
import { sendInstagramMessage } from "@/lib/instagram/graph-client";

const INBOX_ROLES = ["CEO", "ADMIN", "SALESMAN", "OPERATOR"];

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

async function verifyInboxAccess(admin: ReturnType<typeof getAdminClient>, accessToken: string) {
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(accessToken);
  if (error || !user) throw new Error("Invalid session");

  const { data: profile } = await admin.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !INBOX_ROLES.includes(String(profile.role).toUpperCase())) {
    throw new Error("Not authorized to access the Instagram inbox");
  }
  return user.id;
}

export async function sendInstagramReply(
  accessToken: string,
  conversationId: string,
  text: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = getAdminClient();
    const userId = await verifyInboxAccess(admin, accessToken);

    const { data: conversation, error: convError } = await admin
      .from("instagram_conversations")
      .select("ig_sender_id")
      .eq("id", conversationId)
      .single();
    if (convError || !conversation) return { success: false, error: "Conversation not found" };

    const result = await sendInstagramMessage(conversation.ig_sender_id, text);
    if (!result.success) return { success: false, error: result.error };

    await admin.from("instagram_messages").insert({
      conversation_id: conversationId,
      direction: "outbound",
      content: text,
      ig_message_id: result.messageId,
      sent_by: userId,
    });
    await admin
      .from("instagram_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to send reply" };
  }
}
