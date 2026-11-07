import { parseSize } from "../normalize";
import type { AdapterOffer } from "../types";
import type { PackageUnit, ProductCategory, ProductUnit } from "@/lib/products/types";

/** Maps Lidl EPEL category labels onto our catalogue keys; unknown labels stay free-text. */
const LIDL_CATEGORY_MAP: Record<string, ProductCategory> = {
  "legume si fructe": "produce",
  lactate: "dairy",
  branzeturi: "dairy",
  oua: "dairy",
  "carne si peste": "meat_fish",
  mezeluri: "meat_fish",
  proaspete: "meat_fish",
  "paine si patiserie": "bakery",
  bauturi: "beverages",
  cafea: "beverages",
  ceai: "beverages",
  congelate: "frozen",
  inghetata: "frozen",
  "dulciuri si snackuri": "snacks",
  cosmetice: "personal_care",
  "uz casnic": "household",
  detergenti: "household",
  "produse pentru curatenie": "household",
  "hartie igienica si servetele": "household",
  conserve: "pantry",
  cereale: "pantry",
  "paste fainoase": "pantry",
  "produse de baza": "pantry",
  "ulei, unt, margarina": "pantry",
  "mirodenii si condimente": "pantry",
  "ketchup, mustar, sosuri": "pantry",
  "ingrediente pentru copt": "pantry",
  "miere, dulceturi si alte creme": "pantry",
  "supe si baze pentru supe": "pantry",
};

export interface LidlProductDraft {
  name: string;
  brand: string | null;
  category: string | null;
  unit: ProductUnit;
  packageSize: number | null;
  packageUnit: PackageUnit | null;
  dataSource: "lidl_xlsb";
}

function collapse(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Catalogue display name: strip PM_ prefix and trailing gramaj when it was appended to nameRaw. */
export function lidlCatalogName(offer: AdapterOffer): string {
  let name = offer.nameRaw.replace(/^PM_/i, "").trim();
  const size = offer.unitRaw?.trim();
  if (size && name.toLowerCase().endsWith(size.toLowerCase())) {
    name = name.slice(0, name.length - size.length).trim();
  }
  return name.slice(0, 200);
}

export function mapLidlCategory(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const key = collapse(raw);
  return LIDL_CATEGORY_MAP[key] ?? raw.trim().slice(0, 60);
}

/**
 * Builds a product insert from a parsed Lidl offer.
 * Only call for unmatched rows with a real positive price — never invent amounts.
 */
export function productDraftFromLidlOffer(offer: AdapterOffer): LidlProductDraft | null {
  if (!(offer.price > 0)) return null;
  const name = lidlCatalogName(offer);
  if (!name) return null;

  const sizeText = offer.unitRaw?.trim() || null;
  const perKg = sizeText !== null && /^per\s*kg$/i.test(sizeText);
  const parsed = perKg ? null : parseSize(sizeText) ?? parseSize(offer.nameRaw);

  let unit: ProductUnit = "pcs";
  let packageSize: number | null = null;
  let packageUnit: PackageUnit | null = null;

  if (perKg) {
    unit = "kg";
  } else if (parsed) {
    if (parsed.unit === "g") {
      if (parsed.qty >= 1000 && parsed.qty % 1000 === 0) {
        packageSize = parsed.qty / 1000;
        packageUnit = "kg";
        unit = "pcs";
      } else {
        packageSize = parsed.qty;
        packageUnit = "g";
        unit = "pcs";
      }
    } else if (parsed.unit === "ml") {
      if (parsed.qty >= 1000 && parsed.qty % 1000 === 0) {
        packageSize = parsed.qty / 1000;
        packageUnit = "l";
        unit = "pcs";
      } else {
        packageSize = parsed.qty;
        packageUnit = "ml";
        unit = "pcs";
      }
    } else {
      packageSize = parsed.qty;
      packageUnit = "pcs";
      unit = "pcs";
    }
  }

  return {
    name,
    brand: offer.brandRaw?.trim() || null,
    category: mapLidlCategory(offer.categoryRaw),
    unit,
    packageSize,
    packageUnit,
    dataSource: "lidl_xlsb",
  };
}
