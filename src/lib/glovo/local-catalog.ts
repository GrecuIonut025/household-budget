import "server-only";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  browseLocalProducts,
  filterLocalProducts,
  GLOVO_PAGE_SIZE,
  listParentCategories,
  listSubcategories,
  titleFromSlug,
  type GlovoRawCategory,
} from "./browse";
import type { GlovoMarket, GlovoProduct, GlovoRetailerKey } from "./types";

export {
  browseLocalProducts,
  filterLocalProducts,
  GLOVO_PAGE_SIZE,
  listParentCategories,
  listSubcategories,
};
export type { GlovoRawCategory };

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

function catalogProductPaths(): string[] {
  const root = process.cwd();
  return [
    join(root, "glovo_data", "all_products.json"),
    join(root, "fixtures", "glovo", "all_products.json"),
  ];
}

function catalogCategoryPaths(): string[] {
  const root = process.cwd();
  return [
    join(root, "glovo_data", "all_categories.json"),
    join(root, "fixtures", "glovo", "all_categories.json"),
  ];
}

export function resolveLocalGlovoCatalogPath(): string | null {
  for (const path of catalogProductPaths()) {
    if (existsSync(path)) return path;
  }
  return null;
}

function resolveLocalCategoriesPath(): string | null {
  for (const path of catalogCategoryPaths()) {
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

function parseLinkSegments(path: string): string[] {
  const match = String(path || "").match(/[?&]link=([^&]+)/);
  if (!match) return [];
  try {
    return decodeURIComponent(match[1]).split("/").map((s) => s.trim()).filter(Boolean);
  } catch {
    return match[1].split("/").filter(Boolean);
  }
}

function loadRawCategories(): GlovoRawCategory[] {
  const path = resolveLocalCategoriesPath();
  if (!path) return [];
  try {
    const payload = JSON.parse(readFileSync(path, "utf8"));
    if (!Array.isArray(payload)) return [];
    const out: GlovoRawCategory[] = [];
    for (const row of payload) {
      if (!row || typeof row !== "object") continue;
      const retailer = String((row as { retailer?: string }).retailer || "") as GlovoRetailerKey;
      if (!RETAILERS.includes(retailer)) continue;
      const catPath = String((row as { path?: string }).path || "");
      const segments = parseLinkSegments(catPath);
      const leaf = (row as { slug?: string }).slug || segments[segments.length - 1] || null;
      const parentSlug =
        (row as { parent_slug?: string | null }).parent_slug ??
        (segments.length > 1 ? segments[segments.length - 2]! : null);
      const title = String((row as { title?: string }).title || titleFromSlug(leaf || "categorie"));
      out.push({
        retailer,
        title,
        slug: leaf,
        path: catPath,
        parent_slug: parentSlug,
        parent_title:
          (row as { parent_title?: string | null }).parent_title ??
          (parentSlug ? titleFromSlug(parentSlug) : null),
      });
    }
    return out;
  } catch {
    return [];
  }
}

type CatalogPayload = {
  path: string;
  markets: GlovoMarket[];
  products: GlovoProduct[];
  categories: GlovoRawCategory[];
  mtimeMs: number;
};

let catalogCache: CatalogPayload | null = null;

function fileMtime(path: string | null): number {
  if (!path) return 0;
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

/** Read crawler / fixture JSON once; invalidate when files change on disk. */
export function loadLocalGlovoCatalog(): CatalogPayload | null {
  const path = resolveLocalGlovoCatalogPath();
  if (!path) return null;

  const catPath = resolveLocalCategoriesPath();
  const mtimeMs = Math.max(fileMtime(path), fileMtime(catPath));
  if (catalogCache && catalogCache.path === path && catalogCache.mtimeMs === mtimeMs) {
    return catalogCache;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
  if (!Array.isArray(payload)) return null;

  const categories = loadRawCategories();
  const byTitle = new Map<string, GlovoRawCategory>();
  for (const cat of categories) {
    byTitle.set(`${cat.retailer}:${cat.title.toLowerCase()}`, cat);
  }

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

    const categoryTitle = row.category != null ? String(row.category) : null;
    const matched =
      categoryTitle && categoryTitle !== "HOME"
        ? byTitle.get(`${retailer}:${categoryTitle.toLowerCase()}`)
        : undefined;

    products.push({
      id: `local-${retailer}-${identity}-${index}`,
      market_id: marketId[retailer]!,
      retailer_key: retailer,
      identity_key: identity,
      glovo_product_id: row.product_id != null ? String(row.product_id) : null,
      glovo_store_id: row.store_id != null ? String(row.store_id) : null,
      glovo_address_id: row.address_id != null ? String(row.address_id) : null,
      store_product_id:
        row.store_product_id != null
          ? String(row.store_product_id)
          : row.external_id != null
            ? String(row.external_id)
            : null,
      external_id: row.external_id != null ? String(row.external_id) : null,
      name,
      description: row.description != null ? String(row.description) : null,
      price: Number.isFinite(price) ? price : null,
      currency: String(row.currency || "RON"),
      price_display: row.price_display != null ? String(row.price_display) : null,
      image_url: row.image_url != null ? String(row.image_url) : null,
      image_id: row.image_id != null ? String(row.image_id) : null,
      category: categoryTitle,
      category_slug:
        row.category_slug != null ? String(row.category_slug) : matched?.slug ?? null,
      parent_category:
        row.parent_category != null
          ? String(row.parent_category)
          : matched?.parent_title ?? null,
      parent_category_slug:
        row.parent_category_slug != null
          ? String(row.parent_category_slug)
          : matched?.parent_slug ?? null,
      eans: parseEans(row.eans),
      out_of_stock: Boolean(row.out_of_stock),
      observed_at: new Date().toISOString(),
    });
  }

  catalogCache = { path, markets, products, categories, mtimeMs };
  return catalogCache;
}
