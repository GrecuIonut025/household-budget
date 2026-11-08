#!/usr/bin/env node
/**
 * Glovo Brașov supermarket catalog crawler (pure Node — Windows/macOS/Linux).
 * Same API flow as scripts/glovo/crawl-brasov.sh / the user's tested test.sh.
 *
 * Session headers are baked in; override via env/.env.local only when expired.
 * Output: glovo_data/all_products.json (Comparare prețuri reads this).
 */
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { loadGlovoEnv, REPO_ROOT } from "./load-env.mjs";

loadGlovoEnv(REPO_ROOT);

const ROOT = REPO_ROOT;
const BASE_URL = process.env.GLOVO_BASE_URL || "https://api.glovoapp.com";
const CITY_CODE = process.env.GLOVO_CITY_CODE || "brv";
const COUNTRY_CODE = process.env.GLOVO_COUNTRY_CODE || "ro";
const CATEGORY_ID = process.env.GLOVO_CATEGORY_ID || "4";
const OUTPUT_DIR = resolve(ROOT, process.env.GLOVO_OUTPUT_DIR || "glovo_data");
const RAW_DIR = join(OUTPUT_DIR, "raw");

const REQUEST_DELAY = Number(process.env.GLOVO_REQUEST_DELAY || 3);
const MAX_RETRIES = 2;
const BACKOFF_BASE = 10;
const BACKOFF_MAX = 60;
const MAX_CATEGORIES_PER_STORE = 2000;

const TARGET_STORES = {
  profi: "profi-brv",
  carrefour: "carrefour-supermarket-brv",
  kaufland: "kaufland-brv-bo",
  mega_image: "mega-image-brv",
};

const USER_AGENT =
  process.env.GLOVO_USER_AGENT ||
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const DEVICE_URN =
  process.env.GLOVO_DEVICE_URN || "glv:device:532b00e8-cabe-4f75-9e60-a3a308d051b7";
const DYNAMIC_SESSION_ID =
  process.env.GLOVO_DYNAMIC_SESSION_ID || "27033905-1c94-43f3-9fe1-94f9d7aeea1d";
const PERSEUS_CLIENT_ID =
  process.env.GLOVO_PERSEUS_CLIENT_ID || "6381b7ca-82c2-4a38-b6b4-cd0ebc007dd8";
const PERSEUS_SESSION_TIMESTAMP =
  process.env.GLOVO_PERSEUS_SESSION_TIMESTAMP || "1794101426023";
const DELIVERY_LOCATION_TIMESTAMP =
  process.env.GLOVO_DELIVERY_LOCATION_TIMESTAMP || "1794101431447";
const COOKIE = process.env.GLOVO_COOKIE || process.env.COOKIE || "";

const CSV_FIELDS = [
  "retailer",
  "store_id",
  "address_id",
  "product_id",
  "external_id",
  "store_product_id",
  "name",
  "description",
  "price",
  "currency",
  "price_display",
  "image_url",
  "image_id",
  "category",
  "out_of_stock",
  "restricted",
  "sale_type",
  "is_weighted",
  "increment",
  "dietary_labels",
  "tags",
  "labels",
  "indicators",
  "promotions",
  "attribute_groups",
  "eans",
  "source_type",
];

let lastRequestAt = 0;

class RateLimitError extends Error {}
class AccessDeniedError extends Error {}

function log(message) {
  console.log(message);
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function saveJson(path, data) {
  ensureDir(dirname(path));
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, JSON.stringify(data, null, 2), "utf8");
  renameSync(temporary, path);
}

function loadJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function safeFilename(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
}

