/** Shared types for supermarket price adapters, matching and comparison. */

export type AdapterId = "monitor" | "lidl_xlsb" | "open_food_facts" | "manual";

export type MatchMethod = "barcode" | "name" | "manual" | "adapter_ref";

export type SizeUnit = "g" | "ml" | "pcs";

/** A normalised offer from a price source. Never invent a price — only real observations. */
export interface AdapterOffer {
  adapter: AdapterId;
  retailerSlug: string;
  /** Stable id inside the source (Monitor Catprod.Id, Lidl name|size, OFF code, …). */
  externalRef: string;
  nameRaw: string;
  brandRaw: string | null;
  unitRaw: string | null;
  categoryRaw: string | null;
  /** Positive RON incl. VAT. Zero / missing prices are dropped before this shape is built. */
  price: number;
  currency: "RON";
  isPromo: boolean;
  loyaltyRequired: boolean;
  gtin: string | null;
  observedAt: string;
  sourceUrl: string | null;
  storeExternalId: string | null;
  storeName: string | null;
}

export interface ParsedSize {
  qty: number;
  unit: SizeUnit;
  multipack: number;
}

export interface NormalisedName {
  nameNorm: string;
  brandNorm: string | null;
  size: ParsedSize | null;
  tokens: string[];
  isPrivateLabel: boolean;
  privateLabelFamily: string | null;
}

export interface MatchCandidate {
  productId: string;
  name: string;
  brand: string | null;
  barcodes: string[];
  packageSize: number | null;
  packageUnit: string | null;
  category: string | null;
  preferredRetailerSlug: string | null;
}

export interface MatchScoreParts {
  nameSim: number;
  brandMatch: number;
  sizeMatch: number;
  categoryMatch: number;
}

export interface MatchDecision {
  productId: string | null;
  method: MatchMethod;
  confidence: number;
  needsReview: boolean;
  reason: string;
  parts: MatchScoreParts | null;
}

export interface ComparisonQuote {
  productId: string;
  retailerId: string;
  retailerSlug: string;
  retailerName: string;
  price: number;
  currency: string;
  unitPrice: number | null;
  unitLabel: string | null;
  isPromo: boolean;
  loyaltyRequired: boolean;
  source: "adapter" | "manual";
  matchMethod: MatchMethod | null;
  matchConfidence: number | null;
  needsReview: boolean;
  isVerified: boolean;
  observedAt: string;
  externalRef: string | null;
}

export interface ComparisonRow {
  productId: string;
  productName: string;
  brand: string | null;
  cheapest: ComparisonQuote | null;
  quotes: ComparisonQuote[];
  spread: number | null;
}

export interface HistoryPoint {
  observedAt: string;
  price: number;
  retailerId: string;
  isPromo: boolean;
  source: "adapter" | "manual";
}

export interface PriceAlertInput {
  productId: string;
  retailerId: string | null;
  direction: "below" | "above";
  targetPrice: number;
}

export interface PriceAlertRow extends PriceAlertInput {
  id: string;
  isActive: boolean;
  lastTriggeredAt: string | null;
  lastTriggeredPrice: number | null;
}

export const AUTO_LINK_THRESHOLD = 0.75;
export const REVIEW_THRESHOLD = 0.6;
export const GTIN_CONFIDENCE = 0.99;
export const ADAPTER_REF_CONFIDENCE = 0.98;
