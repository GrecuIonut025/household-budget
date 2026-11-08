import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  GlovoBrowsePage,
  GlovoCategoryNode,
  GlovoMarket,
  GlovoProduct,
  GlovoRetailerKey,
} from "./types";

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

export const GLOVO_PAGE_SIZE = 24;

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

function titleFromSlug(slug: string): string {
  const base = slug
    .replace(/-sc\.\d+$/i, "")
    .replace(/-c\.\d+$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!base) return slug;
  return base.replace(/\b\w/g, (ch) => ch.toUpperCase());
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

type RawCategory = {
  retailer: GlovoRetailerKey;
  title: string;
  slug: string | null;
  path: string;
  parent_slug: string | null;
  parent_title: string | null;
};

function loadRawCategories(): RawCategory[] {
  const path = resolveLocalCategoriesPath();
  if (!path) return [];
  try {
    const payload = JSON.parse(readFileSync(path, "utf8"));
    if (!Array.isArray(payload)) return [];
    const out: RawCategory[] = [];
    for (const row of payload) {
      if (!row || typeof row !== "object") continue;
      const retailer = String((row as { retailer?: string }).retailer || "") as GlovoRetailerKey;
      if (!RETAILERS.includes(retailer)) continue;
      const catPath = String((row as { path?: string }).path || "");
      const segments = parseLinkSegments(catPath);
      const leaf =
        (row as { slug?: string }).slug ||
        segments[segments.length - 1] ||
        null;
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

/** Read crawler / fixture JSON for Comparare prețuri (no Supabase write needed). */
export function loadLocalGlovoCatalog(): {
  path: string;
  markets: GlovoMarket[];
  products: GlovoProduct[];
  categories: RawCategory[];
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

  const categories = loadRawCategories();
  const byTitle = new Map<string, RawCategory>();
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
      name,
      description: row.description != null ? String(row.description) : null,
      price: Number.isFinite(price) ? price : null,
      currency: String(row.currency || "RON"),
      price_display: row.price_display != null ? String(row.price_display) : null,
      image_url: row.image_url != null ? String(row.image_url) : null,
      image_id: row.image_id != null ? String(row.image_id) : null,
      category: categoryTitle,
      category_slug:
        row.category_slug != null
          ? String(row.category_slug)
          : matched?.slug ?? null,
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

  return { path, markets, products, categories };
}

export function listParentCategories(
  retailer: GlovoRetailerKey,
  products: GlovoProduct[],
  categories: RawCategory[],
): GlovoCategoryNode[] {
  const parents = new Map<string, GlovoCategoryNode>();
  const childrenByParent = new Map<string, Set<string>>();

  for (const cat of categories) {
    if (cat.retailer !== retailer) continue;
    if (cat.parent_slug) {
      const set = childrenByParent.get(cat.parent_slug) ?? new Set();
      if (cat.slug) set.add(cat.slug);
      childrenByParent.set(cat.parent_slug, set);
      if (!parents.has(cat.parent_slug)) {
        parents.set(cat.parent_slug, {
          slug: cat.parent_slug,
          title: cat.parent_title || titleFromSlug(cat.parent_slug),
          parent_slug: null,
          retailer_key: retailer,
          product_count: 0,
          child_count: 0,
        });
      }
    } else if (cat.slug) {
      // Top-level leaf discovered from HOME
      if (!parents.has(cat.slug)) {
        parents.set(cat.slug, {
          slug: cat.slug,
          title: cat.title,
          parent_slug: null,
          retailer_key: retailer,
          product_count: 0,
          child_count: 0,
        });
      }
    }
  }

  for (const product of products) {
    if (product.retailer_key !== retailer || product.price == null) continue;
    const parentSlug = product.parent_category_slug || product.category_slug;
    if (!parentSlug) continue;
    const node = parents.get(parentSlug);
    if (node) node.product_count += 1;
    else {
      parents.set(parentSlug, {
        slug: parentSlug,
        title: product.parent_category || product.category || titleFromSlug(parentSlug),
        parent_slug: null,
        retailer_key: retailer,
        product_count: 1,
        child_count: 0,
      });
    }
  }

  for (const [slug, node] of parents) {
    node.child_count = childrenByParent.get(slug)?.size ?? 0;
  }

  return [...parents.values()]
    .filter((n) => n.product_count > 0 || n.child_count > 0)
    .sort((a, b) => a.title.localeCompare(b.title, "ro"));
}

export function listSubcategories(
  retailer: GlovoRetailerKey,
  parentSlug: string,
  products: GlovoProduct[],
  categories: RawCategory[],
): GlovoCategoryNode[] {
  const nodes = new Map<string, GlovoCategoryNode>();
  for (const cat of categories) {
    if (cat.retailer !== retailer || cat.parent_slug !== parentSlug || !cat.slug) continue;
    nodes.set(cat.slug, {
      slug: cat.slug,
      title: cat.title,
      parent_slug: parentSlug,
      retailer_key: retailer,
      product_count: 0,
      child_count: 0,
    });
  }
  for (const product of products) {
    if (product.retailer_key !== retailer || product.price == null) continue;
    if (product.parent_category_slug !== parentSlug) continue;
    const slug = product.category_slug;
    if (!slug) continue;
    const node = nodes.get(slug);
    if (node) node.product_count += 1;
    else {
      nodes.set(slug, {
        slug,
        title: product.category || titleFromSlug(slug),
        parent_slug: parentSlug,
        retailer_key: retailer,
        product_count: 1,
        child_count: 0,
      });
    }
  }
  return [...nodes.values()]
    .filter((n) => n.product_count > 0)
    .sort((a, b) => a.title.localeCompare(b.title, "ro"));
}

export function browseLocalProducts(
  products: GlovoProduct[],
  opts: {
    retailer: GlovoRetailerKey;
    parentSlug?: string | null;
    categorySlug?: string | null;
    query?: string;
    page?: number;
    pageSize?: number;
  },
): GlovoBrowsePage {
  const pageSize = Math.min(Math.max(opts.pageSize ?? GLOVO_PAGE_SIZE, 1), 100);
  const page = Math.max(opts.page ?? 1, 1);
  const q = opts.query?.trim().toLowerCase() ?? "";

  let rows = products.filter((p) => p.retailer_key === opts.retailer && p.price != null);

  if (opts.categorySlug) {
    rows = rows.filter(
      (p) =>
        p.category_slug === opts.categorySlug ||
        (p.category &&
          p.category.toLowerCase() === opts.categorySlug!.replace(/-c\.\d+$/i, "").replace(/-/g, " ")),
    );
  } else if (opts.parentSlug) {
    rows = rows.filter(
      (p) =>
        p.parent_category_slug === opts.parentSlug ||
        p.category_slug === opts.parentSlug,
    );
  }

  if (q) {
    if (/^\d{8,14}$/.test(q)) {
      rows = rows.filter((p) => p.eans.some((ean) => ean.includes(q)));
    } else {
      rows = rows.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.category?.toLowerCase().includes(q) ?? false) ||
          (p.parent_category?.toLowerCase().includes(q) ?? false),
      );
    }
  }

  rows.sort((a, b) => a.name.localeCompare(b.name, "ro"));
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
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
