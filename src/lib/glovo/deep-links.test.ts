import { describe, expect, it } from "vitest";
import {
  buildGlovoHandoffUrl,
  formatCartChecklist,
  GLOVO_ANDROID_PACKAGE,
  glovoAndroidIntentUrl,
  glovoProductSearchUrl,
  glovoProductUrl,
  glovoStoreUrl,
} from "./deep-links";

describe("glovo deep links (Brașov RO)", () => {
  it("builds store URLs under /stores/", () => {
    expect(glovoStoreUrl("profi-brv")).toBe(
      "https://glovoapp.com/ro/ro/brasov/stores/profi-brv",
    );
    expect(glovoStoreUrl("carrefour-supermarket-brv")).toContain(
      "/brasov/stores/carrefour-supermarket-brv",
    );
  });

  it("builds product PDP and search URLs", () => {
    expect(glovoProductUrl("profi-brv", "4611686018456840000")).toBe(
      "https://glovoapp.com/ro/ro/brasov/stores/profi-brv/products/4611686018456840000",
    );
    expect(glovoProductSearchUrl("mega-image-brv", "Lapte Zuzu")).toBe(
      "https://glovoapp.com/ro/ro/brasov/stores/mega-image-brv?search=Lapte%20Zuzu",
    );
  });

  it("builds Android intents with the real com.glovo package", () => {
    const https = glovoStoreUrl("kaufland-brv-bo");
    const intent = glovoAndroidIntentUrl(https);
    expect(GLOVO_ANDROID_PACKAGE).toBe("com.glovo");
    expect(intent).toContain(`package=${GLOVO_ANDROID_PACKAGE}`);
    expect(intent).toContain("ro/ro/brasov/stores/kaufland-brv-bo");
    expect(intent).toContain(encodeURIComponent(https));
  });

  it("hands off to store search for the first cart line", () => {
    const url = buildGlovoHandoffUrl([
      {
        id: "1",
        name: "Suc Coca Cola 2L",
        priceDisplay: "14,79 RON",
        imageUrl: null,
        qty: 2,
        retailer: "profi",
        storeSlug: "profi-brv",
        glovoProductId: "4611686018456822000",
      },
    ]);
    expect(url).toBe(
      "https://glovoapp.com/ro/ro/brasov/stores/profi-brv?search=Suc%20Coca%20Cola%202L",
    );
  });

  it("formats a checklist with store + search links", () => {
    const text = formatCartChecklist([
      {
        id: "1",
        name: "Lapte",
        priceDisplay: "6,49 lei",
        imageUrl: null,
        qty: 2,
        retailer: "profi",
        storeSlug: "profi-brv",
        glovoProductId: "123",
      },
      {
        id: "2",
        name: "Pâine",
        priceDisplay: null,
        imageUrl: null,
        qty: 1,
        retailer: "profi",
        storeSlug: "profi-brv",
        glovoProductId: null,
      },
    ]);
    expect(text).toContain("2× Lapte (6,49 lei)");
    expect(text).toContain("/stores/profi-brv?search=Lapte");
    expect(text).toContain("1× Pâine");
    expect(text).toContain("search=P%C3%A2ine");
  });
});