function buildHeaders() {
  const headers = {
    accept: "application/json, text/plain, */*",
    "accept-language": "ro",
    "cache-control": "no-cache",
    "content-type": "application/json",
    "glovo-api-version": "14",
    "glovo-app-context": "web",
    "glovo-app-development-state": "prod",
    "glovo-app-platform": "web",
    "glovo-app-type": "customer",
    "glovo-app-version": "v1.2927.0",
    "glovo-client-info":
      "web-customer-web-react/v1.2927.0 project:customer-web",
    "glovo-delivery-location-accuracy": "0",
    "glovo-delivery-location-timestamp": DELIVERY_LOCATION_TIMESTAMP,
    "glovo-device-urn": DEVICE_URN,
    "glovo-dynamic-session-id": DYNAMIC_SESSION_ID,
    "glovo-language-code": "ro",
    "glovo-location-city-code": CITY_CODE,
    "glovo-location-country-code": COUNTRY_CODE,
    "glovo-perseus-client-id": PERSEUS_CLIENT_ID,
    "glovo-perseus-consent": "essential_functional_marketing",
    "glovo-perseus-session-id": DYNAMIC_SESSION_ID,
    "glovo-perseus-session-timestamp": PERSEUS_SESSION_TIMESTAMP,
    "glovo-request-ttl": "7500",
    "glovo-request-id": randomUUID(),
    origin: "https://glovoapp.com",
    pragma: "no-cache",
    referer: "https://glovoapp.com/",
    "user-agent": USER_AGENT,
  };
  if (COOKIE) headers.cookie = COOKIE;
  return headers;
}

async function waitBetweenRequests() {
  const elapsed = (Date.now() - lastRequestAt) / 1000;
  const remaining = REQUEST_DELAY - elapsed;
  if (remaining > 0) {
    log(`[WAIT] ${remaining.toFixed(1)}s`);
    await sleep(remaining * 1000);
  }
}

async function requestJson(url, method = "GET", payload = null) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    await waitBetweenRequests();
    lastRequestAt = Date.now();
    const headers = buildHeaders();
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: payload == null ? undefined : JSON.stringify(payload),
        signal: AbortSignal.timeout(60_000),
      });
      const status = response.status;
      if (status === 200) {
        try {
          const data = await response.json();
          log("[HTTP 200]");
          return data;
        } catch (err) {
          log(`[INVALID JSON] ${err.message}`);
          return null;
        }
      }
      log(`[HTTP ${status}] ${url}`);
      if (status === 429) {
        const retryAfter = response.headers.get("retry-after");
        log("[STOP] Rate limit reached.");
        if (retryAfter) log(`[RETRY-AFTER] ${retryAfter}`);
        throw new RateLimitError("HTTP 429 - execution stopped");
      }
      if (status === 401 || status === 403) {
        throw new AccessDeniedError(`HTTP ${status} - access denied`);
      }
      if ([0, 500, 502, 503, 504].includes(status) && attempt < MAX_RETRIES) {
        const wait = Math.min(BACKOFF_BASE * 2 ** (attempt - 1), BACKOFF_MAX);
        log(`[BACKOFF] ${wait}s`);
        await sleep(wait * 1000);
        continue;
      }
      return null;
    } catch (err) {
      if (err instanceof RateLimitError || err instanceof AccessDeniedError) throw err;
      log(`[FETCH ERROR] ${err.message}`);
      if (attempt < MAX_RETRIES) {
        const wait = Math.min(BACKOFF_BASE * 2 ** (attempt - 1), BACKOFF_MAX);
        log(`[BACKOFF] ${wait}s`);
        await sleep(wait * 1000);
        continue;
      }
      return null;
    }
  }
  return null;
}

function* walk(obj) {
  if (obj && typeof obj === "object") {
    if (Array.isArray(obj)) {
      for (const item of obj) yield* walk(item);
    } else {
      yield obj;
      for (const value of Object.values(obj)) yield* walk(value);
    }
  }
}

function getStoreEntries(data) {
  return data?.data?.stores?.entries ?? [];
}

async function fetchStoreWall() {
  const cache = join(RAW_DIR, "store_wall.json");
  if (existsSync(cache)) {
    log("[CACHE] Store Wall");
    return loadJson(cache);
  }
  const url = `${BASE_URL}/v1/web/store_wall/category/${CATEGORY_ID}?moduleId=StoreFeeds&offset=0&limit=50&handlingType=DELIVERY`;
  const payload = {
    filters: [{ filterId: "ADMIN_FILTERS", filterAttributeIds: ["35369"] }],
    previousStoreIds: [],
  };
  const data = await requestJson(url, "POST", payload);
  if (data == null) throw new Error("Cannot retrieve Store Wall");
  saveJson(cache, data);
  return data;
}

