import { describe, expect, it } from "vitest";
import { parseCatalogProducts, parseStoreProductOffers } from "./monitor";

const catalogXml = `
<ArrayOfCatalogProduct>
  <CatalogProduct><Id>10475132780</Id><Name>lapte uht 1l</Name><Prodcateg></Prodcateg></CatalogProduct>
</ArrayOfCatalogProduct>`;

const storesXml = `
<ArrayOfStore>
  <Store>
    <Id>s1</Id><Name>Lidl Cluj</Name><Networkid>4055329000008</Networkid><Lastupdate>07.11.2026 13:59</Lastupdate>
    <Product>
      <Id>10475132780</Id><Name>PILOS LAPTE UHT 1.5% 1L</Name><Brand>Pilos</Brand>
      <Price>4.39</Price><Unit>1l</Unit><Promo></Promo><Pricedate>07.11.2026 04:00</Pricedate>
      <Networkid>4055329000008</Networkid><Retailcategname>Lapte UHT</Retailcategname>
    </Product>
    <Product>
      <Id>x</Id><Name>MISSING</Name><Brand></Brand><Price>0</Price><Networkid>4055329000008</Networkid>
    </Product>
  </Store>
</ArrayOfStore>`;

describe("Monitor XML parsing", () => {
  it("reads catalog products", () => {
    expect(parseCatalogProducts(catalogXml)).toEqual([
      { id: "10475132780", name: "lapte uht 1l", category: null },
    ]);
  });

  it("emits offers and drops price=0 sentinel", () => {
    const offers = parseStoreProductOffers(storesXml, new Date("2026-11-07T12:00:00Z"));
    expect(offers).toHaveLength(1);
    expect(offers[0].price).toBe(4.39);
    expect(offers[0].retailerSlug).toBe("lidl");
    expect(offers[0].gtin).toBeNull();
    expect(offers[0].externalRef).toBe("monitor:10475132780");
  });
});
