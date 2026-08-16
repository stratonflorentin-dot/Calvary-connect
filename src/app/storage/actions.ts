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

// Document-style buckets worth surfacing in the receipts/storage manager —
// deliberately excludes avatars/profile-photos/vehicle-photos, which aren't
// "receipts" and are managed from their own settings screens.
const RECEIPT_BUCKETS = ["documents", "vehicle-documents", "compliance-docs"];

const MANAGE_ROLES = new Set(["CEO", "ADMIN"]);

async function requireManageRole(admin: ReturnType<typeof getAdminClient>, accessToken: string) {
  const { data: { user }, error } = await admin.auth.getUser(accessToken);
  if (error || !user) return { error: "Invalid session" as const };
  const { data: profile } = await admin.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !MANAGE_ROLES.has(String(profile.role).toUpperCase())) {
    return { error: "Not authorized to manage storage" as const };
  }
  return { user };
}

export interface StorageFileEntry {
  bucket: string;
  path: string;
  name: string;
  sizeBytes: number;
  updatedAt: string | null;
  url: string;
}

/**
 * Lists files across the document-style buckets, recursing one folder level
 * deep (every upload in this app writes into a folder, never bucket root).
 * Admin/service-role only — regular authenticated users have no SELECT
 * access to storage.objects metadata for these buckets.
 */
export async function listReceiptFilesAction(
  accessToken: string,
): Promise<{ files?: StorageFileEntry[]; error?: string }> {
  try {
    if (!accessToken) return { error: "Not authenticated" };
    const admin = getAdminClient();
    const authCheck = await requireManageRole(admin, accessToken);
    if ("error" in authCheck) return { error: authCheck.error };

    const files: StorageFileEntry[] = [];
    for (const bucket of RECEIPT_BUCKETS) {
      const { data: topLevel } = await admin.storage.from(bucket).list("", { limit: 1000 });
      for (const entry of topLevel || []) {
        if (entry.id === null) {
          // A folder (no id, no metadata) — list one level in.
          const { data: nested } = await admin.storage.from(bucket).list(entry.name, { limit: 1000 });
          for (const file of nested || []) {
            if (file.id === null) continue; // don't recurse past one level
            const path = `${entry.name}/${file.name}`;
            files.push({
              bucket,
              path,
              name: file.name,
              sizeBytes: file.metadata?.size ?? 0,
              updatedAt: file.updated_at ?? file.created_at ?? null,
              url: admin.storage.from(bucket).getPublicUrl(path).data.publicUrl,
            });
          }
        } else {
          files.push({
            bucket,
            path: entry.name,
            name: entry.name,
            sizeBytes: entry.metadata?.size ?? 0,
            updatedAt: entry.updated_at ?? entry.created_at ?? null,
            url: admin.storage.from(bucket).getPublicUrl(entry.name).data.publicUrl,
          });
        }
      }
    }
    files.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    return { files };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to list files" };
  }
}

export async function deleteReceiptFileAction(
  accessToken: string,
  bucket: string,
  path: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    if (!accessToken) return { error: "Not authenticated" };
    if (!RECEIPT_BUCKETS.includes(bucket)) return { error: `Bucket not allowed: ${bucket}` };
    if (!isSafePath(path)) return { error: "Invalid file path" };

    const admin = getAdminClient();
    const authCheck = await requireManageRole(admin, accessToken);
    if ("error" in authCheck) return { error: authCheck.error };

    const { error } = await admin.storage.from(bucket).remove([path]);
    if (error) return { error: error.message };
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Delete failed" };
  }
}
