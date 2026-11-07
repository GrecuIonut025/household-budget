/** True when Postgres rejected `data_source` (migration 20261108230000 not applied). */
export function isProductsDataSourceCheck(error: { message?: string; code?: string } | null): boolean {
  if (!error?.message) return false;
  return (
    error.message.includes("products_data_source_check") ||
    (error.code === "23514" && error.message.toLowerCase().includes("data_source"))
  );
}
