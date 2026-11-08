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
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  price_display: string | null;
  image_url: string | null;
  image_id: string | null;
  category: string | null;
  eans: string[];
  out_of_stock: boolean;
  observed_at: string;
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
