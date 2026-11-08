import "server-only";
import {
  browseLocalProducts,
  GLOVO_PAGE_SIZE,
  listParentCategories,
  listSubcategories,
  loadLocalGlovoCatalog,
  staticGlovoMarkets,
} from "@/lib/glovo/local-catalog";
import type {
  GlovoBrowsePage,
  GlovoCategoryNode,
  GlovoMarket,
  GlovoProduct,
  GlovoRetailerKey,
} from "@/lib/glovo/types";

export { GLOVO_PAGE_SIZE };

export async function listGlovoMarkets(): Promise<GlovoMarket[]> {
  const local = loadLocalGlovoCatalog();
  if (local && local.products.length > 0) {
    return local.markets.map((m) => ({
      ...m,
      last_synced_at: new Date().toISOString(),
    }));
  }
  return staticGlovoMarkets();
}

export async function getGlovoBrowseContext(retailer: GlovoRetailerKey): Promise<{
  products: GlovoProduct[];
  parents: GlovoCategoryNode[];
  catalogPath: string | null;
  hasData: boolean;
}> {
  const local = loadLocalGlovoCatalog();
  if (!local || local.products.length === 0) {
    return { products: [], parents: [], catalogPath: null, hasData: false };
  }
  const products = local.products.filter((p) => p.retailer_key === retailer);
  const parents = listParentCategories(retailer, local.products, local.categories);
  return {
    products,
    parents,
    catalogPath: local.path,
    hasData: products.some((p) => p.price != null),
  };
}

export async function listGlovoSubcategories(
  retailer: GlovoRetailerKey,
  parentSlug: string,
): Promise<GlovoCategoryNode[]> {
  const local = loadLocalGlovoCatalog();
  if (!local) return [];
  return listSubcategories(retailer, parentSlug, local.products, local.categories);
}

export async function browseGlovoProducts(opts: {
  retailer: GlovoRetailerKey;
  parentSlug?: string | null;
  categorySlug?: string | null;
  query?: string;
  page?: number;
  pageSize?: number;
}): Promise<GlovoBrowsePage> {
  const local = loadLocalGlovoCatalog();
  if (!local) {
    return { items: [], total: 0, page: 1, pageSize: opts.pageSize ?? GLOVO_PAGE_SIZE, totalPages: 1 };
  }
  return browseLocalProducts(local.products, opts);
}

export async function hasGlovoCatalog(): Promise<boolean> {
  const local = loadLocalGlovoCatalog();
  return Boolean(local && local.products.some((p) => p.price != null));
}
