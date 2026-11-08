export type GlovoRetailerKey = "profi" | "carrefour" | "kaufland" | "mega_image";

export type GlovoMarket = {
  id: string;
  retailer_key: GlovoRetailerKey;
  store_slug: string;
  name: string;
  city: string;
  city_code: string;
  brand_color: string | null;
  logo_emoji: string | null;
  is_active: boolean;
  last_synced_at: string | null;
};

export type GlovoProduct = {
  id: string;
  market_id: string;
  retailer_key: GlovoRetailerKey;
  identity_key: string;
  glovo_product_id: string | null;
  /** Numeric Glovo store id from crawl (basket API). */
  glovo_store_id: string | null;
  /** Numeric Glovo store address id from crawl (basket API). */
  glovo_address_id: string | null;
  store_product_id: string | null;
  external_id: string | null;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  price_display: string | null;
  image_url: string | null;
  image_id: string | null;
  category: string | null;
  category_slug: string | null;
  parent_category: string | null;
  parent_category_slug: string | null;
  eans: string[];
  out_of_stock: boolean;
  observed_at: string;
};

export type GlovoCategoryNode = {
  slug: string;
  title: string;
  parent_slug: string | null;
  retailer_key: GlovoRetailerKey;
  product_count: number;
  child_count: number;
  /** First in-stock product image for Glovo-style tiles. */
  image_url: string | null;
};

export type GlovoBrowsePage = {
  items: GlovoProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type GlovoQuote = {
  productId: string;
  retailerKey: GlovoRetailerKey;
  marketName: string;
  brandColor: string | null;
  logoEmoji: string | null;
  price: number;
  currency: string;
  priceDisplay: string | null;
  imageUrl: string | null;
  outOfStock: boolean;
  category: string | null;
};

export type GlovoComparisonGroup = {
  key: string;
  name: string;
  imageUrl: string | null;
  category: string | null;
  eans: string[];
  quotes: GlovoQuote[];
  cheapestRetailerKey: GlovoRetailerKey | null;
  spread: number | null;
};
