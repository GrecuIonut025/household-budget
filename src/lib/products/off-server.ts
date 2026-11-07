import "server-only";
import { fetchOpenFoodFacts, type OffLookup } from "./open-food-facts";
import { createRateLimiter, createTtlCache } from "./throttle";

const DAY_MS = 24 * 60 * 60 * 1000;
const found = createTtlCache<OffLookup>(DAY_MS);
// OFF allows 100 product reads per minute per IP; stay well under it and cap each member separately.
const perUser = createRateLimiter(15, 60_000);
const global = createRateLimiter(60, 60_000);

const USER_AGENT = process.env.OPEN_FOOD_FACTS_USER_AGENT || "HouseholdBudget/0.1 (self-hosted household budget app)";

/**
 * Server-side proxy for Open Food Facts: validates the barcode, throttles per member and globally, and caches
 * answers (24 h for hits, 1 h for misses) so the same code is not requested twice. Transient failures are not cached.
 */
export async function lookupOpenFoodFacts(userId: string, barcode: string, locale: "ro" | "en"): Promise<OffLookup> {
  const key = `${locale}:${barcode}`;
  const cached = found.get(key);
  if (cached) return cached;
  if (!perUser.take(userId) || !global.take("all")) return { status: "rate_limited" };

  const result = await fetchOpenFoodFacts(barcode, { userAgent: USER_AGENT, locale });
  if (result.status === "found") found.set(key, result);
  else if (result.status === "not_found") found.set(key, result, 60 * 60 * 1000);
  return result;
}
