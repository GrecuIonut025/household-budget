export const PRODUCT_UNITS = ["pcs", "g", "kg", "ml", "l", "pack"] as const;
export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export const PACKAGE_UNITS = ["g", "kg", "ml", "l", "pcs"] as const;
export type PackageUnit = (typeof PACKAGE_UNITS)[number];

/** Stable category keys stored in `products.category`; labels live in the i18n catalogue. */
export const PRODUCT_CATEGORIES = [
  "produce",
  "dairy",
  "meat_fish",
  "bakery",
  "pantry",
  "beverages",
  "frozen",
  "snacks",
  "household",
  "personal_care",
  "other",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export type ProductDataSource = "manual" | "open_food_facts";

export interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  unit: ProductUnit;
  package_size: number | null;
  package_unit: PackageUnit | null;
  image_path: string | null;
  notes: string | null;
  is_archived: boolean;
  is_favorite: boolean;
  is_frequent: boolean;
  preferred_retailer_id: string | null;
  data_source: ProductDataSource;
  purchase_count: number;
  total_quantity: number;
  total_spent: number;
  avg_price: number | null;
  min_price: number | null;
  max_price: number | null;
  last_price: number | null;
  last_purchase_date: string | null;
  last_retailer_id: string | null;
}

export interface ProductWithBarcodes extends ProductRow {
  barcodes: string[];
}

export interface PurchaseRow {
  id: string;
  product_id: string;
  retailer_id: string | null;
  transaction_id: string | null;
  purchased_on: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_promo: boolean;
  purchased_by: string | null;
  created_at: string;
}

export interface PriceRow {
  product_id: string;
  retailer_id: string;
  price: number;
  currency: string;
  is_promo: boolean;
  observed_at: string;
}

export interface RetailerRow {
  id: string;
  slug: string;
  name: string;
}
