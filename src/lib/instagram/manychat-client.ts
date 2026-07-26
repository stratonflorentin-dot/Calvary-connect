import { timingSafeEqual } from "crypto";

/**
 * ManyChat API client for Instagram DM messaging via a ManyChat account
 * (connected to @calvarytransport.tz through ManyChat's own dashboard).
 * Server-only — never import from a client component (the API key must
 * stay server-side).
 *
 * Chosen over calling Meta's Graph API directly so there's no need to run a
 * Meta Developer app through App Review — ManyChat already did that as a
 * Meta Business Partner. See docs.manychat.com/docs/send-content-api for
 * the send endpoint this wraps.
 */

const MANYCHAT_API_BASE = "https://api.manychat.com";

function getApiKey() {
  const key = process.env.MANYCHAT_API_KEY;
  if (!key) throw new Error("Missing MANYCHAT_API_KEY");
  return key;
}

/**
 * ManyChat's "External Request" flow action (the mechanism that forwards
 * incoming DMs to our webhook) has no built-in signature scheme like Meta's
 * X-Hub-Signature-256 — it's a generic HTTP request the user configures
 * inside their own ManyChat flow. Security here is a shared secret set as a
 * custom header on that External Request action, checked against
 * MANYCHAT_WEBHOOK_SECRET.
 */
export function verifyManyChatSecret(providedSecret: string | null): boolean {
  const expected = process.env.MANYCHAT_WEBHOOK_SECRET;
  if (!expected || !providedSecret) return false;
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(providedSecret);
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export interface SendMessageResult {
  success: boolean;
  error?: string;
}

/** Sends a text reply to a ManyChat subscriber (an Instagram DM contact). */
export async function sendManyChatMessage(subscriberId: string, text: string): Promise<SendMessageResult> {
  try {
    const res = await fetch(`${MANYCHAT_API_BASE}/fb/sending/sendContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({
        subscriber_id: subscriberId,
        data: {
          version: "v2",
          content: { messages: [{ type: "text", text }] },
        },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.status === "error") {
      return { success: false, error: json?.message || `ManyChat API error (${res.status})` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error calling ManyChat API" };
  }
}
