#!/usr/bin/env node
/**
 * Import Glovo Brașov crawler JSON into Supabase (glovo_markets / glovo_products).
 *
 * Reads (first found):
 *   1. glovo_data/all_products.json  (live crawl output)
 *   2. fixtures/glovo/all_products.json  (sample / offline)
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (or SUPABASE_SECRET_KEY)
 *
 * Usage:
 *   node scripts/glovo/import.mjs
 *   node scripts/glovo/import.mjs --file path/to/all_products.json
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RETAILERS = new Set(["profi", "carrefour", "kaufland", "mega_image"]);
const BATCH = 200;

function log(msg) {
  console.log(`[glovo:import] ${msg}`);
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(resolve(ROOT, ".env.local"));
loadEnvFile(resolve(ROOT, ".env"));

function identityKey(product) {
  return String(
    product.store_product_id ||
      product.external_id ||
      product.product_id ||
      product.name ||
      "",
  ).trim();
}

function parseArgs(argv) {
  const out = { file: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--file" && argv[i + 1]) {
      out.file = argv[++i];
    } else if (argv[i] === "--dry-run") {
      out.dryRun = true;
    }
  }
  return out;
}

function resolveProductsPath(explicit) {
  if (explicit) return resolve(ROOT, explicit);
  const candidates = [
    resolve(ROOT, "glovo_data/all_products.json"),
    resolve(ROOT, "fixtures/glovo/all_products.json"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

function normalizeProduct(raw) {
  const retailer = String(raw.retailer || "").trim();
  if (!RETAILERS.has(retailer)) return null;
  const identity = identityKey(raw);
  if (!identity || !raw.name) return null;

  let eans = [];
  if (Array.isArray(raw.eans)) eans = raw.eans.map(String).filter(Boolean);
  else if (typeof raw.eans === "string" && raw.eans.trim()) {
    try {
      const parsed = JSON.parse(raw.eans);
      eans = Array.isArray(parsed) ? parsed.map(String) : [raw.eans];
    } catch {
      eans = raw.eans.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }

  const price =
    raw.price == null || raw.price === ""
      ? null
      : Number.parseFloat(String(raw.price).replace(",", "."));

  return {
    retailer_key: retailer,
    identity_key: identity,
    glovo_product_id: raw.product_id != null ? String(raw.product_id) : null,
    external_id: raw.external_id != null ? String(raw.external_id) : null,
    store_product_id:
      raw.store_product_id != null ? String(raw.store_product_id) : null,
    name: String(raw.name).trim(),
    description: raw.description ? String(raw.description) : null,
    price: Number.isFinite(price) ? price : null,
    currency: String(raw.currency || "RON"),
    price_display: raw.price_display ? String(raw.price_display) : null,
    image_url: raw.image_url ? String(raw.image_url) : null,
    image_id: raw.image_id != null ? String(raw.image_id) : null,
    category: raw.category ? String(raw.category) : null,
    eans,
    out_of_stock: Boolean(raw.out_of_stock),
    is_weighted:
      raw.is_weighted == null ? null : Boolean(raw.is_weighted),
    sale_type: raw.sale_type ? String(raw.sale_type) : null,
    observed_at: new Date().toISOString(),
    raw,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const path = resolveProductsPath(args.file);
  if (!path) {
    console.error(
      "[glovo:import] No products file found. Run the crawler or use fixtures/glovo/all_products.json",
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.error(
      "[glovo:import] Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).",
    );
    process.exit(1);
  }

  log(`Reading ${path}`);
  const payload = JSON.parse(readFileSync(path, "utf8"));
  const rows = (Array.isArray(payload) ? payload : [])
    .map(normalizeProduct)
    .filter(Boolean);

  log(`${rows.length} products after normalize`);
  if (args.dryRun) {
    log("Dry run — skipping DB write");
    return;
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: markets, error: marketsError } = await supabase
    .from("glovo_markets")
    .select("id, retailer_key");
  if (marketsError) {
    console.error("[glovo:import] Failed to load markets:", marketsError.message);
    process.exit(1);
  }
  const marketByKey = new Map((markets ?? []).map((m) => [m.retailer_key, m.id]));
  for (const keyName of RETAILERS) {
    if (!marketByKey.has(keyName)) {
      console.error(
        `[glovo:import] Missing glovo_markets row for ${keyName}. Apply migration 20261110000000_glovo_brasov_catalog.sql`,
      );
      process.exit(1);
    }
  }

  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH).map((row) => ({
      market_id: marketByKey.get(row.retailer_key),
      retailer_key: row.retailer_key,
      identity_key: row.identity_key,
      glovo_product_id: row.glovo_product_id,
      external_id: row.external_id,
      store_product_id: row.store_product_id,
      name: row.name,
      description: row.description,
      price: row.price,
      currency: row.currency,
      price_display: row.price_display,
      image_url: row.image_url,
      image_id: row.image_id,
      category: row.category,
      eans: row.eans,
      out_of_stock: row.out_of_stock,
      is_weighted: row.is_weighted,
      sale_type: row.sale_type,
      observed_at: row.observed_at,
      raw: row.raw,
    }));

    const { error } = await supabase.from("glovo_products").upsert(chunk, {
      onConflict: "retailer_key,identity_key",
    });
    if (error) {
      console.error("[glovo:import] Upsert failed:", error.message);
      process.exit(1);
    }
    upserted += chunk.length;
    log(`Upserted ${upserted}/${rows.length}`);
  }

  const now = new Date().toISOString();
  const touched = [...new Set(rows.map((r) => r.retailer_key))];
  for (const retailer of touched) {
    await supabase
      .from("glovo_markets")
      .update({ last_synced_at: now })
      .eq("retailer_key", retailer);
  }

  log(`Done. ${upserted} products across ${touched.length} markets.`);
}

main().catch((err) => {
  console.error("[glovo:import]", err);
  process.exit(1);
});