function discoverStores(storeWall) {
  const stores = {};
  for (const entry of getStoreEntries(storeWall)) {
    const slug = entry?.slug;
    for (const [retailer, expectedSlug] of Object.entries(TARGET_STORES)) {
      if (slug !== expectedSlug) continue;
      const metadata = entry.metadata || {};
      const storeId = entry.id;
      const addressId = metadata.storeAddressId;
      if (storeId == null || addressId == null) continue;
      stores[retailer] = {
        retailer,
        name: entry.title,
        slug,
        store_id: String(storeId),
        address_id: String(addressId),
        rating: entry.ratings?.score ?? null,
        eta: entry.eta ?? null,
        availability: entry.availability?.status ?? null,
        has_in_store_prices: entry.inStorePrices?.hasInStorePrices ?? null,
      };
      log(`[STORE] ${retailer}: ${storeId}/${addressId}`);
    }
  }
  saveJson(join(OUTPUT_DIR, "glovo_stores.json"), stores);
  return stores;
}

function extractEans(node) {
  const values = new Set();
  for (const obj of walk(node)) {
    const eans = obj.eans;
    if (typeof eans === "string") {
      for (const value of eans.split(",")) {
        const trimmed = value.trim();
        if (trimmed) values.add(trimmed);
      }
    } else if (Array.isArray(eans)) {
      for (const value of eans) if (value) values.add(String(value));
    }
  }
  return [...values].sort();
}

function extractProduct(node, retailer, categoryMeta, store) {
  const productType = node.type;
  if (productType !== "PRODUCT_TILE" && productType !== "RESTRICTED_PRODUCT_TILE") {
    return null;
  }
  const data = node.data;
  if (!data || typeof data !== "object") return null;
  const name = data.name;
  if (!name) return null;

  const productId = data.id;
  const externalId = data.externalId;
  const storeProductId = data.storeProductId;
  const identity = storeProductId || externalId || productId || name;
  const key = `${retailer}:${identity}`;
  const priceInfo = data.priceInfo || {};
  const tracking = data.tracking || {};
  const categoryTitle =
    typeof categoryMeta === "string" ? categoryMeta : categoryMeta?.title || "HOME";

  return [
    key,
    {
      retailer,
      store_id: store.store_id,
      address_id: store.address_id,
      product_id: productId != null ? String(productId) : null,
      external_id: externalId ?? null,
      store_product_id: storeProductId ?? null,
      name,
      description: data.description ?? null,
      price: data.price ?? null,
      currency: priceInfo.currencyCode ?? null,
      price_display: priceInfo.displayText ?? null,
      image_url: data.imageUrl ?? null,
      image_id: data.imageId ?? null,
      category: categoryTitle,
      category_slug: typeof categoryMeta === "object" ? categoryMeta?.slug ?? null : null,
      parent_category: typeof categoryMeta === "object" ? categoryMeta?.parent_title ?? null : null,
      parent_category_slug:
        typeof categoryMeta === "object" ? categoryMeta?.parent_slug ?? null : null,
      out_of_stock: data.outOfStock ?? false,
      restricted: data.restricted ?? productType === "RESTRICTED_PRODUCT_TILE",
      sale_type: tracking.productSaleType ?? null,
      is_weighted: tracking.isWeightedProduct ?? null,
      increment: tracking.increment ?? null,
      dietary_labels: tracking.dietaryLabels ?? [],
      tags: data.tags ?? [],
      labels: data.labels ?? [],
      indicators: data.indicators ?? [],
      promotions: data.promotions ?? [],
      attribute_groups: data.attributeGroups ?? [],
      eans: extractEans(node),
      source_type: productType,
    },
  ];
}

