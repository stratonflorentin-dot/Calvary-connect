import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyManyChatSecret } from "@/lib/instagram/manychat-client";

const INBOX_ROLES = ["CEO", "ADMIN", "SALESMAN", "OPERATOR"];

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

/**
 * Receives Instagram DMs forwarded by a ManyChat automation flow's
 * "External Request" action (Automation → your flow → add an External
 * Request step on the message-received trigger). Configure that action to:
 *   - POST to this route's URL
 *   - Header: X-Webhook-Secret: <MANYCHAT_WEBHOOK_SECRET>
 *   - JSON body using ManyChat's dynamic variables:
 *       { "subscriber_id": "{{subscriber_id}}", "username": "{{ig_username}}",
 *         "text": "{{last_input_text}}" }
 *
 * ManyChat's External Request has no built-in signature scheme (unlike
 * Meta's webhooks) — the shared secret above is the only thing protecting
 * this endpoint, since it's otherwise public and unauthenticated.
 */
export async function POST(req: Request) {
  const providedSecret = req.headers.get("x-webhook-secret");
  if (!verifyManyChatSecret(providedSecret)) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { subscriber_id, username, text, image_url } = body;
  if (!subscriber_id) {
    return NextResponse.json({ error: "subscriber_id is required" }, { status: 400 });
  }

  const admin = getAdminClient();

  const { data: conversation, error: convError } = await admin
    .from("instagram_conversations")
    .upsert(
      {
        ig_sender_id: String(subscriber_id),
        ...(username ? { ig_username: username } : {}),
        last_message_at: new Date().toISOString(),
        is_read: false,
      },
      { onConflict: "ig_sender_id" },
    )
    .select()
    .single();

  if (convError || !conversation) {
    console.error("[manychat webhook] failed to upsert conversation:", convError);
    return NextResponse.json({ error: "Failed to record conversation" }, { status: 500 });
  }

  await admin.from("instagram_messages").insert({
    conversation_id: conversation.id,
    direction: "inbound",
    content: text ?? null,
    media_url: image_url ?? null,
  });

  const { data: recipients } = await admin.from("user_profiles").select("id").in("role", INBOX_ROLES);
  if (recipients && recipients.length > 0) {
    await admin.from("notifications").insert(
      recipients.map((r: any) => ({
        user_id: r.id,
        type: "info",
        module: "client_message",
        title: "New Instagram message",
        message: text || "Sent an attachment",
        action_url: "/chat/instagram",
        read: false,
      })),
    );
  }

  return NextResponse.json({ received: true });
}
