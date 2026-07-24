import { createHmac, timingSafeEqual } from "crypto";

/**
 * Meta Graph API client for Instagram DM messaging. Server-only — never
 * import this from a client component (the access token must stay server-side).
 *
 * NOTE: Meta has two distinct Instagram messaging products with different
 * endpoints/token types — the classic Page-linked "Instagram API with
 * Facebook Login" (Page Access Token, `graph.facebook.com`) and the newer
 * "Instagram API with Instagram Login" (no Page required). This client
 * targets the classic Page-based flow since it's the more established one;
 * confirm against the Meta App Dashboard which product this app actually
 * uses, and adjust GRAPH_API_BASE / the send payload below if needed.
 */

const GRAPH_API_VERSION = "v19.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function getAccessToken() {
  const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error("Missing INSTAGRAM_PAGE_ACCESS_TOKEN");
  return token;
}

/**
 * Verifies Meta's `X-Hub-Signature-256` header against the raw request body.
 * This is the ONLY thing protecting the public, unauthenticated webhook
 * endpoint from spoofed requests — reject anything that fails this check.
 */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.INSTAGRAM_APP_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/** Sends a text reply to an Instagram-scoped sender ID (IGSID). */
export async function sendInstagramMessage(igSenderId: string, text: string): Promise<SendMessageResult> {
  try {
    const res = await fetch(`${GRAPH_API_BASE}/me/messages?access_token=${encodeURIComponent(getAccessToken())}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: igSenderId },
        message: { text },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      return { success: false, error: json?.error?.message || `Graph API error (${res.status})` };
    }
    return { success: true, messageId: json.message_id };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error calling Graph API" };
  }
}
