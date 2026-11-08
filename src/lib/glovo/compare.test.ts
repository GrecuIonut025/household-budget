import { describe, expect, it } from "vitest";
import { buildGlovoComparison, filterGlovoGroups } from "./compare";
import type { GlovoMarket, GlovoProduct } from "./types";

const markets: GlovoMarket[] = [
  {
    id: "1",
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
    id: "2",
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
];

function product(
  partial: Partial<GlovoProduct> & Pick<GlovoProduct, "id" | "retailer_key" | "name" | "price">,
): GlovoProduct {
  return {
    market_id: "m",
    identity_key: partial.id,
    glovo_product_id: null,
    glovo_store_id: null,
    glovo_address_id: null,
    store_product_id: null,
    external_id: null,
    description: null,
    currency: "RON",
    price_display: null,
    image_url: null,
    image_id: null,
    category: "Lactate",
    category_slug: null,
    parent_category: null,
    parent_category_slug: null,
    eans: [],
    out_of_stock: false,
    observed_at: new Date().toISOString(),
    ...partial,
  };
}

describe("buildGlovoComparison", () => {
  it("groups by EAN and marks the cheapest market", () => {
    const groups = buildGlovoComparison(
      [
        product({
          id: "a",
          retailer_key: "profi",
          name: "Lapte Zuzu 1L",
          price: 6.49,
          eans: ["5941001500123"],
        }),
        product({
          id: "b",
          retailer_key: "kaufland",
          name: "Lapte Zuzu 1.5% 1L",
          price: 6.29,
          eans: ["5941001500123"],
        }),
      ],
      markets,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.cheapestRetailerKey).toBe("kaufland");
    expect(groups[0]!.spread).toBeCloseTo(0.2);
  });

  it("groups by normalized name when EAN is missing", () => {
    const groups = buildGlovoComparison(
      [
        product({ id: "a", retailer_key: "profi", name: "Pâine albă 500g", price: 4.29 }),
        product({ id: "b", retailer_key: "kaufland", name: "Paine alba 500g", price: 3.99 }),
      ],
      markets,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.cheapestRetailerKey).toBe("kaufland");
  });
});

describe("filterGlovoGroups", () => {
  it("filters by query and retailer", () => {
    const groups = buildGlovoComparison(
      [
        product({
          id: "a",
          retailer_key: "profi",
          name: "Lapte Zuzu 1L",
          price: 6.49,
          eans: ["5941001500123"],
        }),
        product({ id: "b", retailer_key: "kaufland", name: "Banane vrac", price: 6.49 }),
      ],
      markets,
    );
    expect(filterGlovoGroups(groups, "lapte")).toHaveLength(1);
    expect(filterGlovoGroups(groups, "", "kaufland").every((g) =>
      g.quotes.some((q) => q.retailerKey === "kaufland"),
    )).toBe(true);
  });
});
