import { lidlAdapter } from "./lidl";
import { monitorAdapter } from "./monitor";
import { openFoodFactsAdapter } from "./open-food-facts";
import type { PriceAdapter } from "./types";

export const priceAdapters: PriceAdapter[] = [monitorAdapter, lidlAdapter, openFoodFactsAdapter];

export function getAdapter(id: string): PriceAdapter | undefined {
  return priceAdapters.find((a) => a.id === id);
}

export { lidlAdapter, monitorAdapter, openFoodFactsAdapter };
export type { AdapterContext, AdapterFetchInput, AdapterResult, PriceAdapter } from "./types";
export { MONITOR_NETWORK_IDS } from "./monitor";
export { LIDL_PRICE_FILE_URL, parseLidlSheet, rowsToOffers } from "./lidl";
