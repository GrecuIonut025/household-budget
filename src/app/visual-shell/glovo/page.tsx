import { readFileSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { GlovoBrasovSection } from "@/components/prices/glovo-brasov";
import { ForceDark } from "@/components/dashboard/force-dark";
import { buildGlovoComparison } from "@/lib/glovo/compare";
import type { GlovoMarket, GlovoProduct } from "@/lib/glovo/types";

/** Dev-only Comparare prețuri / Glovo Brașov chrome preview with fixture data. */
export default function VisualGlovoPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const fixture = JSON.parse(
    readFileSync(join(process.cwd(), "fixtures/glovo/all_products.json"), "utf8"),
  ) as Array<Record<string, unknown>>;

  const markets: GlovoMarket[] = [
    {
      id: "m-profi",
      retailer_key: "profi",
      store_slug: "profi-brv",
      name: "Profi",
      city: "Brașov",
      city_code: "brv",
      brand_color: "#E30613",
      logo_emoji: "P",
      is_active: true,
      last_synced_at: null,
    },
    {
      id: "m-carrefour",
      retailer_key: "carrefour",
      store_slug: "carrefour-supermarket-brv",
      name: "Carrefour",
      city: "Brașov",
      city_code: "brv",
      brand_color: "#0057A8",
      logo_emoji: "C",
      is_active: true,
      last_synced_at: null,
    },
    {
      id: "m-kaufland",
      retailer_key: "kaufland",
      store_slug: "kaufland-brv-bo",
      name: "Kaufland",
      city: "Brașov",
      city_code: "brv",
      brand_color: "#E2001A",
      logo_emoji: "K",
      is_active: true,
      last_synced_at: null,
    },
    {
      id: "m-mega",
      retailer_key: "mega_image",
      store_slug: "mega-image-brv",
      name: "Mega Image",
      city: "Brașov",
      city_code: "brv",
      brand_color: "#00A651",
      logo_emoji: "M",
      is_active: true,
      last_synced_at: null,
    },
  ];

  const marketIdByKey = Object.fromEntries(markets.map((m) => [m.retailer_key, m.id]));
  const products: GlovoProduct[] = fixture.map((row, index) => {
    const retailer = String(row.retailer) as GlovoProduct["retailer_key"];
    return {
      id: `fixture-${index}`,
      market_id: marketIdByKey[retailer] ?? markets[0]!.id,
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
      eans: Array.isArray(row.eans) ? row.eans.map(String) : [],
      out_of_stock: Boolean(row.out_of_stock),
      observed_at: new Date().toISOString(),
    };
  });

  const groups = buildGlovoComparison(products, markets);

  return (
    <div className="min-h-dvh bg-bg px-4 py-6 text-fg sm:px-8">
      <ForceDark />
      <div className="mx-auto max-w-3xl">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand">Bugetify</p>
        <h1 className="mb-6 text-2xl font-bold tracking-tight">Comparare prețuri</h1>
        <GlovoBrasovSection
          markets={markets}
          groups={groups}
          query=""
          retailer={null}
          locale="ro"
          labels={{
            title: "Piețe din Brașov pe Glovo",
            subtitle:
              "Compară Profi, Carrefour, Kaufland și Mega Image din catalogul Glovo Brașov. Sincronizare locală — prețurile vin din importul crawlerului, niciodată inventate.",
            searchPlaceholder: "Caută produse (ex. lapte, pâine, banane)…",
            search: "Caută",
            allMarkets: "Toate piețele",
            cheapest: "Cel mai ieftin",
            spread: "Diferență",
            emptyTitle: "Niciun produs Glovo încă",
            emptyBody: "Rulează local npm run glovo:sync.",
            outOfStock: "Stoc epuizat",
            sourceNote:
              "Sursă: Glovo Brașov (brv). Previzualizare cu fixtures/glovo (fără API live).",
            results: `${groups.length} rezultate`,
          }}
        />
      </div>
    </div>
  );
}