function extractProducts(data, retailer, categoryMeta, store, allProducts) {
  let extracted = 0;
  for (const obj of walk(data)) {
    const result = extractProduct(obj, retailer, categoryMeta, store);
    if (!result) continue;
    const [key, product] = result;
    const existing = allProducts.get(key);
    if (!existing) {
      allProducts.set(key, product);
      extracted += 1;
    } else {
      existing.eans = [...new Set([...(existing.eans || []), ...(product.eans || [])])].sort();
      for (const [field, value] of Object.entries(product)) {
        const current = existing[field];
        if (
          (current == null || current === "" || (Array.isArray(current) && current.length === 0)) &&
          value != null &&
          value !== "" &&
          !(Array.isArray(value) && value.length === 0)
        ) {
          existing[field] = value;
        }
      }
    }
  }
  return extracted;
}

/** Parse Glovo deep-link path → slug segments (parent section / leaf category). */
function parseLinkSegments(path) {
  const match = String(path || "").match(/[?&]link=([^&]+)/);
  if (!match) return [];
  try {
    return decodeURIComponent(match[1])
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return match[1].split("/").filter(Boolean);
  }
}

function titleFromSlug(slug) {
  const base = String(slug || "")
    .replace(/-sc\.\d+$/i, "")
    .replace(/-c\.\d+$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!base) return slug || "Categorie";
  return base.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function enrichCategoryRecord(retailer, store, child, path, slugTitleMap) {
  const segments = parseLinkSegments(path);
  const leafSlug = child.slug || segments[segments.length - 1] || null;
  const parentSlug = segments.length > 1 ? segments[segments.length - 2] : null;
  if (leafSlug) slugTitleMap.set(leafSlug, child.title || titleFromSlug(leafSlug));
  if (parentSlug && !slugTitleMap.has(parentSlug)) {
    slugTitleMap.set(parentSlug, titleFromSlug(parentSlug));
  }
  return {
    retailer,
    store_id: store.store_id,
    address_id: store.address_id,
    title: child.title,
    slug: leafSlug,
    path,
    parent_slug: parentSlug,
    parent_title: parentSlug ? slugTitleMap.get(parentSlug) || titleFromSlug(parentSlug) : null,
    link_segments: segments,
  };
}

function extractDeepLinks(data) {
  const links = {};
  for (const obj of walk(data)) {
    if (obj.type !== "COLLECTION_TILE") continue;
    const collectionData = obj.data || {};
    const action = collectionData.action || {};
    const actionData = action.data || {};
    const path = actionData.path;
    if (!path || !String(path).includes("nodeType=DEEP_LINK")) continue;
    links[path] = {
      title: collectionData.title || "Unknown",
      slug: collectionData.slug,
      path,
    };
  }
  return links;
}

function checkpointPath(retailer) {
  return join(OUTPUT_DIR, `checkpoint_${retailer}.json`);
}

function loadCheckpoint(retailer) {
  return (
    loadJson(checkpointPath(retailer), null) || {
      queue: [],
      visited: [],
      products: [],
      categories: [],
      complete: false,
    }
  );
}

function saveCheckpoint(retailer, state, allProducts, allCategories) {
  const products = [...allProducts.values()].filter((p) => p.retailer === retailer);
  const categories = [...allCategories.values()].filter((c) => c.retailer === retailer);
  saveJson(checkpointPath(retailer), {
    ...state,
    products,
    categories,
  });
}

async function getMainCatalog(retailer, store) {
  const storeDir = join(RAW_DIR, retailer);
  ensureDir(storeDir);
  const cache = join(storeDir, "main.json");
  if (existsSync(cache)) {
    log(`[CACHE] ${retailer} main catalog`);
    return loadJson(cache);
  }
  const legacy = join(OUTPUT_DIR, `${retailer}_catalog.json`);
  if (existsSync(legacy)) {
    log(`[CACHE] Importing legacy catalog: ${retailer}`);
    const data = loadJson(legacy);
    saveJson(cache, data);
    return data;
  }
  const url = `${BASE_URL}/v4/stores/${store.store_id}/addresses/${store.address_id}/content/main`;
  const data = await requestJson(url);
  if (data != null) saveJson(cache, data);
  return data;
}

function categoryCachePath(storeDir, path, category) {
  const digest = createHash("sha1").update(path).digest("hex").slice(0, 12);
  return join(storeDir, `${safeFilename(category)}_${digest}.json`);
}

function urlJoin(base, path) {
  return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
}

async function crawlStore(retailer, store, allProducts, allCategories, failedRequests) {
  log("");
  log("=".repeat(60));
  log(`CRAWLING ${retailer.toUpperCase()}`);
  log("=".repeat(60));

  const storeDir = join(RAW_DIR, retailer);
  ensureDir(storeDir);
  const state = loadCheckpoint(retailer);
  if (state.complete) {
    log(`[COMPLETE] ${retailer} already processed`);
    return;
  }

  const mainData = await getMainCatalog(retailer, store);
  if (mainData == null) {
    failedRequests.push({ retailer, reason: "main_catalog_failed" });
    return;
  }

  if (!state.queue.length && !state.visited.length) {
    state.queue.push({ path: null, title: "HOME" });
  }

  for (const product of state.products || []) {
    const identity =
      product.store_product_id || product.external_id || product.product_id || product.name;
    allProducts.set(`${retailer}:${identity}`, product);
  }
  const slugTitleMap = new Map();
  for (const category of state.categories || []) {
    allCategories.set(`${retailer}:${category.path}`, category);
    if (category.slug) slugTitleMap.set(category.slug, category.title);
    if (category.parent_slug && category.parent_title) {
      slugTitleMap.set(category.parent_slug, category.parent_title);
    }
  }

  const visited = new Set(state.visited || []);
  let processed = visited.size;

  while (state.queue.length) {
    if (processed >= MAX_CATEGORIES_PER_STORE) {
      log("[LIMIT] Category limit reached");
      break;
    }

    const current = state.queue.shift();
    const path = current.path;
    const category = current.title;
    const visitKey = path || "HOME";
    if (visited.has(visitKey)) continue;

    log(`[CATEGORY ${processed + 1}] ${category}`);

    let data;
    if (path == null) {
      data = mainData;
    } else {
      const url = urlJoin(BASE_URL, path);
      const cache = categoryCachePath(storeDir, path, category);
      if (existsSync(cache)) {
        log(`[CACHE] ${category}`);
        data = loadJson(cache);
      } else {
        data = await requestJson(url);
        if (data == null) {
          failedRequests.push({
            retailer,
            category,
            url,
            reason: "category_request_failed",
          });
          log(`[FAILED] ${category}`);
          state.queue.unshift(current);
          saveCheckpoint(retailer, state, allProducts, allCategories);
          return;
        }
        saveJson(cache, data);
      }
    }

    const currentMeta =
      path == null
        ? { title: "HOME", slug: null, parent_slug: null, parent_title: null }
        : enrichCategoryRecord(
            retailer,
            store,
            { title: category, slug: current.slug || null },
            path,
            slugTitleMap,
          );

    const newProducts = extractProducts(data, retailer, currentMeta, store, allProducts);
    const discovered = extractDeepLinks(data);
    let newCategories = 0;
    for (const [childPath, child] of Object.entries(discovered)) {
      if (visited.has(childPath)) continue;
      if (state.queue.some((item) => item.path === childPath)) continue;
      const record = enrichCategoryRecord(retailer, store, child, childPath, slugTitleMap);
      state.queue.push({ path: childPath, title: child.title, slug: record.slug });
      allCategories.set(`${retailer}:${childPath}`, record);
      newCategories += 1;
    }

    visited.add(visitKey);
    state.visited = [...visited];
    processed += 1;

    saveJson(join(OUTPUT_DIR, "all_products.json"), [...allProducts.values()]);
    saveJson(join(OUTPUT_DIR, "all_categories.json"), [...allCategories.values()]);
    saveCheckpoint(retailer, state, allProducts, allCategories);

    log(`    [PRODUCTS] New unique: ${newProducts}`);
    log(`    [SUBCATEGORIES] Discovered: ${newCategories}`);
    log(`    [TOTAL] ${allProducts.size}`);
  }

  if (!state.queue.length) state.complete = true;
  saveCheckpoint(retailer, state, allProducts, allCategories);
  log(`[STORE COMPLETE] ${retailer}: ${processed} pages`);
}

function exportCsv(path, products) {
  const escape = (value) => {
    const text = value == null ? "" : String(value);
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const lines = [CSV_FIELDS.join(",")];
  for (const product of products) {
    const row = { ...product };
    for (const field of [
      "dietary_labels",
      "tags",
      "labels",
      "indicators",
      "promotions",
      "attribute_groups",
      "eans",
    ]) {
      row[field] = JSON.stringify(row[field] ?? []);
    }
    lines.push(CSV_FIELDS.map((field) => escape(row[field])).join(","));
  }
  writeFileSync(path, `\ufeff${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const startedAt = new Date().toISOString();
  ensureDir(OUTPUT_DIR);
  ensureDir(RAW_DIR);

  log("");
  log("=".repeat(60));
  log("GLOVO SUPERMARKET CATALOG CRAWLER (Node)");
  log("=".repeat(60));
  log(`[CITY] ${CITY_CODE}  [OUTPUT] ${OUTPUT_DIR}`);

  const allProducts = new Map();
  const allCategories = new Map();
  const failedRequests = [];

  for (const product of loadJson(join(OUTPUT_DIR, "all_products.json"), []) || []) {
    const retailer = product.retailer;
    if (!(retailer in TARGET_STORES)) continue;
    const identity =
      product.store_product_id || product.external_id || product.product_id || product.name;
    allProducts.set(`${retailer}:${identity}`, product);
  }
  for (const category of loadJson(join(OUTPUT_DIR, "all_categories.json"), []) || []) {
    allCategories.set(`${category.retailer}:${category.path}`, category);
  }

  log("");
  log("=".repeat(60));
  log("1. FETCHING STORE WALL");
  log("=".repeat(60));
  const storeWall = await fetchStoreWall();
  const stores = discoverStores(storeWall);
  const missing = Object.keys(TARGET_STORES).filter((key) => !stores[key]);
  if (missing.length) {
    log(`[WARN] Missing stores on wall: ${missing.join(", ")}`);
  }

  for (const retailer of Object.keys(TARGET_STORES)) {
    const store = stores[retailer];
    if (!store) continue;
    try {
      await crawlStore(retailer, store, allProducts, allCategories, failedRequests);
    } catch (err) {
      if (err instanceof RateLimitError || err instanceof AccessDeniedError) {
        log(`[FATAL] ${err.message}`);
        break;
      }
      throw err;
    }
  }

  const products = [...allProducts.values()];
  saveJson(join(OUTPUT_DIR, "all_products.json"), products);
  saveJson(join(OUTPUT_DIR, "all_categories.json"), [...allCategories.values()]);
  saveJson(join(OUTPUT_DIR, "failed_requests.json"), failedRequests);
  saveJson(join(OUTPUT_DIR, "crawl_metadata.json"), {
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    city_code: CITY_CODE,
    stores: Object.keys(stores),
    product_count: products.length,
    failed_requests: failedRequests.length,
    runtime: "node",
  });
  exportCsv(join(OUTPUT_DIR, "all_products.csv"), products);
  for (const retailer of Object.keys(TARGET_STORES)) {
    const subset = products.filter((p) => p.retailer === retailer);
    if (subset.length) exportCsv(join(OUTPUT_DIR, `${retailer}_products.csv`), subset);
  }

  log("");
  log("=".repeat(60));
  log(`[DONE] ${products.length} products`);
  log(`[JSON] ${join(OUTPUT_DIR, "all_products.json")}`);
  log(`[CSV]  ${join(OUTPUT_DIR, "all_products.csv")}`);
  log("=".repeat(60));

  if (!products.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[glovo:crawl]", err.message || err);
  process.exit(1);
});
