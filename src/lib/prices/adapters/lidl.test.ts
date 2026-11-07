import { describe, expect, it } from "vitest";
import { parseLidlSheet, rowsToOffers } from "./lidl";

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
});
