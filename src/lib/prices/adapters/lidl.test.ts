import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { lidlAdapter, parseLidlSheet, rowsToOffers } from "./lidl";
import { lidlCatalogName, mapLidlCategory, productDraftFromLidlOffer } from "./lidl-product";

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "fixtures/lidl-epel-sample.json");
const sampleSheet = JSON.parse(readFileSync(fixturePath, "utf8")) as unknown[][];

describe("Lidl adapter parsing", () => {
  it("parses sheet rows and drops non-positive prices", () => {
    const rows = parseLidlSheet([
      ["Denumire comerciala", "Gramaj", "Categorie", "Pret vanzare"],
      ["Pilos Lapte proaspat 1,5% ESL", "1l", "Lactate", "4.39"],
      ["Empty", "1l", "Lactate", "0"],
      ["", "1l", "Lactate", "3"],
    ]);
    expect(rows).toEqual([{ name: "Pilos Lapte proaspat 1,5% ESL", size: "1l", category: "Lactate", price: 4.39 }]);
    const offers = rowsToOffers(rows, "2026-11-07T12:00:00.000Z");
    expect(offers).toHaveLength(1);
    expect(offers[0].retailerSlug).toBe("lidl");
    expect(offers[0].price).toBe(4.39);
    expect(offers[0].adapter).toBe("lidl_xlsb");
  });

  it("detects columns from real EPEL header order and keeps per-kg sizes", () => {
    const rows = parseLidlSheet(sampleSheet);
    expect(rows.length).toBeGreaterThan(5);
    expect(rows[0]).toMatchObject({ name: "Baby banane", size: "per kg", category: "Legume si Fructe", price: 12.99 });
    const offers = rowsToOffers(rows, "2026-11-07T12:00:00.000Z");
    expect(offers.every((o) => o.price > 0)).toBe(true);
    expect(offers[0].unitRaw).toBe("per kg");
  });

  it("accepts comma decimals and strips PM_ prefix", () => {
    const rows = parseLidlSheet([
      ["Denumire comerciala", "Gramaj", "Categorie", "Pret vanzare"],
      ["PM_Pilos Iaurt", "400g", "Lactate", "2,49"],
    ]);
    expect(rows[0].price).toBe(2.49);
    const [offer] = rowsToOffers(rows, "2026-11-07T12:00:00.000Z");
    expect(offer.nameRaw.startsWith("Pilos")).toBe(true);
    expect(offer.externalRef).toContain("pilos iaurt");
  });

  it("surfaces HTTP and empty-parse failures instead of swallowing them", async () => {
    const httpFail = await lidlAdapter.fetchOffers(
      {},
      {
        fetchImpl: async () => new Response("nope", { status: 503, statusText: "Service Unavailable" }),
      },
    );
    expect(httpFail.ok).toBe(false);
    if (!httpFail.ok) expect(httpFail.error).toMatch(/HTTP 503/);

    const emptyFail = await lidlAdapter.fetchOffers(
      {},
      {
        fetchImpl: async () => new Response(new Uint8Array(8), { status: 200 }),
      },
    );
    expect(emptyFail.ok).toBe(false);
    if (!emptyFail.ok) expect(emptyFail.error).toMatch(/empty|truncated/i);
  });
});

describe("Lidl product drafts", () => {
  const base = rowsToOffers(
    [{ name: "Pilos Lapte", size: "1l", category: "Lactate", price: 4.39 }],
    "2026-11-07T12:00:00.000Z",
  )[0];

  it("maps categories and package size for catalogue import", () => {
    expect(mapLidlCategory("Lactate")).toBe("dairy");
    expect(mapLidlCategory("Legume si Fructe")).toBe("produce");
    expect(mapLidlCategory("Something exotic")).toBe("Something exotic");

    const draft = productDraftFromLidlOffer(base);
    expect(draft).toMatchObject({
      name: "Pilos Lapte",
      category: "dairy",
      packageSize: 1,
      packageUnit: "l",
      dataSource: "lidl_xlsb",
    });
    expect(lidlCatalogName(base)).toBe("Pilos Lapte");
  });

  it("treats per kg as unit kg without inventing a package size", () => {
    const offer = rowsToOffers(
      [{ name: "Banane", size: "per kg", category: "Legume si Fructe", price: 6.99 }],
      "2026-11-07T12:00:00.000Z",
    )[0];
    expect(productDraftFromLidlOffer(offer)).toMatchObject({
      name: "Banane",
      unit: "kg",
      packageSize: null,
      packageUnit: null,
      category: "produce",
    });
  });

  it("refuses drafts when price is not positive", () => {
    expect(productDraftFromLidlOffer({ ...base, price: 0 })).toBeNull();
  });
});
