import type { GlovoRetailerKey } from "./types";

/** Official Glovo web/app universal links for Brașov storefronts. */
const CITY = "brasov";
const LOCALE = "ro/ro";
/** From glovoapp.com/.well-known/assetlinks.json (not the legacy com.glovoapp.app id). */
export const GLOVO_ANDROID_PACKAGE = "com.glovo";

/** Store landing: https://glovoapp.com/ro/ro/brasov/stores/{slug} */
export function glovoStoreUrl(storeSlug: string): string {
  return `https://glovoapp.com/${LOCALE}/${CITY}/stores/${encodeURIComponent(storeSlug)}`;
}

/**
 * Product path — often 404 for grocery SKUs and explicitly excluded from Android/iOS
 * app-link routing (paths under /products/), so prefer glovoProductSearchUrl for handoff.
 */
export function glovoProductUrl(storeSlug: string, glovoProductId: string): string {
  return `${glovoStoreUrl(storeSlug)}/products/${encodeURIComponent(glovoProductId)}`;
}

/** Best-effort product find: open the store with a search query (opens in Glovo app/web). */
export function glovoProductSearchUrl(storeSlug: string, productName: string): string {
  const q = encodeURIComponent(productName.trim());
  return `${glovoStoreUrl(storeSlug)}?search=${q}`;
}

/**
 * Android intent that prefers the Glovo app, falls back to the HTTPS store (or search) page.
 * iOS uses the HTTPS universal link instead.
 */
export function glovoAndroidIntentUrl(httpsUrl: string): string {
  const stripped = httpsUrl.replace(/^https:\/\//i, "");
  return `intent://${stripped}#Intent;scheme=https;package=${GLOVO_ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(httpsUrl)};end`;
}

export function isLikelyMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

function openExternal(httpsUrl: string): string {
  const url = isAndroid() ? glovoAndroidIntentUrl(httpsUrl) : httpsUrl;
  if (typeof window !== "undefined") {
    // location.assign opens universal links more reliably than window.open on mobile WebViews.
    if (isLikelyMobile()) {
      window.location.assign(url);
    } else {
      window.open(httpsUrl, "_blank", "noopener,noreferrer");
    }
  }
  return url;
}

/** Open Glovo for a Brașov store (app if possible). Returns the URL that was opened. */
export function openGlovoStore(storeSlug: string): string {
  return openExternal(glovoStoreUrl(storeSlug));
}

/**
 * Best-effort cart handoff.
 *
 * Research (RO Brașov, 2026-11):
 * - Universal links: `https://glovoapp.com/ro/ro/brasov/stores/{slug}` open the native app.
 * - Android package: `com.glovo`.
 * - `/products/{id}` paths are excluded from app links and often 404 for grocery SKUs.
 * - Basket mutation is only via authenticated
 *   `POST/PUT /v1/authenticated/customers/{id}/baskets…` (needs the shopper's Glovo session).
 * - No public multi-add query/deeplink that fills a cart without that session.
 *
 * We therefore open the store focused on the first product search and copy a checklist —
 * no payment / no order submit from this app.
 */
export function buildGlovoHandoffUrl(lines: CartLine[]): string | null {
  const storeSlug = lines[0]?.storeSlug;
  if (!storeSlug) return null;
  const first = lines[0];
  if (first?.name) return glovoProductSearchUrl(storeSlug, first.name);
  return glovoStoreUrl(storeSlug);
}

export function openGlovoCartHandoff(lines: CartLine[]): string | null {
  const https = buildGlovoHandoffUrl(lines);
  if (!https) return null;
  return openExternal(https);
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
  storeProductId?: string | null;
  glovoStoreId?: string | null;
  glovoAddressId?: string | null;
};

export function formatCartChecklist(lines: CartLine[]): string {
  const header = lines[0]?.storeSlug
    ? `Glovo Brașov — ${lines[0].storeSlug}\n${glovoStoreUrl(lines[0].storeSlug)}\n`
    : "";
  const body = lines
    .map((l) => {
      const head = `• ${l.qty}× ${l.name}${l.priceDisplay ? ` (${l.priceDisplay})` : ""}`;
      if (l.storeSlug) {
        return `${head}\n  ${glovoProductSearchUrl(l.storeSlug, l.name)}`;
      }
      return head;
    })
    .join("\n");
  return `${header}${body}`;
}
