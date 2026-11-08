import type { GlovoRetailerKey } from "./types";

/** Official Glovo web/app universal links for Brașov storefronts. */
const CITY = "brasov";
const LOCALE = "ro/ro";

/** Store landing: https://glovoapp.com/ro/ro/brasov/stores/{slug} */
export function glovoStoreUrl(storeSlug: string): string {
  return `https://glovoapp.com/${LOCALE}/${CITY}/stores/${encodeURIComponent(storeSlug)}`;
}

/**
 * Product PDP when we have a Glovo product id from the crawl.
 * https://glovoapp.com/ro/ro/brasov/stores/{slug}/products/{id}
 */
export function glovoProductUrl(storeSlug: string, glovoProductId: string): string {
  return `${glovoStoreUrl(storeSlug)}/products/${encodeURIComponent(glovoProductId)}`;
}

/** Best-effort product find: open the store with a search query (Glovo web/app). */
export function glovoProductSearchUrl(storeSlug: string, productName: string): string {
  const q = encodeURIComponent(productName.trim());
  return `${glovoStoreUrl(storeSlug)}?search=${q}`;
}

/**
 * Android intent that prefers the Glovo app, falls back to the HTTPS store page.
 * iOS uses the HTTPS universal link instead.
 */
export function glovoAndroidIntentUrl(storeSlug: string): string {
  const https = glovoStoreUrl(storeSlug);
  const path = `${LOCALE}/${CITY}/stores/${storeSlug}`;
  return `intent://${path}#Intent;scheme=https;package=com.glovoapp.app;S.browser_fallback_url=${encodeURIComponent(https)};end`;
}

export function isLikelyMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/** Open Glovo for a Brașov store (app if possible). Returns the URL that was opened. */
export function openGlovoStore(storeSlug: string): string {
  const https = glovoStoreUrl(storeSlug);
  const url = isAndroid() ? glovoAndroidIntentUrl(storeSlug) : https;
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return url;
}

/**
 * Best-effort cart handoff: Glovo has no public multi-add deep link, so we open the
 * store (or the first product PDP) and rely on the clipboard checklist.
 */
export function openGlovoCartHandoff(lines: CartLine[]): string | null {
  const storeSlug = lines[0]?.storeSlug;
  if (!storeSlug) return null;
  const withId = lines.find((l) => l.glovoProductId);
  if (lines.length === 1 && withId?.glovoProductId) {
    const https = glovoProductUrl(storeSlug, withId.glovoProductId);
    if (typeof window !== "undefined") {
      window.open(https, "_blank", "noopener,noreferrer");
    }
    return https;
  }
  return openGlovoStore(storeSlug);
}

export type CartLine = {
  id: string;
  name: string;
  priceDisplay: string | null;
  imageUrl: string | null;
  qty: number;
  retailer: GlovoRetailerKey;
  storeSlug: string;
  glovoProductId?: string | null;
};

export function formatCartChecklist(lines: CartLine[]): string {
  return lines
    .map((l) => {
      const head = `• ${l.qty}× ${l.name}${l.priceDisplay ? ` (${l.priceDisplay})` : ""}`;
      if (l.glovoProductId && l.storeSlug) {
        return `${head}\n  ${glovoProductUrl(l.storeSlug, l.glovoProductId)}`;
      }
      if (l.storeSlug) {
        return `${head}\n  ${glovoProductSearchUrl(l.storeSlug, l.name)}`;
      }
      return head;
    })
    .join("\n");
}
