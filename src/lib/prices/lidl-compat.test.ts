import { describe, expect, it } from "vitest";
import { isProductsDataSourceCheck } from "./lidl-compat";

describe("isProductsDataSourceCheck", () => {
  it("detects the Lidl import constraint failure", () => {
    expect(
      isProductsDataSourceCheck({
        code: "23514",
        message:
          'new row for relation "products" violates check constraint "products_data_source_check"',
      }),
    ).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isProductsDataSourceCheck(null)).toBe(false);
    expect(
      isProductsDataSourceCheck({
        code: "23505",
        message: 'duplicate key value violates unique constraint "products_household_name"',
      }),
    ).toBe(false);
  });
});
