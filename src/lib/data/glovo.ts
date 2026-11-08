import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { GlovoMarket, GlovoProduct, GlovoRetailerKey } from "@/lib/glovo/types";

const MARKET_COLS =
  "id, retailer_key, store_slug, name, city, city_code, brand_color, logo_emoji, is_active, last_synced_at";
const PRODUCT_COLS =
  "id, market_id, retailer_key, identity_key, glovo_product_id, name, description, price, currency, price_display, image_url, image_id, category, eans, out_of_stock, observed_at";

export async function listGlovoMarkets(): Promise<GlovoMarket[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("glovo_markets")
    .select(MARKET_COLS)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as GlovoMarket[];
}

export async function searchGlovoProducts(opts: {
  query?: string;
  retailer?: GlovoRetailerKey | null;
  limit?: number;
}): Promise<GlovoProduct[]> {
  const supabase = await createClient();
  const limit = Math.min(Math.max(opts.limit ?? 120, 1), 400);
  let q = supabase
    .from("glovo_products")
    .select(PRODUCT_COLS)
    .not("price", "is", null)
    .order("name")
    .limit(limit);

  if (opts.retailer) {
    q = q.eq("retailer_key", opts.retailer);
  }

  const query = opts.query?.trim();
  if (query) {
    // ilike on name/category; EAN exact-ish via contains when numeric.
    if (/^\d{8,14}$/.test(query)) {
      q = q.contains("eans", [query]);
    } else {
      q = q.or(`name.ilike.%${query}%,category.ilike.%${query}%`);
    }
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...(row as GlovoProduct),
    eans: Array.isArray(row.eans) ? row.eans : [],
    price: row.price == null ? null : Number(row.price),
  }));
}

/** When the search query is empty, pull a balanced sample across markets for the landing view. */
export async function listGlovoCatalogSample(limitPerMarket = 40): Promise<GlovoProduct[]> {
  const markets = await listGlovoMarkets();
  const chunks = await Promise.all(
    markets.map(async (market) => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("glovo_products")
        .select(PRODUCT_COLS)
        .eq("retailer_key", market.retailer_key)
        .not("price", "is", null)
        .order("name")
        .limit(limitPerMarket);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...(row as GlovoProduct),
        eans: Array.isArray(row.eans) ? row.eans : [],
        price: row.price == null ? null : Number(row.price),
      }));
    }),
  );
  return chunks.flat();
}
