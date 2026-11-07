import type { AdapterOffer } from "../types";

export interface AdapterContext {
  fetchImpl?: typeof fetch;
  userAgent?: string;
  /** Optional override for tests / pinned snapshots. */
  now?: Date;
}

export interface PriceAdapter {
  id: "monitor" | "lidl_xlsb" | "open_food_facts";
  /** Human label for UI / logs. */
  label: string;
  /**
   * Pull offers. Implementations must drop zero/missing prices and never invent amounts.
   * Network failures should throw or return `{ ok: false, error }` — callers decide.
   */
  fetchOffers(input: AdapterFetchInput, ctx?: AdapterContext): Promise<AdapterResult>;
}

export interface AdapterFetchInput {
  /** Free-text product names to look up (Monitor). */
  queryNames?: string[];
  /** Optional UAT id for Monitor (e.g. Cluj-Napoca = 54975). */
  uatId?: number;
  /** Lat/lon buffer search alternative to UAT. */
  lat?: number;
  lon?: number;
  bufferKm?: number;
  /** Restrict Monitor to these network ids. */
  networkIds?: string[];
  /** Optional GTIN list for OFF metadata enrichment (no prices). */
  gtins?: string[];
}

export type AdapterResult =
  | { ok: true; offers: AdapterOffer[]; warnings: string[] }
  | { ok: false; error: string; offers: AdapterOffer[]; warnings: string[] };

export const DEFAULT_USER_AGENT = "HouseholdBudget/0.1 (price-adapters; local-dev)";
