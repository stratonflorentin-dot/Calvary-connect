import { supabase } from "@/lib/supabase";

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

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
  });
  if (error) {
    console.warn("[uploadToBucket]", error.message);
    return null;
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
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
