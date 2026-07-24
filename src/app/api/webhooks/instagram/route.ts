import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyMetaSignature } from "@/lib/instagram/graph-client";

const INBOX_ROLES = ["CEO", "ADMIN", "SALESMAN", "OPERATOR"];

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

/** Meta's webhook verification handshake, done once when registering the callback URL. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

interface MetaMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: { mid: string; text?: string; attachments?: { type: string; payload: { url: string } }[] };
}

export async function POST(req: Request) {
  // Signature verification is the only thing protecting this public,
  // unauthenticated endpoint — reject anything that fails it.
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifyMetaSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = getAdminClient();
  const entries = body?.entry ?? [];

  for (const entry of entries) {
    const events: MetaMessagingEvent[] = entry.messaging ?? [];
    for (const event of events) {
      // Echoes of our own outbound sends and non-message events (reads,
      // deliveries) don't have `message.text`/attachments — skip them.
      if (!event.message) continue;

      const igSenderId = event.sender.id;
      const text = event.message.text ?? null;
      const mediaUrl = event.message.attachments?.[0]?.payload?.url ?? null;

      const { data: conversation } = await admin
        .from("instagram_conversations")
        .upsert(
          { ig_sender_id: igSenderId, last_message_at: new Date(event.timestamp).toISOString() },
          { onConflict: "ig_sender_id" },
        )
        .select()
        .single();

      if (!conversation) continue;

      await admin.from("instagram_messages").insert({
        conversation_id: conversation.id,
        direction: "inbound",
        content: text,
        media_url: mediaUrl,
        ig_message_id: event.message.mid,
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
    }
  }

  // Meta requires a 200 response quickly, regardless of downstream outcome,
  // or it will retry aggressively and eventually disable the subscription.
  return NextResponse.json({ received: true });
}
