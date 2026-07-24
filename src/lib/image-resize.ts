/**
 * Downscale and re-encode an image as JPEG before upload.
 *
 * Avatar photos come straight from phone cameras — often several MB and, on
 * iPhones, HEIC — while the storage bucket caps uploads at 2MB and only
 * accepts jpeg/png/webp. Re-encoding client-side sidesteps both limits: the
 * browser decodes whatever format the picker returned (the preview already
 * proves it can), and the JPEG output is always small and always accepted.
 */
export async function resizeImageToJpeg(
  file: File | Blob,
  maxDimension = 512,
  quality = 0.85,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bitmap) throw new Error("Unsupported image format");

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("Failed to encode image");
  return blob;
}
