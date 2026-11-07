import type { NormalisedName, ParsedSize, SizeUnit } from "./types";

const PRIVATE_LABELS: Record<string, string> = {
  pilos: "lidl",
  milbona: "lidl",
  "k classic": "kaufland",
  "k-classic": "kaufland",
  "klc": "kaufland",
  "crf classic": "carrefour",
  "crf": "carrefour",
  auchan: "auchan",
  boni: "auchan",
  "marketing plus": "penny",
  "m-budget": "mega-image",
};

const ABBREVIATIONS: Record<string, string> = {
  crf: "carrefour",
  klc: "k classic",
  uht: "uht",
  gr: "grasime",
  gras: "grasime",
  pl: "private label",
  expr: "express",
};

const NOISE = /^(pm_|nos\*|oug\s+|sc\s+)/i;
const SIZE_RE =
  /(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|cl|dl|buc|bucata|bucăți|pcs|x)\b|(?:(\d+)\s*[x×]\s*)(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|cl|dl)\b/gi;

function collapse(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(NOISE, "")
    .replace(/[^a-z0-9%.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toBase(qty: number, unit: string): ParsedSize | null {
  const u = unit.toLowerCase();
  if (u === "kg") return { qty: qty * 1000, unit: "g", multipack: 1 };
  if (u === "g") return { qty, unit: "g", multipack: 1 };
  if (u === "l") return { qty: qty * 1000, unit: "ml", multipack: 1 };
  if (u === "dl") return { qty: qty * 100, unit: "ml", multipack: 1 };
  if (u === "cl") return { qty: qty * 10, unit: "ml", multipack: 1 };
  if (u === "ml") return { qty, unit: "ml", multipack: 1 };
  if (u === "buc" || u === "bucata" || u === "bucăți" || u === "pcs" || u === "x") {
    return { qty, unit: "pcs", multipack: 1 };
  }
  return null;
}

/** Extracts size from free text such as "1,5l", "4buc", "3x330g". Returns null when ambiguous. */
export function parseSize(raw: string | null | undefined): ParsedSize | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;

  const multi = /(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|cl|dl)\b/i.exec(text);
  if (multi) {
    const count = Number(multi[1]);
    const each = Number(multi[2].replace(",", "."));
    const base = toBase(each, multi[3]);
    if (!base || !Number.isFinite(count) || count <= 0) return null;
    return { qty: Number((base.qty * count).toFixed(3)), unit: base.unit, multipack: count };
  }

  SIZE_RE.lastIndex = 0;
  const m = SIZE_RE.exec(text);
  if (!m) return null;
  const qty = Number((m[1] ?? m[4] ?? "").replace(",", "."));
  const unit = m[2] ?? m[5] ?? "";
  if (!Number.isFinite(qty) || qty <= 0) return null;
  return toBase(qty, unit);
}

export function expandAbbreviations(token: string): string {
  return ABBREVIATIONS[token] ?? token;
}

export function detectPrivateLabel(brandNorm: string | null, nameNorm: string): {
  isPrivateLabel: boolean;
  family: string | null;
} {
  const hay = `${brandNorm ?? ""} ${nameNorm}`;
  for (const [label, family] of Object.entries(PRIVATE_LABELS)) {
    if (hay.includes(label)) return { isPrivateLabel: true, family };
  }
  return { isPrivateLabel: false, family: null };
}

/** Shared normalisation used at ingest and when scoring name matches. */
export function normaliseProductText(nameRaw: string, brandRaw: string | null = null): NormalisedName {
  const nameCollapsed = collapse(nameRaw);
  const brandCollapsed = brandRaw ? collapse(brandRaw) : null;
  const size = parseSize(nameRaw) ?? (brandRaw ? parseSize(brandRaw) : null);
  const tokens = nameCollapsed
    .split(" ")
    .map(expandAbbreviations)
    .filter((t) => t.length > 1 && !/^\d+([.,]\d+)?(g|ml|l|kg|pcs|buc)?$/.test(t));
  const brandNorm = brandCollapsed || null;
  const pl = detectPrivateLabel(brandNorm, nameCollapsed);
  return {
    nameNorm: nameCollapsed,
    brandNorm,
    size,
    tokens,
    isPrivateLabel: pl.isPrivateLabel,
    privateLabelFamily: pl.family,
  };
}

export function sizeCompatible(
  a: ParsedSize | null,
  bQty: number | null,
  bUnit: string | null,
): number {
  if (!a || bQty === null || !bUnit) return 0.5; // unknown size: neutral, not a veto
  const mapped: Record<string, SizeUnit | null> = {
    g: "g",
    kg: "g",
    ml: "ml",
    l: "ml",
    pcs: "pcs",
    pack: "pcs",
  };
  let qty = bQty;
  const unit = mapped[bUnit];
  if (bUnit === "kg") qty = bQty * 1000;
  if (bUnit === "l") qty = bQty * 1000;
  if (!unit) return 0;
  if (unit !== a.unit) return 0;
  const ratio = Math.min(a.qty, qty) / Math.max(a.qty, qty);
  if (ratio >= 0.99) return 1;
  if (ratio >= 0.9) return 0.7;
  return 0;
}

export function jaccardTokens(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Lightweight trigram-ish similarity for short Romanian grocery names (no DB dependency). */
export function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const grams = (s: string) => {
    const padded = `  ${s} `;
    const out = new Set<string>();
    for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
    return out;
  };
  const ga = grams(a);
  const gb = grams(b);
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter += 1;
  return inter / (ga.size + gb.size - inter);
}
