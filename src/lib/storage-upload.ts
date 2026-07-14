import { supabase } from "@/lib/supabase";
import { uploadToBucketAction } from "@/app/storage/actions";

/**
 * Upload a file and return its public URL.
 *
 * Uploads go through a server action that verifies the caller's session and
 * writes with the service role — direct client uploads fail with a storage
 * RLS violation until migration 026's storage policies are applied.
 */
export async function uploadToBucket(
  bucket: string,
  folder: string,
  file: File | Blob,
  fileName?: string,
): Promise<string | null> {
  const ext =
    file instanceof File
      ? file.name.split(".").pop() || "bin"
      : "jpg";
  const name = fileName || `${Date.now()}.${ext}`;
  const path = `${folder}/${name}`;

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    console.warn("[uploadToBucket] No authenticated session — upload skipped");
    return null;
  }

  const formData = new FormData();
  formData.append("file", file);

  const { url, error } = await uploadToBucketAction(token, bucket, path, formData);
  if (error) {
    console.warn("[uploadToBucket]", error);
    return null;
  }
  return url ?? null;
}

export async function uploadDataUrl(
  bucket: string,
  folder: string,
  dataUrl: string,
  name: string,
): Promise<string | null> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return uploadToBucket(bucket, folder, blob, name);
}
