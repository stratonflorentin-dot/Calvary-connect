"use server";

import { createClient } from "@supabase/supabase-js";

/**
 * Server-side storage uploads.
 *
 * The live storage.objects table has no INSERT policies for authenticated
 * users, so every client-side upload fails with "new row violates row-level
 * security policy". Until migration 026's storage section is applied, this
 * action is the only reliable upload path — and it stays the safer one after:
 * the caller's Supabase session is verified server-side, then the write runs
 * with the service role.
 */

const ALLOWED_BUCKETS = new Set([
  "profile-photos",
  "avatars",
  "chat-attachments",
  "compliance-docs",
  "documents",
  "vehicle-documents",
  "vehicle-photos",
]);

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

/** Reject path tricks — only simple folder/name segments are allowed. */
function isSafePath(path: string) {
  return (
    path.length > 0 &&
    path.length < 512 &&
    !path.includes("..") &&
    !path.startsWith("/") &&
    /^[\w\-./ ()@]+$/.test(path)
  );
}

export async function uploadToBucketAction(
  accessToken: string,
  bucket: string,
  path: string,
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  try {
    if (!accessToken) return { error: "Not authenticated" };
    if (!ALLOWED_BUCKETS.has(bucket)) return { error: `Bucket not allowed: ${bucket}` };
    if (!isSafePath(path)) return { error: "Invalid file path" };

    const admin = getAdminClient();
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(accessToken);
    if (authError || !user) return { error: "Invalid session" };

    const file = formData.get("file");
    if (!(file instanceof Blob) || file.size === 0) return { error: "No file provided" };
    if (file.size > MAX_BYTES) {
      return { error: `File is too large (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB)` };
    }

    const { error: uploadError } = await admin.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });
    if (uploadError) return { error: uploadError.message };

    const {
      data: { publicUrl },
    } = admin.storage.from(bucket).getPublicUrl(path);
    return { url: publicUrl };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed" };
  }
}
