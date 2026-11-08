import { describe, expect, it } from "vitest";
import { browseLocalProducts, listParentCategories, listSubcategories } from "./browse";
import type { GlovoProduct } from "./types";

const products: GlovoProduct[] = [
  {
    id: "1",
    market_id: "m",
    retailer_key: "profi",
    identity_key: "a",
    glovo_product_id: null,
    glovo_store_id: null,
    glovo_address_id: null,
    store_product_id: null,
    external_id: null,
    name: "Lapte Zuzu 1L",
    description: null,
    price: 7.5,
    currency: "RON",
    price_display: "7,50 lei",
    image_url: "https://example.com/lapte.jpg",
    image_id: null,
    category: "Lapte",
    category_slug: "lapte-c.1",
    parent_category: "Lactate",
    parent_category_slug: "lactate-sc.1",
    eans: [],
    out_of_stock: false,
    observed_at: new Date().toISOString(),
  },
  {
    id: "2",
    market_id: "m",
    retailer_key: "profi",
    identity_key: "b",
    glovo_product_id: null,
    glovo_store_id: null,
    glovo_address_id: null,
    store_product_id: null,
    external_id: null,
    name: "Pâine albă",
    description: null,
    price: 4,
    currency: "RON",
    price_display: null,
    image_url: null,
    image_id: null,
    category: "Pâine",
    category_slug: "paine-c.2",
    parent_category: "Brutarie",
    parent_category_slug: "brutarie-sc.2",
    eans: [],
    out_of_stock: false,
    observed_at: new Date().toISOString(),
  },
];

const categories = [
  {
    retailer: "profi" as const,
    title: "Lapte",
    slug: "lapte-c.1",
    path: "/x?link=lactate-sc.1/lapte-c.1",
    parent_slug: "lactate-sc.1",
    parent_title: "Lactate",
  },
];

describe("glovo browse helpers", () => {
  it("lists parents and filters products client-side", () => {
    const parents = listParentCategories("profi", products, categories);
    const parent = parents.find((p) => p.slug === "lactate-sc.1");
    expect(parent).toBeTruthy();
    expect(parent?.image_url).toBe("https://example.com/lapte.jpg");
    const subs = listSubcategories("profi", "lactate-sc.1", products, categories);
    expect(subs.map((s) => s.slug)).toContain("lapte-c.1");
    expect(subs.find((s) => s.slug === "lapte-c.1")?.image_url).toBe(
      "https://example.com/lapte.jpg",
    );
    const page = browseLocalProducts(products, {
      retailer: "profi",
      query: "zuzu",
      page: 1,
      pageSize: 24,
    });
    expect(page.total).toBe(1);
    expect(page.items[0]?.name).toContain("Zuzu");
  });

  it("hides parents and subcategories with zero products (HGI-34)", () => {
    const emptyCats = [
      ...categories,
      {
        retailer: "profi" as const,
        title: "Empty Shelf",
        slug: "empty-c.9",
        path: "/x?link=ghost-sc.9/empty-c.9",
        parent_slug: "ghost-sc.9",
        parent_title: "Ghost",
      },
    ];
    const parents = listParentCategories("profi", products, emptyCats);
    expect(parents.every((p) => p.product_count > 0)).toBe(true);
    expect(parents.map((p) => p.slug)).not.toContain("ghost-sc.9");
    const emptySubs = listSubcategories("profi", "ghost-sc.9", products, emptyCats);
    expect(emptySubs).toEqual([]);
  });
});
