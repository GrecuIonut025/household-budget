import { readFileSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { GlovoBrasovBrowse } from "@/components/prices/glovo-brasov";
import { ForceDark } from "@/components/dashboard/force-dark";
import {
  browseLocalProducts,
  listParentCategories,
  listSubcategories,
  staticGlovoMarkets,
} from "@/lib/glovo/local-catalog";
import type { GlovoProduct, GlovoRetailerKey } from "@/lib/glovo/types";

/** Dev-only Comparare prețuri browse preview with fixture/local crawl data. */
export default function VisualGlovoPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const markets = staticGlovoMarkets();
  let products: GlovoProduct[] = [];
  let categories: Parameters<typeof listParentCategories>[2] = [];
  try {
    const rawProducts = JSON.parse(
      readFileSync(join(process.cwd(), "fixtures/glovo/all_products.json"), "utf8"),
    ) as Array<Record<string, unknown>>;
    const marketId = Object.fromEntries(markets.map((m) => [m.retailer_key, m.id]));
    products = rawProducts.map((row, index) => {
      const retailer = String(row.retailer) as GlovoRetailerKey;
      return {
        id: `fixture-${index}`,
        market_id: marketId[retailer] ?? markets[0]!.id,
        retailer_key: retailer,
        identity_key: String(row.store_product_id ?? row.name),
        glovo_product_id: row.product_id != null ? String(row.product_id) : null,
        name: String(row.name),
        description: row.description != null ? String(row.description) : null,
        price: Number(row.price),
        currency: String(row.currency ?? "RON"),
        price_display: row.price_display != null ? String(row.price_display) : null,
        image_url: row.image_url != null ? String(row.image_url) : null,
        image_id: null,
        category: row.category != null ? String(row.category) : null,
        category_slug: row.category_slug != null ? String(row.category_slug) : "lapte-c.1",
        parent_category: row.parent_category != null ? String(row.parent_category) : "Lactate",
        parent_category_slug:
          row.parent_category_slug != null ? String(row.parent_category_slug) : "lactate-sc.1",
        eans: Array.isArray(row.eans) ? row.eans.map(String) : [],
        out_of_stock: Boolean(row.out_of_stock),
        observed_at: new Date().toISOString(),
      };
    });
    categories = [
      {
        retailer: "profi",
        title: "Lapte Zuzu",
        slug: "lapte-c.1",
        path: "/x?link=lactate-sc.1/lapte-c.1",
        parent_slug: "lactate-sc.1",
        parent_title: "Lactate",
      },
    ];
  } catch {
    // preview empty
  }

  const retailer: GlovoRetailerKey = "profi";
  const parents = listParentCategories(retailer, products, categories);
  const parentSlug = parents[0]?.slug ?? null;
  const children = parentSlug ? listSubcategories(retailer, parentSlug, products, categories) : [];
  const browse = browseLocalProducts(products, {
    retailer,
    parentSlug,
    categorySlug: children[0]?.slug ?? null,
    page: 1,
  });

  return (
    <div className="min-h-dvh bg-bg px-4 py-6 text-fg sm:px-8">
      <ForceDark />
      <div className="mx-auto max-w-3xl">
        <GlovoBrasovBrowse
          markets={markets}
          selectedMarket={retailer}
          parents={parents}
          subcategories={children}
          browse={browse}
          parentSlug={parentSlug}
          categorySlug={children[0]?.slug ?? null}
          query=""
          locale="ro"
          labels={{
            title: "Piețe din Brașov pe Glovo",
            subtitle: "Previzualizare fixture — alege supermarket, categorii, produse.",
            pickMarket: "Alege un supermarket.",
            categories: "Categorii",
            subcategories: "Subcategorii",
            products: "Produse",
            searchPlaceholder: "Caută…",
            search: "Caută",
            allMarkets: "Toate piețele",
            emptyTitle: "Gol",
            emptyBody: "npm run glovo:sync",
            outOfStock: "Stoc epuizat",
            sourceNote: "Fixture preview",
            back: "Înapoi",
            pageOf: "Pagina {page} din {pages}",
            prev: "Anterior",
            next: "Următor",
            items: "{count} produse",
            noProductsInCategory: "Nimic aici",
          }}
        />
      </div>
    </div>
  );
}
