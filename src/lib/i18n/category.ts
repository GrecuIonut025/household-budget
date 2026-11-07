import { en, type MessageKey } from "./en";
import type { Translate } from "./index";

/** Built-in categories are localised by system_key; user-created ones keep their own name. */
export function categoryLabel(t: Translate, category: { name: string; system_key: string | null }): string {
  if (!category.system_key) return category.name;
  const key = `category.${category.system_key}`;
  return key in en ? t(key as MessageKey) : category.name;
}
