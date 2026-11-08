import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { GlovoMarket, GlovoProduct, GlovoRetailerKey } from "./types";

const RETAILERS: GlovoRetailerKey[] = ["profi", "carrefour", "kaufland", "mega_image"];

const MARKET_META: Record<
  GlovoRetailerKey,
  { store_slug: string; name: string; brand_color: string; logo_emoji: string }
> = {
  profi: { store_slug: "profi-brv", name: "Profi", brand_color: "#E30613", logo_emoji: "P" },
  carrefour: {
    store_slug: "carrefour-supermarket-brv",
    name: "Carrefour",
    brand_color: "#0057A8",
    logo_emoji: "C",
  },
  kaufland: {
    store_slug: "kaufland-brv-bo",
    name: "Kaufland",
    brand_color: "#E2001A",
    logo_emoji: "K",
  },
  mega_image: {
    store_slug: "mega-image-brv",
    name: "Mega Image",
    brand_color: "#00A651",
    logo_emoji: "M",
  },
};

export function staticGlovoMarkets(): GlovoMarket[] {
  return RETAILERS.map((key) => {
    const meta = MARKET_META[key];
    return {
      id: `local-${key}`,
      retailer_key: key,
      store_slug: meta.store_slug,
      name: meta.name,
      city: "Brașov",
      city_code: "brv",
      brand_color: meta.brand_color,
      logo_emoji: meta.logo_emoji,
      is_active: true,
      last_synced_at: null,
    };
  });
}

function catalogPaths(): string[] {
  const root = process.cwd();
  return [
    join(root, "glovo_data", "all_products.json"),
    join(root, "fixtures", "glovo", "all_products.json"),
  ];
}

/** Path used for the local catalog, if any file exists. */
export function resolveLocalGlovoCatalogPath(): string | null {
  for (const path of catalogPaths()) {
    if (existsSync(path)) return path;
  }
  return null;
}

function identityKey(row: Record<string, unknown>): string {
  return String(
    row.store_product_id || row.external_id || row.product_id || row.name || "",
  ).trim();
}

function parseEans(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

/** Read crawler / fixture JSON for Comparare prețuri (no Supabase write needed). */
export function loadLocalGlovoCatalog(): {
  path: string;
  markets: GlovoMarket[];
  products: GlovoProduct[];
} | null {
  const path = resolveLocalGlovoCatalogPath();
  if (!path) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
  if (!Array.isArray(payload)) return null;

  const markets = staticGlovoMarkets();
  const marketId = Object.fromEntries(markets.map((m) => [m.retailer_key, m.id]));
  const products: GlovoProduct[] = [];

  for (const [index, raw] of payload.entries()) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const retailer = String(row.retailer || "") as GlovoRetailerKey;
    if (!RETAILERS.includes(retailer)) continue;
    const name = String(row.name || "").trim();
    const identity = identityKey(row);
    if (!name || !identity) continue;
    const priceRaw = row.price;
    const price =
      priceRaw == null || priceRaw === ""
        ? null
        : Number.parseFloat(String(priceRaw).replace(",", "."));

    products.push({
      id: `local-${retailer}-${identity}-${index}`,
      market_id: marketId[retailer]!,
      retailer_key: retailer,
      identity_key: identity,
      glovo_product_id: row.product_id != null ? String(row.product_id) : null,
      name,
      description: row.description != null ? String(row.description) : null,
      price: Number.isFinite(price) ? price : null,
      currency: String(row.currency || "RON"),
      price_display: row.price_display != null ? String(row.price_display) : null,
      image_url: row.image_url != null ? String(row.image_url) : null,
      image_id: row.image_id != null ? String(row.image_id) : null,
      category: row.category != null ? String(row.category) : null,
      eans: parseEans(row.eans),
      out_of_stock: Boolean(row.out_of_stock),
      observed_at: new Date().toISOString(),
    });
  }

  return { path, markets, products };
}

export function filterLocalProducts(
  products: GlovoProduct[],
  opts: { query?: string; retailer?: GlovoRetailerKey | null; limit?: number },
): GlovoProduct[] {
  const q = opts.query?.trim().toLowerCase() ?? "";
  let rows = products.filter((p) => p.price != null);
  if (opts.retailer) rows = rows.filter((p) => p.retailer_key === opts.retailer);
  if (q) {
    if (/^\d{8,14}$/.test(q)) {
      rows = rows.filter((p) => p.eans.some((ean) => ean.includes(q)));
    } else {
      rows = rows.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.category?.toLowerCase().includes(q) ?? false),
      );
    }
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, "ro"));
  const limit = Math.min(Math.max(opts.limit ?? 240, 1), 800);
  return rows.slice(0, limit);
}
