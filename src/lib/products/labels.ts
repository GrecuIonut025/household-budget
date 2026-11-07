import type { Translate } from "@/lib/i18n";
import { PRODUCT_CATEGORIES } from "./types";

/** Localised category label; free-text categories (imported or legacy) are shown as stored. */
export function productCategoryLabel(t: Translate, category: string): string {
  return (PRODUCT_CATEGORIES as readonly string[]).includes(category)
    ? t(`products.cat.${category as (typeof PRODUCT_CATEGORIES)[number]}`)
    : category;
}
