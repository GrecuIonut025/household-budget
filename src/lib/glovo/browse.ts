import type {
  GlovoBrowsePage,
  GlovoCategoryNode,
  GlovoProduct,
  GlovoRetailerKey,
} from "./types";

export const GLOVO_PAGE_SIZE = 24;

export type GlovoRawCategory = {
  retailer: GlovoRetailerKey;
  title: string;
  slug: string | null;
  path: string;
  parent_slug: string | null;
  parent_title: string | null;
};

export function titleFromSlug(slug: string): string {
  const base = slug
    .replace(/-sc\.\d+$/i, "")
    .replace(/-c\.\d+$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!base) return slug;
  return base.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function listParentCategories(
  retailer: GlovoRetailerKey,
  products: GlovoProduct[],
  categories: GlovoRawCategory[],
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
          image_url: null,
        });
      }
    } else if (cat.slug) {
      if (!parents.has(cat.slug)) {
        parents.set(cat.slug, {
          slug: cat.slug,
          title: cat.title,
          parent_slug: null,
          retailer_key: retailer,
          product_count: 0,
          child_count: 0,
          image_url: null,
        });
      }
    }
  }

  for (const product of products) {
    if (product.retailer_key !== retailer || product.price == null) continue;
    const parentSlug = product.parent_category_slug || product.category_slug;
    if (!parentSlug) continue;
    const node = parents.get(parentSlug);
    if (node) {
      node.product_count += 1;
      if (!node.image_url && product.image_url) node.image_url = product.image_url;
    } else {
      parents.set(parentSlug, {
        slug: parentSlug,
        title: product.parent_category || product.category || titleFromSlug(parentSlug),
        parent_slug: null,
        retailer_key: retailer,
        product_count: 1,
        child_count: 0,
        image_url: product.image_url,
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
  categories: GlovoRawCategory[],
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
      image_url: null,
    });
  }
  for (const product of products) {
    if (product.retailer_key !== retailer || product.price == null) continue;
    if (product.parent_category_slug !== parentSlug) continue;
    const slug = product.category_slug;
    if (!slug) continue;
    const node = nodes.get(slug);
    if (node) {
      node.product_count += 1;
      if (!node.image_url && product.image_url) node.image_url = product.image_url;
    } else {
      nodes.set(slug, {
        slug,
        title: product.category || titleFromSlug(slug),
        parent_slug: parentSlug,
        retailer_key: retailer,
        product_count: 1,
        child_count: 0,
        image_url: product.image_url,
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
          p.category.toLowerCase() ===
            opts.categorySlug!.replace(/-c\.\d+$/i, "").replace(/-/g, " ")),
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
