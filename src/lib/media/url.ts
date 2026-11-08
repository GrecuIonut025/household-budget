import { getSupabaseEnv } from "@/lib/supabase/env";

export const MEDIA_BUCKETS = ["household-media", "community-media"] as const;
export type MediaBucket = (typeof MEDIA_BUCKETS)[number];

export function isMediaBucket(value: string): value is MediaBucket {
  return (MEDIA_BUCKETS as readonly string[]).includes(value);
}

/** Same-origin media URL so phones on LAN HTTP don't hit localhost Supabase / CSP / mixed content. */
export function mediaProxyUrl(bucket: MediaBucket, path: string): string {
  const qs = new URLSearchParams({ bucket, path });
  return `/api/media?${qs.toString()}`;
}

/**
 * Hostname patterns Next/Image may fetch (Supabase Storage + local stack).
 * Derived from env when possible; always includes the common cloud suffix.
 */
export function supabaseImageHosts(): string[] {
  const hosts = new Set<string>(["**.supabase.co", "127.0.0.1", "localhost"]);
  const env = getSupabaseEnv();
  if (env?.url) {
    try {
      hosts.add(new URL(env.url).hostname);
    } catch {
      // ignore invalid URL
    }
  }
  return [...hosts];
}

/**
 * Rewrite absolute storage URLs for browser display:
 * - force https for remote hosts (avoid mixed content on HTTPS app pages)
 * - map loopback Supabase hosts to the same-origin media proxy when path is known
 */
export function rewriteStorageUrlForBrowser(
  url: string,
  opts?: { bucket?: MediaBucket; path?: string },
): string {
  if (!url || url.startsWith("/")) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const loopback =
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "localhost" ||
    parsed.hostname === "0.0.0.0";

  if (loopback && opts?.bucket && opts.path) {
    return mediaProxyUrl(opts.bucket, opts.path);
  }

  // HTTPS pages must not load http:// remote storage (mixed content → blank on phone).
  if (parsed.protocol === "http:" && !loopback) {
    parsed.protocol = "https:";
    return parsed.toString();
  }

  return url;
}
