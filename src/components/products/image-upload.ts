"use client";

import { createClient } from "@/lib/supabase/browser";
import { PRODUCT_MEDIA_BUCKET } from "@/lib/products/constants";

const MAX_EDGE = 1024;

/** Downscales a photo to at most 1024px on its longest edge and re-encodes it as JPEG (small, universally supported). */
export async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
  );
}

/** Uploads into the household-scoped folder; storage RLS requires the path to start with the household id. */
export async function uploadProductImage(householdId: string, productId: string, file: File): Promise<string> {
  const blob = await resizeImage(file);
  const path = `${householdId}/products/${productId}/${crypto.randomUUID()}.jpg`;
  const { error } = await createClient().storage.from(PRODUCT_MEDIA_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    cacheControl: "3600",
  });
  if (error) throw error;
  return path;
}

export async function removeProductImage(path: string): Promise<void> {
  await createClient().storage.from(PRODUCT_MEDIA_BUCKET).remove([path]);
}
